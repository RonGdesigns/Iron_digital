const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const express=require('express');
const {router,report,token,verifyToken,verifyWorkflow}=require('./detroit-hub');
const now=Date.parse('2026-09-03T13:35:00Z');
const env={RESEND_API_KEY:'test-secret',NOTIFY_EMAIL:'owner@example.com'};
const example={path:'/event-jazz/',title:'Jazz',reason:'time',details:'Starts at noon instead.',email:'reader@example.com',source:'https://example.com/change',requestId:'11111111-1111-4111-8111-111111111111'};
async function start(t, options={}) {
  const app=express();app.use('/detroit-hub',router({env,now:()=>now,requestDelay:0,...options}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/detroit-hub';
  return (path,body,headers={})=>fetch(url+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:'https://thedethub.com',...headers},body:body?JSON.stringify(body):undefined});
}
function response(data,status=200){return {ok:status<400,status,json:async()=>data};}
test('report validation rejects arbitrary URLs, header injection and bad links',()=>{
  assert.equal(report(example).email,'reader@example.com');
  for(const patch of [{path:'https://evil.example/'},{title:'Bad\nBcc: somebody'},{reason:'__proto__'},{source:'javascript:alert(1)'},{details:'short'},{email:'a\nb@example.com'}]) assert.throws(()=>report({...example,...patch}));
});
test('reports use a fixed recipient, plain text, and provider idempotency',async t=>{
  const calls=[];const request=await start(t,{fetcher:async(url,opts)=>{calls.push({url,...opts});return response({id:'email1'});}});
  const r=await request('/report',{...example,to:'intruder@example.com'});assert.equal(r.status,200);
  const sent=JSON.parse(calls[0].body);assert.deepEqual(sent.to,['owner@example.com']);assert.equal(sent.from,'Detroit Hub <contact@irondigitalmi.com>');assert.equal(sent.reply_to,'reader@example.com');
  assert.equal(sent.html,undefined);assert.match(sent.text,/https:\/\/thedethub.com\/event-jazz\//);
  await request('/report',example);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
});
test('failed delivery never reports success, and foreign origins cannot submit',async t=>{
  let calls=0;const request=await start(t,{fetcher:async()=>{calls++;return response({},500);}});
  let r=await request('/report',example);assert.equal(r.status,503);assert.equal((await r.json()).ok,false);
  r=await request('/report',example,{Origin:'https://evil.example'});assert.equal(r.status,403);assert.equal(calls,1);
});
test('honeypot suppresses email and rate limits stop repeated reports',async t=>{
  let calls=0;const request=await start(t,{fetcher:async()=>{calls++;return response({id:'ok'});}});
  await request('/report',{...example,website:'bot'});assert.equal(calls,0);
  let last;for(let i=0;i<10;i++)last=await request('/report',example);
  assert.equal(last.status,429);assert.equal(calls,9);
});
test('confirmation token cannot be tampered with, reused for another purpose, or used after expiry',()=>{
  const value=token('reader@example.com','secret',now);
  assert.equal(verifyToken(value,'secret',now),'reader@example.com');
  assert.throws(()=>verifyToken(value+'x','secret',now));assert.throws(()=>verifyToken(value,'another',now));assert.throws(()=>verifyToken(value,'secret',now+86401000));
});
test('signup sends confirmation only; GET does not subscribe; confirmed POST creates only Hub membership',async t=>{
  const calls=[];
  const request=await start(t,{fetcher:async(url,opts)=>{
    calls.push({url,...opts});
    if(url.includes('/segments?'))return response({data:[{id:'seg',name:'Detroit Hub weekend guide'}]});
    if(url.includes('/topics?'))return response({data:[{id:'topic',name:'Detroit Hub weekend guide'}]});
    if(url.includes('/contacts/')&&opts.method==='GET')return response({},404);
    return response({id:'id1'});
  }});
  let r=await request('/subscribe',{email:'reader@example.com',consent:false});assert.equal(r.status,400);
  r=await request('/subscribe',{email:'reader@example.com',consent:true});assert.equal(r.status,200);
  assert.equal(calls.filter(c=>c.url==='https://api.resend.com/contacts').length,0);
  const mail=JSON.parse(calls.find(c=>c.url.endsWith('/emails')).body), value=mail.text.match(/token=([^\s]+)/)[1];
  r=await request('/confirm?token='+value);assert.equal(r.status,200);
  assert.equal(calls.filter(c=>c.url==='https://api.resend.com/contacts').length,0);
  r=await request('/confirm',{token:decodeURIComponent(value)});assert.equal(r.status,200);
  const contact=JSON.parse(calls.find(c=>c.url==='https://api.resend.com/contacts').body);
  assert.deepEqual(contact.segments,[{id:'seg'}]);assert.deepEqual(contact.topics,[{id:'topic',subscription:'opt_in'}]);
});
test('confirmation replay does not undo a subscriber opt-out',async t=>{
  const mutations=[];
  const request=await start(t,{fetcher:async(url,opts)=>{
    if(opts.method!=='GET')mutations.push(url);
    if(url.includes('/segments?'))return response({data:[{id:'seg',name:'Detroit Hub weekend guide'}]});
    if(url.includes('/topics?'))return response({data:[{id:'topic',name:'Detroit Hub weekend guide'}]});
    return response({id:'contact',unsubscribed:false});
  }});
  const r=await request('/confirm',{token:token('reader@example.com',env.RESEND_API_KEY,now)});
  assert.equal(r.status,200);assert.deepEqual(mutations,[]);
});
test('newsletter refuses stale guides and sends broadcasts only to the confirmed segment with unsubscribe',async t=>{
  const calls=[];let stale=true;
  const request=await start(t,{workflowVerifier:async()=>({run_id:'123'}),fetcher:async(url,opts)=>{
    calls.push({url,...opts});
    if(url.includes('/data/weekend.json'))return response({start:'2026-09-04',end:'2026-09-06',fetched:stale?'2026-08-01T00:00:00Z':'2026-09-03T12:00:00Z',events:[{name:'Jazz <test>',venue:'Hart Plaza',price:'Free',date:'2026-09-04',url:'https://thedethub.com/event-jazz/'}],articles:[]});
    if(url.includes('/segments?'))return response({data:[{id:'seg',name:'Detroit Hub weekend guide'}]});
    if(url.includes('/topics?'))return response({data:[{id:'topic',name:'Detroit Hub weekend guide'}]});
    if(url.includes('/broadcasts?'))return response({data:[]});
    return response({id:'broadcast'});
  }});
  let r=await request('/weekend-send',{});assert.equal(r.status,409);assert.equal(calls.length,1);
  stale=false;r=await request('/weekend-send',{});assert.equal(r.status,200);
  const broadcast=JSON.parse(calls.find(c=>c.url.endsWith('/broadcasts')&&c.method==='POST').body);
  assert.equal(broadcast.segment_id,'seg');assert.equal(broadcast.topic_id,'topic');assert.match(broadcast.html,/RESEND_UNSUBSCRIBE_URL/);assert.match(broadcast.html,/313 Park Ave/);assert.match(broadcast.html,/Jazz &lt;test&gt;/);
});
test('workflow authentication validates real RSA signatures and exact claims',async()=>{
  const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  const header={alg:'RS256',kid:'test'};
  const claims={iss:'https://token.actions.githubusercontent.com',aud:'https://iron-digital-server.onrender.com/detroit-hub/weekend-send',sub:'repo:RonGdesigns/detroit-hub:ref:refs/heads/master',repository_id:'1356662651',repository_owner_id:'139249566',ref:'refs/heads/master',workflow_ref:'RonGdesigns/detroit-hub/.github/workflows/weekend.yml@refs/heads/master',event_name:'schedule',nbf:now/1000-1,exp:now/1000+300};
  function jwt(c=claims){const parts=[header,c].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return parts+'.'+crypto.sign('RSA-SHA256',Buffer.from(parts),privateKey).toString('base64url');}
  const fetcher=async()=>response({keys:[{...publicKey.export({format:'jwk'}),kid:'test'}]});
  assert.equal((await verifyWorkflow(jwt(),fetcher,now)).repository_id,'1356662651');
  for(const patch of [{ref:'refs/heads/evil'},{aud:'other'},{repository_id:'1'},{exp:now/1000-1},{workflow_ref:'another-workflow'}])await assert.rejects(()=>verifyWorkflow(jwt({...claims,...patch}),fetcher,now));
  const parts=jwt().split('.');parts[2]=Buffer.alloc(256).toString('base64url');await assert.rejects(()=>verifyWorkflow(parts.join('.'),fetcher,now));
});
