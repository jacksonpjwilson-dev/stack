// Virtual accounts: app-computed envelopes carved out of real accounts.
import {ctx} from "./store.js";
import {todayISO,addMonths,pad,uid} from "./util.js";
import {accountBalance,isCredit} from "./analysis.js";

export const TEMPLATES=[
  {key:"vacation",name:"Vacation",amount:0,rule:{amount:500,day:28,endDate:"2026-12-31",cap:null,sources:["chequing"]}},
  {key:"emergency",name:"Emergency",amount:0,rule:{amount:500,day:1,endDate:"",cap:5000,sources:["chequing"]}},
  {key:"debt",name:"Debt",amount:0,rule:{amount:500,day:1,endDate:"",cap:null,sources:["savings","chequing"]}}
];
// Called from migrate(): seed once.
export function seedVirtuals(s){
  if(!Array.isArray(s.virtuals))s.virtuals=[];
  // fix-1: Vacation/Emergency fund from Chequing only (only if still the old default)
  if(!s.settings.fix1Sources){
    for(const v of s.virtuals)if((v.id==="va-vacation"||v.id==="va-emergency")&&v.rule&&JSON.stringify(v.rule.sources)==='["savings","chequing"]'){
      v.rule.sources=["chequing"];
      // re-attribute already-held money to Chequing so it reduces Chequing free
      (v.log||[]).forEach(e=>{if(e.type==="contribution"&&e.accountId){e.accountId="";e.accountName="Chequing";}});
    }
    s.settings.fix1Sources=true;
  }
  if(s.settings.virtualsSeeded)return;
  const today=todayISO();
  const legacy=(s.legacy&&Array.isArray(s.legacy.accounts))?s.legacy.accounts.filter(a=>a&&a.name):[];
  const mk=(t,name,amount)=>({id:"va-"+(t?t.key:uid()),name,amount:Number(amount)||0,created:today,rule:t?JSON.parse(JSON.stringify(t.rule)):{amount:0,day:1,endDate:"",cap:null,sources:["savings","chequing"]},log:[]});
  if(legacy.length){
    legacy.forEach(a=>{const t=TEMPLATES.find(x=>new RegExp(x.key,"i").test(a.name)||(x.key==="vacation"&&/trip|travel|dominican/i.test(a.name)));s.virtuals.push({...mk(t,a.name,a.balance),id:t&&!s.virtuals.some(v=>v.id==="va-"+t.key)?"va-"+t.key:"va-"+uid(),legacyId:a.id});});
  }
  for(const t of TEMPLATES)if(!s.virtuals.some(v=>new RegExp(t.key,"i").test(v.name)))s.virtuals.push(mk(t,t.name,t.key==="emergency"?s.settings.emergency:0));
  const vac=s.virtuals.find(v=>/vacation|trip|travel/i.test(v.name));
  const dr=(s.goals||[]).find(g=>/dominican/i.test(g.name||""));
  if(vac&&dr&&!dr.virtualId&&!dr.accountId)dr.virtualId=vac.id;
  s.settings.virtualsSeeded=true;
}
// Resolve a source token ("savings" | "chequing" | account id) to a real account.
export function resolveSource(tok){
  const A=ctx.S.bank.accounts||[];
  if(tok==="savings")return A.find(a=>/saving/i.test(a.subtype||a.name||""))||null;
  if(tok==="chequing")return A.find(a=>/check|chequ/i.test(a.subtype||a.name||""))||A.find(a=>!isCredit(a))||null;
  return A.find(a=>a.id===tok)||null;
}
// How much of each virtual is held in each real account.
function allocations(){
  const by={};
  for(const v of ctx.S.virtuals||[]){
    const logged={};let L=0;
    for(const e of v.log||[])if(e.type==="contribution"&&e.accountId){logged[e.accountId]=(logged[e.accountId]||0)+e.amount;L+=e.amount;}
    const first=(v.rule.sources||[]).map(resolveSource).find(Boolean);
    const diff=(Number(v.amount)||0)-L;
    if(first&&Math.abs(diff)>0.004)logged[first.id]=(logged[first.id]||0)+diff;
    for(const [k,x] of Object.entries(logged))by[k]=(by[k]||0)+x;
  }
  return by;
}
export function freeBalance(acct){return accountBalance(acct)-(allocations()[acct.id]||0);}
export function allocatedIn(acct){return allocations()[acct.id]||0;}

