// Clearly FAKE demo data, generated at runtime for ?demo=1. Never real banking data.
import {todayISO,addDays,addMonths} from "./util.js";
import {TEMPLATES} from "./virtuals.js";
export function demoPayload(){
  const t=todayISO(),tx=[];let n=0;const add=(d,amt,m,cat,acc="demo-chq",pending=false)=>tx.push({id:"demo-"+(n++),date:d,amount:amt,merchant:m,category:cat,accountId:acc,pending});
  for(let i=0;i<8;i++)add(addDays(t,-3-14*i),1500,"DEMO EMPLOYER PAYROLL","Income");
  for(let i=0;i<4;i++){const b=addDays(t,-10-30*i);add(b,-950,"Demo Rent Co","Housing");add(addDays(b,2),-16.99,"Netflix","");add(addDays(b,5),i===0?-12.99:-10.99,"Spotify","");add(addDays(b,8),-85,"Demo Mobile","Utilities");}
  add(addDays(t,-6),-24.99,"New Streaming App","Subscriptions");add(addDays(t,-36),-24.99,"New Streaming App","Subscriptions");
  const shops=[["Demo Grocer",-62],["Coffee Spot",-5.5],["Pizza Place",-28],["Bus Pass",-48],["Online Store",-35]];
  for(let i=0;i<6;i++)add(addDays(t,-4-9*i),-55,"Petro-Canada","TRANSPORTATION_GAS","demo-cc");
  for(let d=1;d<110;d++){const s=shops[d%shops.length];if(d%2===0)add(addDays(t,-d),s[1]-(d%7),s[0],"","demo-cc");}
  add(addDays(t,-2),-640,"Demo Electronics","","demo-cc");add(addDays(t,-1),-42.1,"Pizza Place","","demo-cc");add(addDays(t,-1),-42.1,"Pizza Place","","demo-cc");
  add(t,-9.75,"Coffee Spot","","demo-cc",true);
  return {lastSynced:new Date(Date.now()-3*3600e3).toISOString(),
    accounts:[{id:"demo-chq",name:"Demo Chequing",mask:"0000",type:"depository",subtype:"checking",currentBalance:1240.5,availableBalance:1240.5},
      {id:"demo-sav",name:"Demo Savings",mask:"0001",type:"depository",subtype:"savings",currentBalance:6100,availableBalance:6100},
      {id:"demo-cc",name:"Demo Mastercard",mask:"0002",type:"credit",subtype:"credit card",currentBalance:-812.4,availableBalance:2187.6}],transactions:tx};
}
export function demoState(){
  const p=demoPayload();
  return {schema:3,settings:{name:"Demo",lowBalance:300,drGoalSeeded:true,virtualsSeeded:true},virtuals:TEMPLATES.map(x=>({id:"va-"+x.key,name:x.name,amount:x.key==="emergency"?1000:0,created:addMonths(todayISO(),-2).slice(0,8)+"01",rule:JSON.parse(JSON.stringify(x.rule)),log:[]})),bank:{lastSynced:p.lastSynced,accounts:p.accounts,transactions:p.transactions,imports:[]},
    budgets:[],
    goals:[{id:"goal-dr-trip",name:"Dominican Republic trip",target:3000,saved:0,date:"2026-12-28",virtualId:"va-vacation"}],
    debts:[{id:"d1",name:"Demo Student Loan",balance:10000,apr:5,minPay:200}],invest:[],merchantCats:{"coffee spot":"Dining"}};
}
window.__demoPayload=demoPayload;
