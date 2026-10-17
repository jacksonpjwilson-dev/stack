// Pure analysis over synced data. Convention: amount < 0 = money out, > 0 = money in.
import {ctx} from "./store.js";
import {todayISO,addDays,daysBetween,median,monthKey,addMonths} from "./util.js";
import {upcoming as upcomingVirtual} from "./virtuals.js";

export const CATS=[["Housing","#60a5fa"],["Groceries","#34d399"],["Dining","#fbbf24"],["Transport","#22d3ee"],["Gas","#f59e0b"],["Utilities","#a78bfa"],["Health","#fb7185"],["Entertainment","#f472b6"],["Shopping","#fb923c"],["Subscriptions","#818cf8"],["Travel","#2dd4bf"],["Education","#c084fc"],["Income","#3dd68c"],["Transfer","#6d8299"],["Fees","#ef7a8a"],["Other","#94a3b8"]];
export const catColor=c=>(CATS.find(x=>x[0]===c)||["","#94a3b8"])[1];
const KEYWORDS=[
  ["Groceries",/loblaw|no ?frills|sobeys|metro|food basics|freshco|walmart|costco|farm boy|zehrs|fortinos|grocery|superstore|longo/i],
  ["Dining",/tim hortons|starbucks|mcdonald|subway|a&w|wendy|pizza|uber ?eats|doordash|skip ?the|restaurant|cafe|coffee|burger|sushi|chipotle|popeyes|kfc|harvey/i],
  ["Gas",/petro[- ]?can|esso|shell|husky|pioneer|ultramar|circle k|mobil|chevron|costco gas|gas station|\bfuel|\bgas\b/i],
  ["Transport",/uber(?! ?eats)|lyft|presto|parking|transit|go ?transit|via rail|ttc/i],
  ["Subscriptions",/netflix|spotify|disney|crave|apple\.com|icloud|google \*|youtube|prime video|amazon prime|patreon|openai|chatgpt|adobe|microsoft|xbox|playstation|nintendo/i],
  ["Utilities",/hydro|enbridge|rogers|bell|telus|fido|koodo|virgin|freedom|internet|water|electric/i],
  ["Housing",/rent|mortgage|property|condo|landlord/i],
  ["Health",/pharma|shoppers drug|rexall|dental|clinic|physio|gym|goodlife|fit4less|planet fitness/i],
  ["Entertainment",/cineplex|ticketmaster|steam|bar |pub|bowling|concert/i],
  ["Shopping",/amazon|best buy|canadian tire|winners|h&m|zara|ikea|indigo|dollarama|sport chek|apple store/i],
  ["Travel",/air canada|westjet|sunwing|expedia|airbnb|hotel|booking\.com|flair|porter/i],
  ["Education",/osap|university|college|tuition|bookstore/i],
  ["Fees",/fee|interest charge|overdraft|nsf/i],
  ["Transfer",/transfer|e-transfer|etransfer|interac|tfr|payment - thank you|credit card payment/i],
  ["Income",/payroll|salary|direct dep|pay ?cheque|paycheque/i]
];
export const merchantKey=m=>String(m||"").toLowerCase().replace(/[#*]\s*\d+/g,"").replace(/\d{3,}/g,"").replace(/[^a-z& ]+/g," ").replace(/\s+/g," ").trim().slice(0,40)||"unknown";
const PLAID_MAP={FOOD_AND_DRINK:"Dining",GENERAL_MERCHANDISE:"Shopping",TRANSPORTATION:"Transport",TRAVEL:"Travel",RENT_AND_UTILITIES:"Utilities",ENTERTAINMENT:"Entertainment",MEDICAL:"Health",PERSONAL_CARE:"Health",LOAN_PAYMENTS:"Transfer",TRANSFER_IN:"Transfer",TRANSFER_OUT:"Transfer",INCOME:"Income",BANK_FEES:"Fees",HOME_IMPROVEMENT:"Shopping",GENERAL_SERVICES:"Other",GOVERNMENT_AND_NON_PROFIT:"Other"};
const PLAID_DETAILED=[[/GROCER/,"Groceries"],[/RESTAURANT|FAST_FOOD|COFFEE|BEER_WINE|VENDING|FOOD_AND_DRINK_OTHER/,"Dining"],[/TRANSPORTATION_GAS|GAS_STATION|FUEL/,"Gas"],[/SUBSCRIPTION|STREAMING/,"Subscriptions"]];
function normCat(c){if(!c)return "";const parts=(Array.isArray(c)?c:[c]).map(x=>String(x).trim());const s=parts[0];
  for(const p of [...parts].reverse()){const u=p.toUpperCase().replace(/[ &]+/g,"_");for(const [re,cat] of PLAID_DETAILED)if(re.test(u))return cat;}
  if(/^gas|fuel/i.test(parts[parts.length-1]))return "Gas";const hit=CATS.find(x=>x[0].toLowerCase()===s.toLowerCase());if(hit)return hit[0];if(PLAID_MAP[s.toUpperCase()])return PLAID_MAP[s.toUpperCase()];if(/grocer/i.test(s))return "Groceries";if(/restaurant|food|dining|coffee/i.test(s))return "Dining";if(/transfer/i.test(s))return "Transfer";if(/subscri/i.test(s))return "Subscriptions";return "";}
export function categoryOf(t){
  const S=ctx.S,k=merchantKey(t.merchant);
  if(S.merchantCats[k])return S.merchantCats[k];
  const c=normCat(t.category);if(c)return c;
  for(const [cat,re] of KEYWORDS)if(re.test(t.merchant||""))return cat;
  return t.amount>0?"Income":"Other";
}
export const txns=()=>ctx.S.bank.transactions||[];
export const isSpend=t=>t.amount<0&&categoryOf(t)!=="Transfer";
export const isIncome=t=>t.amount>0&&categoryOf(t)!=="Transfer";

export function accountBalance(a){
  const adj=(ctx.S.adjustments||[]).filter(x=>x.accountId===a.id).sort((x,y)=>y.at-x.at)[0];
  const synced=ctx.S.bank.lastSynced?Date.parse(ctx.S.bank.lastSynced):0;
  if(adj&&adj.at>synced)return Number(adj.balance)||0;
  return Number(a.currentBalance)||0;
}
export const isCredit=a=>/credit|loan/i.test((a.type||"")+" "+(a.subtype||""));
export function primaryAccount(){
  const A=ctx.S.bank.accounts||[];
  return A.find(a=>a.id===ctx.S.settings.primaryAccountId)||A.find(a=>/check|chequ/i.test(a.subtype||a.name||""))||A.find(a=>!isCredit(a))||null;
}
export function spendByCat(mk){const o={};txns().filter(t=>t.date.slice(0,7)===mk&&isSpend(t)).forEach(t=>{const c=categoryOf(t);o[c]=(o[c]||0)-t.amount;});return o;}
export function monthTotals(mk){let inn=0,out=0;txns().filter(t=>t.date.slice(0,7)===mk).forEach(t=>{if(isIncome(t))inn+=t.amount;else if(isSpend(t))out-=t.amount;});return {inn,out};}
export function topMerchants(mk,n=8){const o={};txns().filter(t=>t.date.slice(0,7)===mk&&isSpend(t)).forEach(t=>{const k=merchantKey(t.merchant);o[k]=o[k]||{name:t.merchant,total:0,count:0,cat:categoryOf(t)};o[k].total-=t.amount;o[k].count++;});return Object.values(o).sort((a,b)=>b.total-a.total).slice(0,n);}
export function prevMonth(mk){return addMonths(mk+"-15",-1).slice(0,7);}

// Recurring detection: same merchant, >=2 hits, regular spacing, similar amounts.
const PERIODS=[[7,2],[14,3],[15,3],[30,5],[91,10],[365,25]];
export function recurring(){
  const groups={};
  txns().filter(t=>!t.pending&&categoryOf(t)!=="Transfer").forEach(t=>{const k=(t.amount>0?"in:":"out:")+merchantKey(t.merchant);(groups[k]=groups[k]||[]).push(t);});
  const out=[],today=todayISO();
  for(const [k,list] of Object.entries(groups)){
    if(list.length<2)continue;
    list.sort((a,b)=>a.date.localeCompare(b.date));
    // collapse same-day dupes
    const L=list.filter((t,i)=>i===0||t.date!==list[i-1].date);
    if(L.length<2)continue;
    const gaps=L.slice(1).map((t,i)=>daysBetween(L[i].date,t.date));
    const g=median(gaps);
    const p=PERIODS.find(([d,tol])=>Math.abs(g-d)<=tol);
    if(!p)continue;
    if(gaps.some(x=>Math.abs(x-g)>p[1]*2))continue;
    const amts=L.map(t=>Math.abs(t.amount)),med=median(amts);
    const tolAmt=k.startsWith("in:")?0.35:0.3;
    if(amts.filter(a=>Math.abs(a-med)<=med*tolAmt).length<Math.ceil(L.length*0.6))continue;
    const last=L[L.length-1],prev=L[L.length-2];
    const period=p[0]===15?15:g;
    const lastAmt=Math.abs(last.amount),prevAmt=Math.abs(prev.amount);
    if(daysBetween(last.date,today)>period*2+p[1])continue; // lapsed
    out.push({key:k,type:k.startsWith("in:")?"income":"charge",merchant:last.merchant,category:categoryOf(last),amount:lastAmt,avg:med,period:Math.round(period),count:L.length,last:last.date,next:addDays(last.date,Math.round(period)),accountId:last.accountId,
      isNew:daysBetween(L[0].date,today)<=45,increased:lastAmt>prevAmt*1.05&&lastAmt-prevAmt>=1,prevAmount:prevAmt});
  }
  return out.sort((a,b)=>b.amount-a.amount);
}
export const periodLabel=d=>d<=8?"weekly":d<=16?(d===15?"twice a month":"every 2 weeks"):d<=35?"monthly":d<=100?"quarterly":"yearly";
export function monthlyCost(r){return r.amount*(30.44/r.period);}

// Forecast primary (chequing) account over N days.
export function forecast(days=60){
  const acct=primaryAccount();if(!acct)return null;
  const rec=recurring();
  const net=!!ctx.S.settings.netCredit,cards=(ctx.S.bank.accounts||[]).filter(isCredit),cardIds=new Set(cards.map(a=>a.id));
  const inScope=id=>!id||id===acct.id||(net&&cardIds.has(id));
  const scoped=rec.filter(r=>inScope(r.accountId));
  if(!scoped.some(r=>r.type==="income"))scoped.push(...manualStreams());
  const events=[],today=todayISO(),end=addDays(today,days);
  for(const r of scoped){let d=r.next;let guard=0;while(d<=today&&guard++<50)d=stepDate(r,d);while(d<=end&&guard++<200){events.push({date:d,amount:r.type==="income"?r.amount:-r.amount,name:r.merchant,type:r.type});d=stepDate(r,d);}}
  for(const c of upcomingVirtual(today,end))if(c.accountId===acct.id)events.push({date:c.date,amount:-c.amount,name:"→ "+c.virtual+" (virtual)",type:"virtual"});
  events.sort((a,b)=>a.date.localeCompare(b.date));
  // everyday (non-recurring) outflow from this account, incl. card payments/transfers, averaged over 60 days
  const recKeys=new Set(scoped.map(r=>merchantKey(r.merchant)));const since=addDays(today,-60);
  // with net-credit on, card spending counts here and card payments from chequing are skipped (no double count)
  const hist=txns().filter(t=>t.amount<0&&t.date>since&&!recKeys.has(merchantKey(t.merchant))&&(t.accountId===acct.id?!(net&&categoryOf(t)==="Transfer"):(net&&cardIds.has(t.accountId)&&categoryOf(t)!=="Transfer")));
  const daily=hist.reduce((s,t)=>s-t.amount,0)/60;
  const owed=net?cards.reduce((s,a)=>s+Math.abs(accountBalance(a)),0):0;
  let bal=chequingFree(acct)-owed;const start=bal,pts=[{date:today,bal}];let min={date:today,bal};
  let i=0;for(let n=1;n<=days;n++){const d=addDays(today,n);bal-=daily;while(i<events.length&&events[i].date===d){bal+=events[i].amount;i++;}pts.push({date:d,bal});if(bal<min.bal)min={date:d,bal};}
  const nextPay=events.find(e=>e.type==="income");
  const balAtPay=nextPay?pts.find(p=>p.date===addDays(nextPay.date,-1))?.bal??start:null;
  const low=Number(ctx.S.settings.lowBalance)||0;
  const firstLow=pts.find(p=>p.bal<low);
  return {acct,net,owed,daily,start,pts,events,min,nextPay,balAtPay,firstLow,low,end:bal,incomeStreams:scoped.filter(r=>r.type==="income")};
}
// Manual pay schedule (Settings) used until auto-detection finds a pattern.
const FREQ={weekly:7,biweekly:14,semimonthly:15,monthly:30};
export function manualStreams(){return (ctx.S.settings.paySchedule||[]).filter(j=>Number(j.amount)>0&&j.next&&FREQ[j.frequency]).map(j=>({type:"income",manual:true,merchant:j.name||"Pay",category:"Income",amount:Number(j.amount),period:FREQ[j.frequency],monthly:j.frequency==="monthly",next:j.next,accountId:""}));}
export const stepDate=(r,d)=>r.monthly?addMonths(d,1):addDays(d,r.period);
export function incomeStreams(){const det=recurring().filter(r=>r.type==="income");return det.length?det:manualStreams();}
export function paychequesBetween(a,b){
  const inc=incomeStreams();if(!inc.length)return null;
  const main=[...inc].sort((x,y)=>monthlyCost(y)-monthlyCost(x))[0];let d=main.next,n=0,g=0;while(d<=a&&g++<100)d=stepDate(main,d);while(d<=b&&g++<400){n++;d=stepDate(main,d);}return {n,stream:main};
}

// Weekly summary + unusual charges.
export function weekly(){
  const today=todayISO(),from=addDays(today,-7);
  const wk=txns().filter(t=>t.date>from&&t.date<=today);
  let inn=0,out=0;wk.forEach(t=>{if(isIncome(t))inn+=t.amount;else if(isSpend(t))out-=t.amount;});
  const hist=txns().filter(t=>isSpend(t)&&t.date<=from);
  const byCat={};hist.forEach(t=>{const c=categoryOf(t);(byCat[c]=byCat[c]||[]).push(-t.amount);});
  const large=wk.filter(isSpend).filter(t=>{const a=-t.amount,h=byCat[categoryOf(t)]||[];return h.length>=3?(a>median(h)*3&&a>=75):a>=250;});
  const dupes=[];const sp=txns().filter(t=>isSpend(t)&&t.date>addDays(today,-14)).sort((a,b)=>a.date.localeCompare(b.date));
  for(let i=0;i<sp.length;i++)for(let j=i+1;j<sp.length;j++){const a=sp[i],b=sp[j];if(daysBetween(a.date,b.date)>2)break;if(a.id!==b.id&&a.amount===b.amount&&merchantKey(a.merchant)===merchantKey(b.merchant)&&!a.pending&&!b.pending)dupes.push([a,b]);}
  return {inn,out,large,dupes,count:wk.length};
}
export const budgetCats=b=>Array.isArray(b.categories)&&b.categories.length?b.categories:(b.category?[b.category]:[]);
export function budgetRows(mk=monthKey()){const s=spendByCat(mk);return (ctx.S.budgets||[]).map(b=>({...b,cats:budgetCats(b),spent:budgetCats(b).reduce((t,c)=>t+(s[c]||0),0)}));}

import {freeBalance} from "./virtuals.js";
export function chequingFree(acct){return freeBalance(acct);}
export function cardsOwed(){return (ctx.S.bank.accounts||[]).filter(isCredit).reduce((s,a)=>s+Math.abs(accountBalance(a)),0);}
