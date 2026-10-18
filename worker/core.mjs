// Shared import for the box worker: runs the exact same code as the app (js/sync.js + js/match.js + migrations).
globalThis.location??={search:"",href:"http://worker/"};
if(!globalThis.localStorage){const m={};globalThis.localStorage={getItem:k=>m[k]??null,setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];}};}
const store=await import("../js/store.js");const sync=await import("../js/sync.js");
// state: the stored stack/<uid>.state (or null); snapshot: same JSON Penny pastes on the Sync screen.
export function applySnapshot(state,snapshot){
  const {ctx,migrate,defaultState}=store;
  ctx.S=migrate(state?JSON.parse(JSON.stringify(state)):defaultState());ctx.demo=false;ctx.fbUser=null;ctx.fbDb=null;
  const r=sync.applyPayload(sync.parsePayload(typeof snapshot==="string"?snapshot:JSON.stringify(snapshot)));
  return {state:ctx.S,result:r};
}
