// Account re-link reconciliation (no imports, so it is unit-testable).
// When a bank is re-linked, the provider issues new account IDs. Match an incoming account
// that has no ID match by last-4 mask + type (+ institution when both sides have one),
// then move the old account, its transactions and any links over to the new ID.
const kind=a=>{const t=String(a.type||"").toLowerCase(),s=String(a.subtype||"").toLowerCase();
  return t==="credit"||/credit/.test(s)?"credit":t==="loan"?"loan":t==="investment"?"investment":(t||"depository");};
const inst=a=>String(a.institution||a.institutionId||a.institution_id||"").toLowerCase();
export function findRelinked(existing,incoming,incomingIds){
  const m=String(incoming.mask||"");if(!m)return -1;
  const cands=existing.map((x,i)=>[x,i]).filter(([x])=>!incomingIds.has(x.id)&&String(x.mask||"")===m&&kind(x)===kind(incoming)&&
    (!inst(x)||!inst(incoming)||inst(x)===inst(incoming)));
  return cands.length===1?cands[0][1]:-1; // ambiguous or none: never guess
}
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
export const txKey=t=>`${t.accountId}|${t.date}|${Math.round(Number(t.amount)*100)}|${norm(t.merchant)}`;
// Re-point everything from oldId to newId. Returns count of moved transactions.
export function repoint(S,oldId,newId){
  const B=S.bank;let n=0;
  for(const t of B.transactions)if(t.accountId===oldId){t.accountId=newId;n++;}
  if(S.settings&&S.settings.primaryAccountId===oldId)S.settings.primaryAccountId=newId;
  for(const g of S.goals||[])if(g.accountId===oldId)g.accountId=newId;
  for(const a of S.adjustments||[])if(a.accountId===oldId)a.accountId=newId;
  for(const v of S.virtuals||[]){const r=v.rule;if(r&&Array.isArray(r.sources))r.sources=r.sources.map(x=>x===oldId?newId:x);}
  return n;
}
// Remove existing transactions that are the same as an incoming one with a different ID.
export function dropRelinkedDupes(B,incomingTx,movedIds){
  const inIds=new Set(incomingTx.map(t=>String(t.id)));
  const inKeys=new Set(incomingTx.map(txKey));
  const before=B.transactions.length;
  B.transactions=B.transactions.filter(t=>inIds.has(t.id)||!movedIds.has(t.accountId)||!inKeys.has(txKey(t)));
  return before-B.transactions.length;
}
// Accounts the user removed from Stack: imports skip any account whose last-4 mask is listed here.
export const ignoredMasks=S=>new Set(((S.settings&&S.settings.ignoredMasks)||[]).map(String));
// Remove an account, its transactions and any links to it. With remember=true its mask is ignored on future imports.
export function removeAccount(S,id,remember=true){
  const B=S.bank,a=B.accounts.find(x=>x.id===id);if(!a)return 0;
  B.accounts=B.accounts.filter(x=>x.id!==id);
  const before=B.transactions.length;B.transactions=B.transactions.filter(t=>t.accountId!==id);
  if(S.settings.primaryAccountId===id)S.settings.primaryAccountId="";
  for(const g of S.goals||[])if(g.accountId===id)g.accountId="";
  S.adjustments=(S.adjustments||[]).filter(x=>x.accountId!==id);
  for(const v of S.virtuals||[]){const r=v.rule;if(r&&Array.isArray(r.sources))r.sources=r.sources.filter(x=>x!==id);}
  if(remember&&a.mask){const L=S.settings.ignoredMasks||(S.settings.ignoredMasks=[]);if(!L.includes(String(a.mask)))L.push(String(a.mask));}
  return before-B.transactions.length;
}
