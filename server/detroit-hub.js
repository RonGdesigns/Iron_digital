'use strict';
const express = require('express');
const crypto = require('node:crypto');
const SITE = 'https://thedethub.com';
const API = 'https://iron-digital-server.onrender.com/detroit-hub';
const NAME = 'Detroit Hub weekend guide';
const ORIGINS = new Set([SITE, 'https://www.thedethub.com', 'http://127.0.0.1:8000', 'http://localhost:8000']);
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const REASONS = {canceled:'Canceled', time:'Date or time', price:'Price or tickets', location:'Location', other:'Other detail'};
function fail(message, status=400) { return Object.assign(new Error(message), {status}); }
function text(value, max, min=0) {
  if (value == null && min === 0) return '';
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw fail('Please check the form fields.');
  return value.trim();
}
function email(value, required=false) {
  const result = text(value,254,required ? 3 : 0).toLowerCase();
  if (result && !EMAIL.test(result)) throw fail('Enter a valid email address.');
  return result;
}
function report(body) {
  if (!Object.hasOwn(REASONS, body.reason)) throw fail('Choose what changed.');
  const path=text(body.path,240,8), title=text(body.title,220,1), details=text(body.details,2000,10);
  if (!/^\/event-[a-z0-9-]+\/$/.test(path) || /[\r\n]/.test(title)) throw fail('Invalid event.');
  const source=text(body.source,500);
  if (source) { let u; try { u=new URL(source); } catch (_) { throw fail('Enter a valid announcement link.'); } if (!['https:','http:'].includes(u.protocol) || u.username || u.password) throw fail('Enter an http or https announcement link.'); }
  return {path,title,details,source,email:email(body.email),reason:REASONS[body.reason]};
}
function token(email, secret, now=Date.now()) {
  const data=Buffer.from(JSON.stringify({email, exp:Math.floor(now/1000)+86400, purpose:'detroit-hub-weekend'})).toString('base64url');
  return data+'.'+crypto.createHmac('sha256',secret).update(data).digest('base64url');
}
function verifyToken(value, secret, now=Date.now()) {
  if (typeof value !== 'string' || value.length>1500) throw fail('That confirmation link is invalid or expired.');
  const [data, signature, extra]=value.split('.');
  const expected=crypto.createHmac('sha256',secret).update(data||'').digest();
  const actual=Buffer.from(signature||'', 'base64url');
  if (extra || actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected)) throw fail('That confirmation link is invalid or expired.');
  let payload; try { payload=JSON.parse(Buffer.from(data,'base64url').toString()); } catch (_) { throw fail('Invalid confirmation.'); }
  if (payload.purpose!=='detroit-hub-weekend' || !Number.isFinite(payload.exp) || payload.exp < now/1000 || payload.exp>now/1000+86401) throw fail('That confirmation link has expired. Please sign up again.');
  return email(payload.email,true);
}
function esc(value) { return String(value||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function documentHTML(title, body) { return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>'+esc(title)+' · Detroit Hub</title><body style="font:18px/1.6 system-ui;color:#18242c;background:#edf3f6;margin:0"><main style="max-width:600px;margin:8vh auto;padding:30px;background:white"><h1>'+esc(title)+'</h1>'+body+'<p><a href="'+SITE+'/weekend/">Back to the weekend guide</a></p></main></body></html>'; }

// Verify the signature AND the exact repository, branch, workflow and audience.
async function verifyWorkflow(jwt, fetcher=fetch, now=Date.now()) {
  if (typeof jwt !== 'string' || jwt.length>14000) throw fail('Unauthorized',401);
  const pieces=jwt.split('.'); if(pieces.length!==3) throw fail('Unauthorized',401);
  let header, claims;
  try { header=JSON.parse(Buffer.from(pieces[0],'base64url')); claims=JSON.parse(Buffer.from(pieces[1],'base64url')); } catch (_) { throw fail('Unauthorized',401); }
  const validSubject = ['repo:RonGdesigns/detroit-hub:ref:refs/heads/master','repo:RonGdesigns@139249566/detroit-hub@1356662651:ref:refs/heads/master'].includes(claims.sub);
  if (header.alg!=='RS256' || claims.iss!=='https://token.actions.githubusercontent.com' || claims.aud!==API+'/weekend-send' || !validSubject ||
      claims.repository_id!=='1356662651' || claims.repository_owner_id!=='139249566' || claims.ref!=='refs/heads/master' ||
      claims.workflow_ref!=='RonGdesigns/detroit-hub/.github/workflows/weekend.yml@refs/heads/master' ||
      !['schedule','workflow_dispatch'].includes(claims.event_name) || !Number.isFinite(claims.exp) || !Number.isFinite(claims.nbf) ||
      claims.exp<=now/1000 || claims.nbf>now/1000+30 || claims.exp>now/1000+900) throw fail('Unauthorized',401);
  const response=await fetcher('https://token.actions.githubusercontent.com/.well-known/jwks', {signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw fail('Workflow authentication unavailable',503);
  const keys=await response.json(), jwk=keys.keys.find(k=>k.kid===header.kid && k.kty==='RSA');
  if(!jwk || !crypto.verify('RSA-SHA256',Buffer.from(pieces[0]+'.'+pieces[1]),crypto.createPublicKey({key:jwk,format:'jwk'}),Buffer.from(pieces[2],'base64url'))) throw fail('Unauthorized',401);
  return claims;
}

function router({env=process.env, fetcher=fetch, now=()=>Date.now(), workflowVerifier=verifyWorkflow, requestDelay=550}={}) {
  const route=express.Router();
  const key=env.RESEND_API_KEY, recipient=env.NOTIFY_EMAIL;
  const sender=env.HUB_FROM_EMAIL || 'contact@irondigitalmi.com';
  const secret=env.HUB_CONFIRM_SECRET || key;
  const postalAddress=env.HUB_POSTAL_ADDRESS || '313 Park Ave, Detroit, MI 48226';
  const newsletterOn=!!key && env.HUB_NEWSLETTER_ENABLED!=='false';
  let resourcesPromise, sending=false, requestQueue=Promise.resolve();
  const limits=new Map();
  function rate(id, max, window=3600000) {
    const clock=now();
    for(const [k,v] of limits) if(v.until<=clock) limits.delete(k);
    const current=limits.get(id)||{n:0,until:clock+window};
    if(current.n>=max || limits.size>10000) throw fail('Too many requests. Please try again later.',429);
    current.n++; limits.set(id,current);
  }
  route.use((req,res,next)=>{
    res.set('Cache-Control','no-store'); res.set('Referrer-Policy','no-referrer'); res.set('X-Content-Type-Options','nosniff');
    const origin=req.get('origin');
    if(origin && !ORIGINS.has(origin) && origin!=='https://iron-digital-server.onrender.com') return res.status(403).json({ok:false,error:'Origin not allowed.'});
    if(origin && ORIGINS.has(origin)) { res.set('Access-Control-Allow-Origin',origin);res.vary('Origin');res.set('Access-Control-Allow-Headers','Content-Type');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS'); }
    if(req.method==='OPTIONS') return res.sendStatus(204);
    next();
  });
  route.use(express.json({limit:'8kb'}));
  route.use(express.urlencoded({extended:false,limit:'4kb'}));
  const handle=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
  async function resend(path, method='GET', body, idempotency) {
    const turn=requestQueue.then(()=>new Promise(resolve=>setTimeout(resolve,requestDelay)));
    requestQueue=turn.catch(()=>{});
    await turn;
    const response=await fetcher('https://api.resend.com'+path, {method, signal:AbortSignal.timeout(20000), headers:{Authorization:'Bearer '+key,'Content-Type':'application/json', ...(idempotency ? {'Idempotency-Key':idempotency}: {})}, ...(body ? {body:JSON.stringify(body)} : {})});
    const data=await response.json();
    if(!response.ok) throw fail('Email service unavailable. Please try again later.', response.status===404 ? 404 : 503);
    return data;
  }
  async function list(path) {
    let all=[], after='';
    for(let page=0;page<50;page++) {
      const batch=await resend(path+'?limit=100'+(after?'&after='+encodeURIComponent(after):''));
      all.push(...(batch.data||[]));
      if(!batch.has_more) return all;
      after=batch.data.at(-1)?.id;
      if(!after) break;
    }
    throw fail('Email list is too large to process safely.',503);
  }
  function resources() {
    if(!resourcesPromise) resourcesPromise=(async()=>{
      let segment=(await list('/segments')).find(s=>s.name===NAME);
      if(!segment) segment=await resend('/segments','POST',{name:NAME});
      let topic=(await list('/topics')).find(s=>s.name===NAME);
      if(!topic) topic=await resend('/topics','POST',{name:NAME,default_subscription:'opt_out',description:'Detroit events and city reading each Thursday. Join by confirming your email.'});
      return {segment:segment.id,topic:topic.id};
    })().catch(e=>{resourcesPromise=null;throw e;});
    return resourcesPromise;
  }
  function publicRequest(req) {
    rate('global',150);
    // Render supplies the last forwarded client address. Local requests use the socket.
    const forwarded=env.RENDER ? (req.get('x-forwarded-for')||'').split(',').at(-1).trim() : '';
    rate('ip:'+(forwarded||req.socket.remoteAddress),10);
    if(req.body?.website) return false;
    return true;
  }
  route.get('/config',(_req,res)=>res.json({ok:true,report:!!key && !!recipient,subscribe:newsletterOn}));
  route.post('/report',handle(async(req,res)=>{
    if(!key||!recipient) throw fail('Online reports are unavailable. Please email the editor.',503);
    if(!publicRequest(req)) return res.json({ok:true,message:'Thank you. Your report has been received for review.'});
    const r=report(req.body||{}), id=text(req.body.requestId,80,16);
    if(!/^[a-zA-Z0-9-]+$/.test(id)) throw fail('Invalid request identifier.');
    const message={from:'Detroit Hub <'+sender+'>',to:[recipient],subject:'[Detroit Hub change] '+r.reason+': '+r.title,
      text:['A visitor reported a change. Review the source before updating the listing.','Event: '+r.title,'Page: '+SITE+r.path,'Reason: '+r.reason,'Details: '+r.details,'Announcement: '+(r.source||'Not provided'),'Reply email: '+(r.email||'Not provided')].join('\n\n')};
    if(r.email) message.reply_to=r.email;
    await resend('/emails','POST',message,'hub-report/'+id);
    res.json({ok:true,message:'Thank you. Your report has been emailed to the editor for review.'});
  }));
  route.post('/subscribe',handle(async(req,res)=>{
    if(!newsletterOn) throw fail('Email signup is not available yet.',503);
    if(!publicRequest(req)) return res.json({ok:true,message:'Check your inbox to confirm your email address.'});
    if(req.body?.consent!==true) throw fail('Please confirm you want the weekly guide.');
    const address=email(req.body.email,true);
    rate('email:'+crypto.createHash('sha256').update(address).digest('hex'),2);
    await resources(); // Prove that Contacts/Broadcast permissions work before promising signup.
    const link=API+'/confirm?token='+encodeURIComponent(token(address,secret,Math.floor(now()/3600000)*3600000));
    await resend('/emails','POST',{from:'Detroit Hub <'+sender+'>',to:[address],subject:'Confirm your Detroit weekend guide',
      text:'You asked for the Detroit Hub weekend guide, sent each Thursday. Confirm within 24 hours: '+link+'\n\nIf you did not request this, ignore this email. You have not been subscribed.'},'hub-confirm/'+crypto.createHash('sha256').update(address+Math.floor(now()/3600000)).digest('hex'));
    res.json({ok:true,message:'Check your inbox to confirm your email address. You will join the list only after confirming.'});
  }));
  route.get('/confirm',handle(async(req,res)=>{
    if(!newsletterOn) throw fail('Email signup is unavailable.',503);
    verifyToken(req.query.token,secret,now());
    res.type('html').send(documentHTML('Confirm your weekend guide', '<p>One email each Thursday with Detroit events and city reading. Unsubscribe anytime.</p><form method="post" action="'+API+'/confirm"><input type="hidden" name="token" value="'+esc(req.query.token)+'"><button style="font:inherit;padding:12px 20px" type="submit">Confirm subscription</button></form>'));
  }));
  route.post('/confirm',handle(async(req,res)=>{
    if(!newsletterOn) throw fail('Email signup is unavailable.',503);
    publicRequest(req);
    const address=verifyToken(req.body.token,secret,now()), ids=await resources();
    let contact;
    try {contact=await resend('/contacts/'+encodeURIComponent(address));} catch(e) { if(e.status!==404) throw e; }
    if(contact?.unsubscribed) return res.type('html').send(documentHTML('Your email preferences are unchanged','<p>This address previously unsubscribed from all Iron Digital emails. Please contact <a href="mailto:contact@irondigitalmi.com">the editor</a> if you want to change that preference.</p>'));
    if(!contact) await resend('/contacts','POST',{email:address,unsubscribed:false,segments:[{id:ids.segment}],topics:[{id:ids.topic,subscription:'opt_in'}]});
    else {
      const memberships=await list('/contacts/'+contact.id+'/segments');
      if(memberships.some(s=>s.id===ids.segment)) return res.type('html').send(documentHTML('Your preferences are saved','<p>This address has already confirmed the weekend guide. Any later unsubscribe preference is unchanged. Use the preferences link in a previous email to manage your subscription.</p>'));
      await resend('/contacts/'+contact.id+'/topics','PATCH',{topics:[{id:ids.topic,subscription:'opt_in'}]});
      await resend('/contacts/'+contact.id+'/segments/'+ids.segment,'POST',{});
    }
    res.type('html').send(documentHTML('You’re on the list','<p>Your Detroit weekend guide will arrive on Thursdays. Every email has an unsubscribe link.</p>'));
  }));
  route.post('/weekend-send',handle(async(req,res)=>{
    if(!newsletterOn) throw fail('Newsletter is not enabled.',503);
    const workflow=await workflowVerifier((req.get('authorization')||'').replace(/^Bearer /,''),fetcher,now());
    if(sending) throw fail('A weekend send is already running.',409);
    sending=true;
    try {
      const response=await fetcher(SITE+'/data/weekend.json',{signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw fail('Weekend guide unavailable.',503);
      const guide=await response.json();
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(guide.start) || guide.end<day || guide.start>new Date(now()+8*86400000).toISOString().slice(0,10) || !guide.events?.length || !Number.isFinite(Date.parse(guide.fetched)) || now()-Date.parse(guide.fetched)>48*3600000) throw fail('The weekend guide is empty or stale. Refresh the site before sending.',409);
      const link=r=>typeof r.url==='string' && /^https:\/\/thedethub\.com\/(event|post)-[a-z0-9-]+\/$/.test(r.url);
      if(!guide.events.every(link) || !(guide.articles||[]).every(link)) throw fail('Invalid guide links.',409);
      const content='<h1>Your weekend in Detroit</h1><p>'+esc(guide.start)+' – '+esc(guide.end)+'</p>'+guide.events.slice(0,9).map(r=>'<h2><a href="'+esc(r.url)+'">'+esc(r.name)+'</a></h2><p>'+esc(r.date)+' · '+esc(r.venue)+' · '+esc(r.price)+'</p>').join('')+'<p><a href="'+SITE+'/weekend/">See the full guide</a> · <a href="'+SITE+'/weather/">Weather</a></p><h2>Catch up on the city</h2>'+(guide.articles||[]).slice(0,3).map(r=>'<p><a href="'+esc(r.url)+'">'+esc(r.title)+'</a> · '+esc(r.date)+'</p>').join('')+'<p>From published listings. Confirm details with the organizer before traveling.</p>';
      if(req.body?.preview===true) {
        if(!recipient) throw fail('Notification email is missing.',503);
        await resend('/emails','POST',{from:'Detroit Hub <'+sender+'>',to:[recipient],subject:'[PREVIEW] Your Detroit weekend guide',html:content},'hub-preview/'+guide.end+'/'+workflow.run_id);
        return res.json({ok:true,message:'Preview sent to the existing notification email.'});
      }
      const ids=await resources(), name=NAME+' ending '+guide.end;
      let broadcast=(await list('/broadcasts')).find(b=>b.name===name);
      if(broadcast) {
        broadcast=await resend('/broadcasts/'+broadcast.id);
        if(broadcast.status!=='draft') return res.json({ok:true,message:'This weekend guide is already queued or sent.'});
      } else broadcast=await resend('/broadcasts','POST',{name,segment_id:ids.segment,topic_id:ids.topic,from:'Detroit Hub <'+sender+'>',subject:'Your Detroit weekend · '+guide.start,
        html:content+'<p>Detroit Hub · Iron Digital MI<br>'+esc(postalAddress)+'<br><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe or manage preferences</a></p>'});
      await resend('/broadcasts/'+broadcast.id+'/send','POST',{});
      res.json({ok:true,message:'Weekend guide queued for confirmed subscribers.'});
    } finally { sending=false; }
  }));
  route.use((err,_req,res,_next)=>{
    // Do not log form contents, email addresses, confirmation tokens, or provider secrets.
    const status=err.status||503;
    res.status(status).json({ok:false,error:status>=500?'Email service unavailable. Please try again later.':err.message});
  });
  return route;
}
module.exports={router,report,token,verifyToken,verifyWorkflow};
