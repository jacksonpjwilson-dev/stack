#!/usr/bin/env node
// Stack "Refresh from BMO" worker. Run one pass every ~3 min (cron/systemd timer):  node worker/refresh-worker.mjs
// Flow: app sets refreshRequest{status:"pending"} -> worker claims it and drops a request file for Penny ->
// Penny's routine pulls BMO via the Finance connector and writes snapshot.json -> worker applies it with the app's own
// import code and marks the request done (or error).
// Secrets are NEVER in the repo: STACK_SA_KEY = path to the Firebase service-account JSON (project stackapphtml), STACK_UID = Jackson's uid.
// Test mode: STACK_FAKE_DB=/path/doc.json uses a local JSON file as the Firestore doc (no network, no secrets).
import fs from "node:fs";import path from "node:path";
import {applySnapshot} from "./core.mjs";
export const DIR=process.env.STACK_REFRESH_DIR||"/home/box/shared/stack-refresh";
export const TIMEOUT_MS=20*60e3;
const now=()=>Date.now();
const rj=f=>{try{return JSON.parse(fs.readFileSync(f,"utf8"));}catch(e){return null;}};
const wj=(f,o)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f+".tmp",JSON.stringify(o,null,1));fs.renameSync(f+".tmp",f);};

// --- doc access: {get():data|null, update(fields)}; real = firebase-admin transaction-free updates (single writer) ---
export function fakeDoc(file){return {get:async()=>rj(file),update:async f=>{const d=rj(file)||{};wj(file,{...d,...f});}};}
const mustUid=()=>{const u=process.env.STACK_UID;if(!u)throw new Error("STACK_UID must be set");return u;};
// Key from STACK_SA_KEY_JSON (full JSON) or STACK_SA_KEY (path to a 600 file outside the repo). Never logged.
export async function adminDb(){
  const raw=process.env.STACK_SA_KEY_JSON,cred=raw?JSON.parse(raw):process.env.STACK_SA_KEY?rj(process.env.STACK_SA_KEY):null;
  if(!cred)throw new Error("STACK_SA_KEY_JSON or STACK_SA_KEY must be set");
  const admin=(await import("firebase-admin")).default;
  if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(cred),projectId:"stackapphtml"});
  return admin.firestore();
}
async function realDoc(){
  const ref=(await adminDb()).doc(process.env.STACK_DOC||("stack/"+mustUid()));
  return {get:async()=>{const s=await ref.get();return s.exists?s.data():null;},update:async f=>ref.update(f)};
}

export async function pass(doc,dir=DIR,log=console.log){
  const d=await doc.get();const r=d&&d.refreshRequest;
  if(!r||!["pending","claimed"].includes(r.status))return "idle";
  const reqFile=path.join(dir,"request.json"),snapFile=path.join(dir,"snapshot.json");
  if(r.status==="pending"){
    await doc.update({refreshRequest:{...r,status:"claimed",claimedAt:now()}});
    wj(reqFile,{id:r.id,at:r.at,requestedAt:new Date(r.at).toISOString(),writeSnapshotTo:snapFile});
    log("claimed",r.id);return "claimed";
  }
  const snap=rj(snapFile);
  if(snap&&snap.requestId===r.id){
    try{
      const {state,result}=applySnapshot(d.state,snap.payload||snap);
      const res={added:result.added,updated:result.updated,accountsRelinked:result.accountsRelinked,accountsAdded:result.accountsAdded,accountsSkipped:result.accountsSkipped};
      await doc.update({state,updatedAt:now(),refreshRequest:{...r,status:"done",doneAt:now(),result:res}});
      fs.renameSync(snapFile,path.join(dir,"done-"+r.id+".json"));fs.rmSync(reqFile,{force:true});
      log("done",r.id,JSON.stringify(res));return "done";
    }catch(e){await doc.update({refreshRequest:{...r,status:"error",doneAt:now(),error:String(e.message||e).slice(0,200)}});fs.rmSync(reqFile,{force:true});log("error",e.message);return "error";}
  }
  if(snap&&snap.requestId===r.id+":error"){await doc.update({refreshRequest:{...r,status:"error",doneAt:now(),error:String(snap.error||"bank pull failed").slice(0,200)}});fs.rmSync(snapFile,{force:true});fs.rmSync(reqFile,{force:true});return "error";}
  if(now()-(r.claimedAt||r.at)>TIMEOUT_MS){await doc.update({refreshRequest:{...r,status:"error",doneAt:now(),error:"No bank data within 20 min"}});fs.rmSync(reqFile,{force:true});return "timeout";}
  return "waiting";
}

if(import.meta.url===`file://${process.argv[1]}`){
  const doc=process.env.STACK_FAKE_DB?fakeDoc(process.env.STACK_FAKE_DB):await realDoc();
  const out=await pass(doc);if(out!=="idle")console.log(out);
  if(out!=="idle"&&out!=="waiting")fs.appendFileSync("/home/box/shared/crew/runs.jsonl",JSON.stringify({ts:new Date().toISOString(),bot:"Felix",routine:"stack-refresh-worker",status:out==="done"?"ok":out,note:"refresh request "+out})+"\n");
  process.exit(0);
}