function dueDate(mk,day){const [y,m]=mk.split("-").map(Number);const dim=new Date(y,m,0).getDate();return `${mk}-${pad(Math.min(day,dim))}`;}
// Amount a contribution would be on a date, given current amount (respects cap/end).
export function contribAmount(v,date,current){
  const r=v.rule||{};if(!(r.amount>0))return 0;if(r.endDate&&date>r.endDate)return 0;
  let a=Number(r.amount);if(r.cap)a=Math.min(a,Math.max(0,Number(r.cap)-current));return Math.round(a*100)/100;
}
export function pickSource(v,amt,freeMap){
  const srcs=(v.rule.sources||[]).map(resolveSource).filter(Boolean);
  return srcs.find(a=>(freeMap?freeMap[a.id]:freeBalance(a))>=amt)||srcs[srcs.length-1]||null;
}
// Idempotent: one contribution per virtual per month, keyed by month. Returns count applied.
export function applyDue(){
  const today=todayISO();let n=0;
  for(const v of ctx.S.virtuals||[]){
    const r=v.rule||{};if(!(r.amount>0)||!r.day)continue;
    v.log=v.log||[];
    let mk=(v.created||today).slice(0,7),guard=0;
    while(mk<=today.slice(0,7)&&guard++<60){
      const d=dueDate(mk,r.day),key=v.id+":"+mk;
      if(d<=today&&d>=(v.created||"")&&!v.log.some(e=>e.key===key)){
        const amt=contribAmount(v,d,Number(v.amount)||0);
        if(amt>0){const src=pickSource(v,amt);v.amount=Math.round(((Number(v.amount)||0)+amt)*100)/100;v.log.push({key,type:"contribution",date:d,amount:amt,accountId:src?src.id:"",accountName:src?src.name:"(no source)",at:Date.now()});n++;}
        else v.log.push({key,type:"skipped",date:d,amount:0,at:Date.now()});
      }
      mk=addMonths(mk+"-01",1).slice(0,7);
    }
    if(v.log.length>200)v.log=v.log.slice(-200);
  }
  return n;
}
// Future contributions in [from,to], simulated in order (for the forecast).
export function upcoming(from,to){
  const out=[];const free={};(ctx.S.bank.accounts||[]).forEach(a=>free[a.id]=freeBalance(a));
  const cur={};(ctx.S.virtuals||[]).forEach(v=>cur[v.id]=Number(v.amount)||0);
  let mk=from.slice(0,7),g=0;
  while(mk<=to.slice(0,7)&&g++<24){
    for(const v of ctx.S.virtuals||[]){const r=v.rule||{};if(!(r.amount>0)||!r.day)continue;const d=dueDate(mk,r.day);
      if(d<=from||d>to||v.log?.some(e=>e.key===v.id+":"+mk))continue;
      const amt=contribAmount(v,d,cur[v.id]);if(amt<=0)continue;const src=pickSource(v,amt,free);
      cur[v.id]+=amt;if(src)free[src.id]-=amt;out.push({date:d,amount:amt,virtual:v.name,accountId:src?.id||"",accountName:src?.name||""});}
    mk=addMonths(mk+"-01",1).slice(0,7);
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
// Sync override: [{id?,name?,amount}] sets current amounts only.
export function applyOverride(list){
  let n=0;for(const o of list||[]){const v=(ctx.S.virtuals||[]).find(x=>(o.id&&x.id===o.id)||(o.name&&x.name.toLowerCase()===String(o.name).toLowerCase()));
    if(v&&Number.isFinite(Number(o.amount ?? o.currentAmount))){const a=Number(o.amount ?? o.currentAmount);v.log=v.log||[];v.log.push({type:"override",date:todayISO(),amount:a-(Number(v.amount)||0),at:Date.now()});v.amount=a;n++;}}
  return n;
}
