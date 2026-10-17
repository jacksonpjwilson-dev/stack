// Bulk import of a bank snapshot pasted by the Stack Finance bot (or the user).
import {ctx,save,pushCloud} from "./store.js";
import {applyOverride,applyDue} from "./virtuals.js";
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||""));
export function parsePayload(text){
  let p;try{p=JSON.parse(String(text||"").trim());}catch(e){throw new Error("Not valid JSON: "+e.message);}
  if(!p||typeof p!=="object")throw new Error("Expected a JSON object");
  const accounts=Array.isArray(p.accounts)?p.accounts:[],transactions=Array.isArray(p.transactions)?p.transactions:[];
  if(!accounts.length&&!transactions.length&&!Array.isArray(p.virtualAccounts))throw new Error("No accounts or transactions found");
  const errs=[];
  accounts.forEach((a,i)=>{if(!a||!a.id)errs.push(`accounts[${i}] missing id`);});
  transactions.forEach((t,i)=>{if(!t||!t.id)errs.push(`transactions[${i}] missing id`);else{if(!isDate(t.date))errs.push(`transactions[${i}] date must be YYYY-MM-DD`);if(!Number.isFinite(Number(t.amount)))errs.push(`transactions[${i}] amount not a number`);}});
  if(errs.length)throw new Error(errs.slice(0,6).join("; ")+(errs.length>6?` (+${errs.length-6} more)`:""));
  return {lastSynced:p.lastSynced||new Date().toISOString(),accounts,transactions,virtualAccounts:Array.isArray(p.virtualAccounts)?p.virtualAccounts:[],flip:p.amountSign==="positive-outflow"};
}
export function applyPayload(p){
  const B=ctx.S.bank;const r={accountsUpdated:0,accountsAdded:0,added:0,updated:0,unchanged:0};
  for(const a of p.accounts){
    const rec={id:String(a.id),name:a.name||"Account",mask:a.mask?String(a.mask):"",type:a.type||"",subtype:a.subtype||"",
      currentBalance:Number(a.currentBalance)||0,availableBalance:a.availableBalance==null?null:Number(a.availableBalance)};
    const i=B.accounts.findIndex(x=>x.id===rec.id);
    if(i>=0){B.accounts[i]={...B.accounts[i],...rec};r.accountsUpdated++;}else{B.accounts.push(rec);r.accountsAdded++;}
  }
  const idx=new Map(B.transactions.map((t,i)=>[t.id,i]));
  for(const t of p.transactions){
    let amt=Number(t.amount);if(p.flip)amt=-amt;
    const rec={id:String(t.id),date:String(t.date),amount:Math.round(amt*100)/100,merchant:String(t.merchant||t.name||"Unknown"),category:t.category??"",accountId:t.accountId?String(t.accountId):"",pending:!!t.pending};
    if(t.pendingTransactionId)rec.pendingTransactionId=String(t.pendingTransactionId);
    if(idx.has(rec.id)){
      const i=idx.get(rec.id),old=B.transactions[i];
      if(JSON.stringify(old)===JSON.stringify({...old,...rec}))r.unchanged++;
      else{B.transactions[i]={...old,...rec};r.updated++;}
    }else{
      // posted version of a pending one: replace by pendingTransactionId link
      const pi=rec.pendingTransactionId&&idx.has(rec.pendingTransactionId)?idx.get(rec.pendingTransactionId):-1;
      if(pi>=0){idx.delete(rec.pendingTransactionId);B.transactions[pi]=rec;idx.set(rec.id,pi);r.updated++;}
      else{B.transactions.push(rec);idx.set(rec.id,B.transactions.length-1);r.added++;}
    }
  }
  // drop stale pendings superseded by a posted txn (same account/merchant/amount within 5 days), when posted arrives with a new id
  const posted=B.transactions.filter(t=>!t.pending);
  const before=B.transactions.length;
  B.transactions=B.transactions.filter(t=>{if(!t.pending)return true;const stillSent=p.transactions.some(x=>String(x.id)===t.id);if(stillSent)return true;
    return !posted.some(q=>q.accountId===t.accountId&&Math.abs(q.amount-t.amount)<0.01&&q.merchant.toLowerCase()===t.merchant.toLowerCase()&&Math.abs(Date.parse(q.date)-Date.parse(t.date))<=5*864e5);});
  r.pendingResolved=before-B.transactions.length;
  B.transactions.sort((a,b)=>b.date.localeCompare(a.date));
  B.lastSynced=p.lastSynced;
  r.contributionsApplied=applyDue();r.virtualsOverridden=applyOverride(p.virtualAccounts);
  B.imports=[{at:Date.now(),lastSynced:p.lastSynced,...r},...(B.imports||[])].slice(0,20);
  return r;
}
export async function runSync(text){
  const p=parsePayload(text);const r=applyPayload(p);save();
  const cloud=ctx.demo?"demo (not saved)":ctx.fbUser?((await pushCloud())?"saved to cloud":"cloud save FAILED, kept on this device"):"saved on this device only (not signed in)";
  return {...r,cloud};
}
