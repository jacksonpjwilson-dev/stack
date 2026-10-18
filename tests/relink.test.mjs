// Run: node tests/relink.test.mjs  (simulates a BMO re-link with new account IDs)
// Real data stays OUT of the repo: uses ../../stack-sync.json and ../../stack-relink-ids.json when present,
// otherwise a synthetic fixture. No balances or real account IDs are committed.
import fs from "node:fs";import assert from "node:assert/strict";
globalThis.location={search:"",href:"http://x/"};const mem={};globalThis.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>mem[k]=v,removeItem:k=>delete mem[k]};
const {ctx,migrate,defaultState}=await import("../js/store.js");const {applyPayload,parsePayload}=await import("../js/sync.js");
const {removeAccount}=await import("../js/match.js");
const rd=f=>{try{return JSON.parse(fs.readFileSync(new URL("../../"+f,import.meta.url)));}catch(e){return null;}};
const SYN={lastSynced:"2026-10-01T00:00:00Z",accounts:[
  {id:"old-a",name:"Chequing",mask:"4276",type:"depository",subtype:"checking",currentBalance:100},
  {id:"old-b",name:"Savings",mask:"5838",type:"depository",subtype:"savings",currentBalance:50},
  {id:"old-c",name:"Saver",mask:"7685",type:"depository",subtype:"savings",currentBalance:0},
  {id:"old-d",name:"Card",mask:"0670",type:"credit",subtype:"credit card",currentBalance:10}],
  transactions:[{id:"t1",date:"2026-09-29",amount:1,merchant:"CREDIT",accountId:"old-b"},{id:"t2",date:"2026-09-28",amount:-5,merchant:"Shop",accountId:"old-a"},
    {id:"t3",date:"2026-09-27",amount:-2,merchant:"Cafe",accountId:"old-d"},{id:"t4",date:"2026-09-26",amount:0.1,merchant:"Int",accountId:"old-c"}]};
const real0=rd("stack-sync.json");
// The local snapshot may already carry the newest IDs (Penny refreshes it), so derive "pre-relink" IDs from it.
const real=real0&&{...real0,accounts:real0.accounts.map(a=>({...a,id:"old-"+a.id})),transactions:real0.transactions.map(x=>({...x,accountId:"old-"+x.accountId}))};
const old=real||SYN;
const NEW=rd("stack-relink-ids.json")||{"4276":"new-a","5838":"new-b","7685":"new-c","0670":"new-d","7846":"new-e"};
console.log("fixture:",real?"local real snapshot":"synthetic");
const fresh=()=>migrate(defaultState());
let pass=0;const t=(n,f)=>{f();pass++;console.log("ok -",n);};
const keep=a=>a.mask!=="7685";
for(const mode of ["sameTxIds","newTxIds"]){
  ctx.S=fresh();applyPayload(parsePayload(JSON.stringify(old)));
  const oldChq=old.accounts.find(a=>a.mask==="4276").id,oldSav=old.accounts.find(a=>a.mask==="5838").id,oldCard=old.accounts.find(a=>a.mask==="0670").id;
  ctx.S.settings.primaryAccountId=oldChq;ctx.S.goals.push({id:"g1",name:"Emergency",accountId:oldSav});
  ctx.S.virtuals.push({id:"v1",name:"X",amount:0,rule:{sources:[oldChq,"savings"]},log:[]});
  const idMap=Object.fromEntries(old.accounts.map(a=>[a.id,NEW[a.mask]]));
  const imp={lastSynced:"2026-10-18T20:30:00Z",
    accounts:[...old.accounts.map(a=>({...a,id:NEW[a.mask]})),{id:NEW["7846"],name:"Primary Chequing Account",mask:"7846",type:"depository",subtype:"checking",currentBalance:1,availableBalance:0}],
    transactions:old.transactions.map(x=>({...x,id:mode==="newTxIds"?"n-"+x.id:x.id,accountId:idMap[x.accountId]||x.accountId}))};
  const r=applyPayload(parsePayload(JSON.stringify(imp)));const B=ctx.S.bank;
  const expTx=imp.transactions.filter(x=>x.accountId!==NEW["7685"]);
  t(mode+": no duplicate accounts, 7685 skipped, 7846 added",()=>{assert.deepEqual(B.accounts.map(a=>a.mask).sort(),["0670","4276","5838","7846"]);assert.equal(r.accountsRelinked,old.accounts.filter(keep).length);assert.equal(r.accountsAdded,1);});
  t(mode+": no duplicate transactions",()=>{assert.equal(B.transactions.length,expTx.length);assert.equal(new Set(B.transactions.map(x=>x.id)).size,B.transactions.length);});
  t(mode+": totals match import",()=>{const s=L=>Math.round(L.reduce((a,x)=>a+Number(x.currentBalance||0),0)*100);assert.equal(s(B.accounts),s(imp.accounts.filter(keep)));
    const tx=L=>Math.round(L.reduce((a,x)=>a+Number(x.amount),0)*100);assert.equal(tx(B.transactions),tx(expTx));});
  t(mode+": links moved",()=>{assert.equal(ctx.S.settings.primaryAccountId,NEW["4276"]);assert.equal(ctx.S.goals.find(g=>g.id==="g1").accountId,NEW["5838"]);
    assert.deepEqual(ctx.S.virtuals.find(v=>v.id==="v1").rule.sources,[NEW["4276"],"savings"]);
    const ids=new Set(B.accounts.map(a=>a.id));assert.ok(B.transactions.every(x=>ids.has(x.accountId)));assert.ok(!ids.has(oldChq)&&!ids.has(oldCard));});
  t(mode+": 4276 and 7846 stay separate",()=>{assert.notEqual(B.accounts.find(a=>a.mask==="4276").id,B.accounts.find(a=>a.mask==="7846").id);});
}
t("migration removes existing 7685 and ignores it",()=>{const s=defaultState();s.bank.accounts=old.accounts.map(a=>({...a}));s.bank.transactions=old.transactions.map(x=>({...x}));
  const id7=old.accounts.find(a=>a.mask==="7685")?.id||"x7";if(!old.accounts.some(a=>a.mask==="7685")){s.bank.accounts.push({id:id7,mask:"7685",type:"depository"});s.bank.transactions.push({id:"tx7",date:"2026-10-01",amount:1,merchant:"I",accountId:id7});}s.settings.primaryAccountId=id7;const m=migrate(s);
  assert.ok(!m.bank.accounts.some(a=>a.mask==="7685"));assert.ok(!m.bank.transactions.some(x=>x.accountId===id7));assert.deepEqual(m.settings.ignoredMasks,["7685"]);assert.equal(m.settings.primaryAccountId,"");
  const n=m.bank.accounts.length;const m2=migrate(m);assert.equal(m2.bank.accounts.length,n);});
