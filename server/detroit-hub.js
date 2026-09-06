'use strict';
const express = require('express');
const SITE = 'https://thedethub.com';
const ORIGINS = new Set([SITE, 'https://www.thedethub.com', 'http://127.0.0.1:8000', 'http://localhost:8000']);
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const REASONS = {canceled:'Canceled', time:'Date or time', price:'Price or tickets', location:'Location', other:'Other detail'};
const PACKAGES = {founding:'Founding local sponsor — $200 / 30 days',event:'Featured event — $50 / 7 days',unsure:'Help me choose'};
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
function sponsor(body) {
  if (!Object.hasOwn(PACKAGES, body.package)) throw fail('Choose a placement.');
  const business=text(body.business,120,1), name=text(body.name,100,1);
  if (/[\r\n]/.test(business+name)) throw fail('Use one line for your name and business.');
  const businessUrl=text(body.businessUrl,500,8);
  let u; try { u=new URL(businessUrl); } catch (_) { throw fail('Enter a valid business or event website.'); }
  if (!['http:','https:'].includes(u.protocol) || !u.hostname || u.username || u.password) throw fail('Enter an http or https business or event website.');
  const startDate=text(body.startDate,10);
  if (startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0,10)!==startDate)) throw fail('Enter a valid preferred date.');
  return {business,name,businessUrl,startDate,email:email(body.email,true),package:PACKAGES[body.package],details:text(body.details,2000,10)};
}
function router({env=process.env, fetcher=fetch, now=()=>Date.now(), requestDelay=550}={}) {
  const route=express.Router();
  const key=env.RESEND_API_KEY, recipient=env.NOTIFY_EMAIL;
  const sender=env.HUB_FROM_EMAIL || 'contact@irondigitalmi.com';
  let requestQueue=Promise.resolve();
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
  function publicRequest(req) {
    rate('global',150);
    // Render supplies the last forwarded client address. Local requests use the socket.
    const forwarded=env.RENDER ? (req.get('x-forwarded-for')||'').split(',').at(-1).trim() : '';
    rate('ip:'+(forwarded||req.socket.remoteAddress),10);
    if(req.body?.website) return false;
    return true;
  }
  route.get('/config',(_req,res)=>res.json({ok:true,report:!!key && !!recipient,sponsor:!!key && !!recipient,subscribe:false,newsletterProvider:'beehiiv'}));
  route.post('/sponsor',handle(async(req,res)=>{
    if(!key||!recipient) throw fail('Online inquiries are unavailable. Please email Detroit Hub.',503);
    if(!publicRequest(req)) return res.json({ok:true,message:'Thank you. Your inquiry has been received for review.'});
    const r=sponsor(req.body||{}), id=text(req.body.requestId,80,16);
    if(!/^[a-zA-Z0-9-]+$/.test(id)) throw fail('Invalid request identifier.');
    const message={from:'Detroit Hub <'+sender+'>',to:[recipient],reply_to:r.email,
      subject:'[Detroit Hub sponsorship] '+r.business,
      text:['Sponsorship inquiry only. No payment or placement has been confirmed.',
        'Business: '+r.business,'Contact: '+r.name,'Email: '+r.email,'Website: '+r.businessUrl,
        'Requested offer: '+r.package,'Preferred start: '+(r.startDate||'Flexible'),
        'Promotion details: '+r.details,'Inquiry reference: '+id].join('\n\n')};
    await resend('/emails','POST',message,'hub-sponsor/'+id);
    res.json({ok:true,message:'Thank you. Your inquiry has been emailed to Detroit Hub. We will reply to discuss availability; no placement is booked yet.'});
  }));
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
  // Cached copies of the old form cannot create a second subscriber list.
  route.all(['/subscribe','/confirm','/weekend-send'],(_req,res)=>res.status(410).json({ok:false,error:'Newsletter signup is handled by beehiiv. Visit the Detroit Hub weekend guide to join.'}));
  route.use((err,_req,res,_next)=>{
    // Do not log form contents, email addresses, confirmation tokens, or provider secrets.
    const status=err.status||503;
    res.status(status).json({ok:false,error:status>=500?'Email service unavailable. Please try again later.':err.message});
  });
  return route;
}
module.exports={router,report,sponsor};
