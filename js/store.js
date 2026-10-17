// State, migration, local + Firestore persistence (stack/<uid>, same as before).
import {uid} from "./util.js";
import {seedVirtuals} from "./virtuals.js";
export const KEY="finly.v2";
export const SCHEMA=3;
export const FIREBASE={
  apiKey:"AIzaSyDbu0afHoeESWJmoRBiEABdf5UzyzI0DRo",
  authDomain:"stackapphtml.firebaseapp.com",
  projectId:"stackapphtml",
  storageBucket:"stackapphtml.firebasestorage.app",
  messagingSenderId:"1038191511612",
  appId:"1:1038191511612:web:98be6b660a6062704d1b39",
  measurementId:"G-5SYSRZNGTV"
};
export const FB_LS="stack.fb.cfg";
export const ctx={S:null,view:"home",demo:/[?&]demo=1\b/.test(location.search),fbAuth:null,fbDb:null,fbUser:null,fbSkip:false,cloudMsg:""};

export function defaultState(){return{
  schema:SCHEMA,
  settings:{name:"",currency:"CAD",symbol:"$",theme:"dark",style:"vault",lowBalance:200,primaryAccountId:"",avatar:"",netCredit:true},
  bank:{lastSynced:null,accounts:[],transactions:[],imports:[]},
  merchantCats:{},   // merchant key -> category override
  budgets:[],        // {id,category,limit}
  goals:[],          // {id,name,target,saved,date,accountId,startBalance}
  debts:[],invest:[],
  adjustments:[],    // manual balance fallback {id,accountId,balance,at}
  virtuals:[]        // virtual accounts, see virtuals.js
};}

// Migrate any older shape without dropping data. Legacy arrays are kept under `legacy`.
export function migrate(raw){
  const s=defaultState();
  if(!raw||typeof raw!=="object")return seed(s);
  const legacyKeys=["jobs","bills","envelopes","income","spend","friends","accounts","transfers"];
  for(const k of Object.keys(raw)){ if(!legacyKeys.includes(k)&&k!=="settings")s[k]=raw[k]; }
  s.settings=Object.assign(defaultState().settings,raw.settings||{});
  s.bank=Object.assign(defaultState().bank,raw.bank||{});
  ["goals","debts","invest","budgets","adjustments","virtuals"].forEach(k=>{if(!Array.isArray(s[k]))s[k]=[];});
  s.merchantCats=s.merchantCats&&typeof s.merchantCats==="object"?s.merchantCats:{};
  s.legacy=Object.assign({},raw.legacy||{});
  for(const k of legacyKeys){ if(raw[k]!==undefined&&s.legacy[k]===undefined)s.legacy[k]=raw[k]; }
  if((raw.schema||0)<SCHEMA){
    s.legacy.migratedFrom=raw.schema||2; s.legacy.migratedAt=Date.now();
    // turn old pots into budgets where they had a category
    // pots -> budgets, but skip categories the seeded multi-category budgets (Food, Gas) already cover
    const seeded=["Groceries","Dining","Gas"];
    (raw.envelopes||[]).forEach(e=>{if(e&&e.category&&e.amount&&!seeded.includes(e.category)&&!s.budgets.some(b=>b.category===e.category))s.budgets.push({id:uid(),category:e.category,limit:Number(e.amount)||0});});
  }
  s.schema=SCHEMA;
  return seed(s);
}
function seed(s){
  // budgets: single category -> categories[]
  s.budgets.forEach(b=>{if(!Array.isArray(b.categories))b.categories=b.category?[b.category]:[];if(!b.name)b.name=b.categories.join(" + ")||"Budget";});
  if(!s.settings.budgetsV2Seeded){
    const has=n=>s.budgets.some(b=>(b.name||"").toLowerCase()===n.toLowerCase());
    if(!has("Food"))s.budgets.push({id:"budget-food",name:"Food",categories:["Groceries","Dining"],limit:400});
    if(!has("Gas"))s.budgets.push({id:"budget-gas",name:"Gas",categories:["Gas"],limit:300});
    s.settings.budgetsV2Seeded=true;
  }
  if(!s.settings.fix1Budgets){
    // drop single-category budgets fully covered by another multi-category budget (e.g. old "Groceries" pot vs Food)
    s.budgets=s.budgets.filter(b=>!(b.categories.length===1&&s.budgets.some(o=>o!==b&&o.categories.length>1&&o.categories.includes(b.categories[0]))));
    s.settings.fix1Budgets=true;
  }
  seedVirtuals(s);
  if(!s.settings.drGoalSeeded){
    if(!s.goals.some(g=>/dominican/i.test(g.name||"")))
      s.goals.push({id:"goal-dr-trip",name:"Dominican Republic trip",target:0,saved:0,date:"2026-12-28",accountId:""});
    s.settings.drGoalSeeded=true;
  }
  return s;
}

export function loadLocal(){
  if(ctx.demo)return null;
  let raw=null;try{raw=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem("finly.v1")||"null");}catch(e){}
  return migrate(raw);
}
let saveTimer=null;
export function save(){
  if(ctx.demo)return;
  localStorage.setItem(KEY,JSON.stringify(ctx.S));
  if(ctx.fbUser&&ctx.fbDb){clearTimeout(saveTimer);saveTimer=setTimeout(pushCloud,400);}
}
export async function pushCloud(){
  if(ctx.demo||!ctx.fbDb||!ctx.fbUser)return false;
  try{await ctx.fbDb.doc("stack/"+ctx.fbUser.uid).set({state:ctx.S,updatedAt:Date.now()});ctx.S._lastCloud=Date.now();ctx.cloudMsg="";return true;}
  catch(e){console.warn("push",e);ctx.cloudMsg="Cloud save failed: "+(e.message||e);return false;}
}
export async function pullCloud(){
  if(ctx.demo||!ctx.fbDb||!ctx.fbUser)return;
  try{
    const snap=await Promise.race([ctx.fbDb.doc("stack/"+ctx.fbUser.uid).get(),new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),8000))]);
    if(snap.exists&&snap.data().state){
      const before=JSON.stringify(snap.data().state);
      ctx.S=migrate(snap.data().state);
      localStorage.setItem(KEY,JSON.stringify(ctx.S));
      // one-time backup copy of the pre-migration doc inside the same user's doc tree
      if(!snap.data().state.schema||snap.data().state.schema<SCHEMA){
        try{await ctx.fbDb.doc("stack/"+ctx.fbUser.uid+"/backups/pre-v3").set({state:JSON.parse(before),at:Date.now()});}catch(e){console.warn("backup",e);}
        await pushCloud();
      }
    }else await pushCloud();
  }catch(e){console.warn("pull",e);ctx.cloudMsg="Could not load cloud data ("+(e.message||e)+")";}
}
export function fbConfig(){
  const ok=c=>c&&c.apiKey&&c.projectId;
  try{const x=JSON.parse(localStorage.getItem(FB_LS)||"null");if(ok(x))return x;}catch(e){}
  if(ok(ctx.S?.settings?.firebase))return ctx.S.settings.firebase;
  return FIREBASE;
}
