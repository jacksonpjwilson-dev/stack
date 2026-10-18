// Run: node tests/refresh.test.mjs  (no network, no secrets: fake Firestore doc + temp handoff dir)
import fs from "node:fs";import os from "node:os";import path from "node:path";import assert from "node:assert/strict";
const {canRequest,newRequest,refreshLabel,THROTTLE_MS}=await import("../js/refresh.js");
const {pass,fakeDoc}=await import("../worker/refresh-worker.mjs");
let n=0;const t=async(name,f)=>{await f();n++;console.log("ok -",name);};
const T=Date.parse("2026-10-18T20:00:00Z");
await t("throttle 5 min",()=>{const r=newRequest(T);assert.equal(canRequest(r,T+60e3).ok,false);assert.equal(canRequest(r,T+THROTTLE_MS+1).ok,true);assert.equal(canRequest(null).ok,true);});
await t("labels",()=>{const r=newRequest(T);assert.equal(refreshLabel(r,"2026-10-18T19:00:00Z",T+1000),"Refresh requested…");
  assert.match(refreshLabel(r,"2026-10-18T20:01:00Z",T+90e3),/^Updated /);assert.match(refreshLabel({...r,status:"done",doneAt:T+5e4},null,T+6e4),/^Updated /);
  assert.match(refreshLabel({...r,status:"error",error:"x"},null,T),/failed/);assert.match(refreshLabel(r,null,T+21*60e3),/timed out/);});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"sr-")),dbf=path.join(dir,"doc.json");const doc=fakeDoc(dbf);const q=()=>{};
const state={schema:3,settings:{ignoredMasks:["7685"],fix3Drop7685:true},bank:{lastSynced:"2026-10-17T00:00:00Z",accounts:[{id:"old-a",name:"Chequing",mask:"4276",type:"depository",currentBalance:1}],transactions:[{id:"t1",date:"2026-10-10",amount:-5,merchant:"Shop",accountId:"old-a"}],imports:[]},goals:[{id:"g",accountId:"old-a"}]};
fs.writeFileSync(dbf,JSON.stringify({state,updatedAt:1}));
await t("idle with no request",async()=>assert.equal(await pass(doc,dir,q),"idle"));
await t("pending -> claimed + request file",async()=>{const r=newRequest(Date.now());await doc.update({refreshRequest:r});assert.equal(await pass(doc,dir,q),"claimed");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,"request.json"))).id,r.id);assert.equal((await doc.get()).refreshRequest.status,"claimed");assert.equal(await pass(doc,dir,q),"waiting");});
await t("snapshot applied with relink + ignore, marked done",async()=>{const id=(await doc.get()).refreshRequest.id;
  fs.writeFileSync(path.join(dir,"snapshot.json"),JSON.stringify({requestId:id,payload:{lastSynced:"2026-10-18T21:00:00Z",
    accounts:[{id:"new-a",name:"Chequing",mask:"4276",type:"depository",currentBalance:2},{id:"new-s",name:"Saver",mask:"7685",type:"depository",currentBalance:0}],
    transactions:[{id:"t1",date:"2026-10-10",amount:-5,merchant:"Shop",accountId:"new-a"},{id:"t2",date:"2026-10-18",amount:-3,merchant:"Cafe",accountId:"new-a"},{id:"t3",date:"2026-10-18",amount:1,merchant:"Int",accountId:"new-s"}]}}));
  assert.equal(await pass(doc,dir,q),"done");const d=await doc.get();
  assert.equal(d.refreshRequest.status,"done");assert.deepEqual(d.state.bank.accounts.map(a=>a.id),["new-a"]);assert.equal(d.state.bank.transactions.length,2);
  assert.equal(d.state.goals.find(g=>g.id==="g").accountId,"new-a");assert.equal(d.state.bank.lastSynced,"2026-10-18T21:00:00Z");assert.ok(!fs.existsSync(path.join(dir,"request.json")));});
await t("Penny error -> error",async()=>{await doc.update({refreshRequest:{...newRequest(Date.now()),status:"claimed",claimedAt:Date.now()}});const id=(await doc.get()).refreshRequest.id;
  fs.writeFileSync(path.join(dir,"snapshot.json"),JSON.stringify({requestId:id+":error",error:"Plaid down"}));assert.equal(await pass(doc,dir,q),"error");assert.equal((await doc.get()).refreshRequest.error,"Plaid down");});
await t("timeout after 20 min",async()=>{await doc.update({refreshRequest:{id:"rx",at:Date.now()-30*60e3,status:"claimed",claimedAt:Date.now()-25*60e3}});assert.equal(await pass(doc,dir,q),"timeout");});
await t("stale snapshot for another request ignored",async()=>{await doc.update({refreshRequest:{id:"ry",at:Date.now(),status:"claimed",claimedAt:Date.now()}});
  fs.writeFileSync(path.join(dir,"snapshot.json"),JSON.stringify({requestId:"old",payload:{accounts:[],transactions:[],virtualAccounts:[]}}));assert.equal(await pass(doc,dir,q),"waiting");});
console.log(`\n${n} passed`);
