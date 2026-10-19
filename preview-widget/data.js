/* Stack widget-home preview — SAMPLE DATA ONLY.
   Everything here is made up and generated on the device. No bank connection, no Plaid, no real accounts. */
(function(){
'use strict';
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const today=()=>iso(new Date());
const CATS=[["Housing","#60a5fa"],["Groceries","#34d399"],["Dining","#fbbf24"],["Transport","#22d3ee"],["Gas","#f59e0b"],["Utilities","#a78bfa"],["Health","#fb7185"],["Entertainment","#f472b6"],["Shopping","#fb923c"],["Subscriptions","#818cf8"],["Travel","#2dd4bf"],["Education","#c084fc"],["Income","#3dd68c"],["Transfer","#6d8299"],["Fees","#ef7a8a"],["Other","#94a3b8"]];
// tiny deterministic RNG so the sample looks the same every load
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function build(){
  const t=today(),R=rng(20261019),tx=[];let n=0;
  const add=(date,amount,merchant,cat,acc='chq',pending=false)=>tx.push({id:'s'+(n++),date,amount:Math.round(amount*100)/100,merchant,cat,acc,pending});
  // paycheques every 2 weeks (last one 4 days ago)
  for(let i=0;i<9;i++)add(addDays(t,-4-14*i),1512.40,'Sample Employer Payroll','Income');
  // monthly bills
  const bills=[{m:'Sample Rent Co',a:950,day:1,cat:'Housing',acc:'chq'},{m:'Netflix',a:16.99,day:6,cat:'Subscriptions',acc:'cc'},{m:'Spotify',a:12.99,day:9,cat:'Subscriptions',acc:'cc'},{m:'Sample Mobile',a:65,day:14,cat:'Utilities',acc:'chq'},{m:'Sample Hydro',a:58.4,day:22,cat:'Utilities',acc:'chq'},{m:'Sample Gym',a:29.99,day:3,cat:'Health',acc:'cc'},{m:'iCloud+',a:3.99,day:17,cat:'Subscriptions',acc:'cc'}];
  const now=parse(t);
  for(let k=0;k<4;k++){const base=new Date(now.getFullYear(),now.getMonth()-k,1,12);bills.forEach(b=>{const d=new Date(base.getFullYear(),base.getMonth(),b.day,12);const ds=iso(d);if(ds<=t)add(ds,-b.a*(b.m==='Spotify'&&k>0?0.846:1),b.m,b.cat,b.acc)})}
  // everyday spending, ~110 days
  const shops=[['Sample Grocer','Groceries',[38,96]],['Corner Coffee','Dining',[4.5,7.5]],['Pizza Place','Dining',[18,34]],['Sample Gas Co','Gas',[42,68]],['Online Store','Shopping',[15,80]],['Transit Pass','Transport',[3.3,3.3]],['Burger Spot','Dining',[11,19]],['Pharmacy','Health',[9,32]],['Cinema','Entertainment',[14,28]]];
  for(let d=0;d<110;d++){const ds=addDays(t,-d);const k=d===0?2:(R()<.5?1:2)+(R()<.25?1:0);for(let j=0;j<k;j++){const s=shops[Math.floor(R()*shops.length)];if(s[1]==='Gas'&&R()<.6)continue;const amt=s[2][0]+R()*(s[2][1]-s[2][0]);add(ds,-amt,s[0],s[1],R()<.7?'cc':'chq',d===0&&j===0)}}
  add(addDays(t,-2),-640,'Sample Electronics','Shopping','cc');
  add(addDays(t,-1),-42.10,'Pizza Place','Dining','cc');add(addDays(t,-1),-42.10,'Pizza Place','Dining','cc'); // possible duplicate
  add(addDays(t,-6),-24.99,'New Streaming App','Subscriptions','cc');add(addDays(t,-36),-24.99,'New Streaming App','Subscriptions','cc');
  add(addDays(t,-8),-200,'Card payment - thank you','Transfer','chq');
  tx.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  bills.push({m:'New Streaming App',a:24.99,day:parse(addDays(t,-6)).getDate(),cat:'Subscriptions',acc:'cc',isNew:true});
  bills.find(b=>b.m==='Spotify').prev=10.99;
  return {
    v:1,sample:true,
    lastSynced:new Date(Date.now()-3*3600e3).toISOString(),
    accounts:[
      {id:'chq',name:'Sample Chequing',mask:'0000',kind:'chequing',bal:2140.50},
      {id:'sav',name:'Sample Savings',mask:'0001',kind:'savings',bal:8400.00},
      {id:'cc',name:'Sample Mastercard',mask:'0002',kind:'credit',bal:-812.40,limit:3000}
    ],
    txns:tx,
    bills:bills.map((b,i)=>Object.assign({id:'b'+i},b)),
    pay:[{name:'Sample Employer',amount:1512.40,every:14,next:addDays(t,10)}],
    budgets:[{id:'bf',name:'Food',cats:['Groceries','Dining'],limit:650},{id:'bg',name:'Gas',cats:['Gas'],limit:200},{id:'bs',name:'Shopping',cats:['Shopping'],limit:600},{id:'bfun',name:'Fun',cats:['Entertainment'],limit:200}],
    virtuals:[
      {id:'va-em',name:'Emergency fund',amount:1000,from:'sav',rule:{amount:100,day:15,cap:5000}},
      {id:'va-vac',name:'Vacation',amount:640,from:'sav',rule:{amount:160,day:1,end:'2026-12-20'}}
    ],
    goals:[{id:'g1',name:'Dominican Republic trip',target:3000,date:'2026-12-28',virtualId:'va-vac'},{id:'g2',name:'New laptop',target:1500,date:'2027-03-01',saved:420}],
    debts:[{id:'d1',name:'Sample Student Loan',balance:6200,apr:5,minPay:200}],
    invest:[{id:'h1',ticker:'XEQT',shares:42,last:33.18,cost:29.4},{id:'h2',ticker:'VFV',shares:10,last:151.2,cost:128},{id:'h3',ticker:'ZAG',shares:30,last:13.9,cost:14.2}],
    merchantCats:{},
    settings:{name:'Jackson',low:300,hide:false}
  };
}
window.STACK={CATS,catColor:c=>(CATS.find(x=>x[0]===c)||['','#94a3b8'])[1],build,iso,parse,addDays,today};
})();