t("removeAccount + ignore skips future imports",()=>{ctx.S=fresh();applyPayload(parsePayload(JSON.stringify(old)));const a=ctx.S.bank.accounts.find(x=>x.mask==="0670");
  removeAccount(ctx.S,a.id,true);const r=applyPayload(parsePayload(JSON.stringify(old)));assert.ok(!ctx.S.bank.accounts.some(x=>x.mask==="0670"));assert.ok(!ctx.S.bank.transactions.some(x=>x.accountId===a.id));assert.ok(r.accountsSkipped>=1);});
t("ambiguous mask never merges",()=>{ctx.S=fresh();ctx.S.bank.accounts=[{id:"a",mask:"1111",type:"depository"},{id:"b",mask:"1111",type:"depository"}];
  const r=applyPayload(parsePayload(JSON.stringify({accounts:[{id:"c",mask:"1111",type:"depository"}],transactions:[]})));assert.equal(r.accountsRelinked,0);assert.equal(ctx.S.bank.accounts.length,3);});
t("different type never merges",()=>{ctx.S=fresh();ctx.S.bank.accounts=[{id:"a",mask:"2222",type:"depository"}];
  const r=applyPayload(parsePayload(JSON.stringify({accounts:[{id:"c",mask:"2222",type:"credit"}],transactions:[]})));assert.equal(r.accountsRelinked,0);});
t("different mask never merges",()=>{ctx.S=fresh();ctx.S.bank.accounts=[{id:"a",mask:"3333",type:"depository"}];
  const r=applyPayload(parsePayload(JSON.stringify({accounts:[{id:"c",mask:"4444",type:"depository"}],transactions:[]})));assert.equal(r.accountsRelinked,0);assert.equal(ctx.S.bank.accounts.length,2);});
t("re-import with same IDs is idempotent",()=>{ctx.S=fresh();applyPayload(parsePayload(JSON.stringify(old)));const r=applyPayload(parsePayload(JSON.stringify(old)));assert.equal(r.accountsRelinked,0);assert.equal(r.added,0);assert.equal(ctx.S.bank.accounts.length,old.accounts.filter(keep).length);});
console.log(`\n${pass} passed`);
