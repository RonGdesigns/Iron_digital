const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {router,report,sponsor}=require('./detroit-hub');
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
const inquiry={business:'Local Business',name:'Owner',email:'owner@example.com',businessUrl:'https://example.com/',package:'founding',startDate:'2026-09-15',details:'Please promote our upcoming event.',requestId:'22222222-2222-4222-8222-222222222222'};
test('sponsor fields reject bad links, dates, packages and header injection',()=>{
  assert.match(sponsor(inquiry).package,/\$200/);
  for(const patch of [{business:'Business\nBcc: intruder'},{name:'Owner\nInjected'}, {email:''},{businessUrl:'javascript:alert(1)'},{businessUrl:'https://user:pass@example.com'}, {package:'__proto__'},{startDate:'2026-02-30'},{startDate:'2026-99-01'},{details:'short'}]) assert.throws(()=>sponsor({...inquiry,...patch}));
});
test('sponsor inquiry sends only to notification inbox with a separate idempotency key',async t=>{
  const calls=[];const request=await start(t,{fetcher:async(url,opts)=>{calls.push({url,...opts});return response({id:'inquiry1'});}});
  assert.equal((await (await request('/config')).json()).sponsor,true);
  const result=await request('/sponsor',{...inquiry,to:'intruder@example.com',amount:1});assert.equal(result.status,200);
  const sent=JSON.parse(calls[0].body);assert.deepEqual(sent.to,['owner@example.com']);assert.equal(sent.reply_to,inquiry.email);
  assert.equal(sent.html,undefined);assert.match(sent.text,/No payment or placement has been confirmed/);assert.match(sent.text,/\$200/);
  assert.equal(calls[0].headers['Idempotency-Key'],'hub-sponsor/'+inquiry.requestId);
  await request('/sponsor',inquiry);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
});
test('sponsor failures, bots, missing config and foreign origins never produce false delivery',async t=>{
  let calls=0;const request=await start(t,{fetcher:async()=>{calls++;return response({},500);}});
  assert.equal((await request('/sponsor',{...inquiry,website:'bot'})).status,200);assert.equal(calls,0);
  assert.equal((await request('/sponsor',inquiry,{Origin:'https://evil.example'})).status,403);assert.equal(calls,0);
  assert.equal((await request('/sponsor',inquiry)).status,503);assert.equal(calls,1);
  const missing=await start(t,{env:{},fetcher:async()=>{throw Error('must not call');}});
  assert.equal((await (await missing('/config')).json()).sponsor,false);
  assert.equal((await missing('/sponsor',inquiry)).status,503);
});
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
test('beehiiv owns signup; retired newsletter routes never call Resend',async t=>{
  let calls=0;const request=await start(t,{fetcher:async()=>{calls++;return response({});}});
  const config=await (await request('/config')).json();
  assert.equal(config.report,true);assert.equal(config.subscribe,false);assert.equal(config.newsletterProvider,'beehiiv');
  for(const path of ['/subscribe','/confirm','/weekend-send'])assert.equal((await request(path,{})).status,410);
  assert.equal((await request('/confirm?token=old')).status,410);
  assert.equal(calls,0);
});
