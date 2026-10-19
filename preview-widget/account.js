/* Stack widget-home preview: accounts (w2).
   Signs in against the SAME Firebase project and email/password login as the live Stack (stackapphtml), so a
   browser already signed in to Stack is signed in here too.
   - Linked (Jackson, or anyone whose live stack/{uid} has bank data): reads stack/{uid}.state READ-ONLY and maps it
     to the widget layout. The preview NEVER writes stack/{uid}. Preview-only edits (budgets, goals, categories,
     bills, pay, settings) are saved to stackPrefs/{uid}.overlay.
   - New user: a clean slate plus a few setup questions; everything they enter lives in stackPrefs/{uid}.manual.
   If the stackPrefs rule isn't published yet, saves fall back to this device (localStorage).
   ?sample=1 still opens the old made-up sample data (for screenshots and the teaser), without signing in. */
(function(){
'use strict';
const CFG={apiKey:"AIzaSyDbu0afHoeESWJmoRBiEABdf5UzyzI0DRo",authDomain:"stackapphtml.firebaseapp.com",projectId:"stackapphtml",storageBucket:"stackapphtml.firebasestorage.app",messagingSenderId:"1038191511612",appId:"1:1038191511612:web:98be6b660a6062704d1b39"};
const SDK='https://www.gstatic.com/firebasejs/10.13.2/';
const A=window.STACKACCT={mode:null,user:null,D:null,cloud:null,save:()=>{},signOut:async()=>{},resetOverlay:async()=>{}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0'),iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,today=()=>iso(new Date());
const parse=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d,12)},addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const load=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=SDK+src;s.onload=res;s.onerror=()=>rej(new Error('Could not load sign-in (offline?)'));document.head.appendChild(s)});
let fb=null;
async function init(){if(fb)return fb;if(!window.firebase){await load('firebase-app-compat.js');await load('firebase-auth-compat.js');await load('firebase-firestore-compat.js')}
 if(!(firebase.apps&&firebase.apps.length))firebase.initializeApp(CFG);fb={auth:firebase.auth(),db:firebase.firestore()};return fb}
const denied=e=>/permission|insufficient/i.test(String(e&&(e.code||'')+' '+(e.message||e)));
const errMsg=e=>{const c=String(e&&e.code||'');return /wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)?'Email or password is not right.':/email-already/.test(c)?'That email already has a Stack account. Sign in instead.':/weak-password/.test(c)?'Use at least 6 characters.':/invalid-email/.test(c)?'That email doesn’t look right.':/network|unavailable/.test(c)?'You look offline. Try again.':(e&&e.message)||String(e)};

/* ---------- live Stack state -> widget data (read-only port of Stack's own rules) ---------- */
const CATN=['Housing','Groceries','Dining','Transport','Gas','Utilities','Health','Entertainment','Shopping','Subscriptions','Travel','Education','Income','Transfer','Fees','Other'];
const KEYWORDS=[["Groceries",/loblaw|no ?frills|sobeys|metro|food basics|freshco|walmart|costco|farm boy|zehrs|fortinos|grocery|superstore|longo/i],["Dining",/tim hortons|starbucks|mcdonald|subway|a&w|wendy|pizza|uber ?eats|doordash|skip ?the|restaurant|cafe|coffee|burger|sushi|chipotle|popeyes|kfc|harvey/i],["Gas",/petro[- ]?can|esso|shell|husky|pioneer|ultramar|circle k|mobil|chevron|costco gas|gas station|\bfuel|\bgas\b/i],["Transport",/uber(?! ?eats)|lyft|presto|parking|transit|go ?transit|via rail|ttc/i],["Subscriptions",/netflix|spotify|disney|crave|apple\.com|icloud|google \*|youtube|prime video|amazon prime|patreon|openai|chatgpt|adobe|microsoft|xbox|playstation|nintendo/i],["Utilities",/hydro|enbridge|rogers|bell|telus|fido|koodo|virgin|freedom|internet|water|electric/i],["Housing",/rent|mortgage|property|condo|landlord/i],["Health",/pharma|shoppers drug|rexall|dental|clinic|physio|gym|goodlife|fit4less|planet fitness/i],["Entertainment",/cineplex|ticketmaster|steam|bar |pub|bowling|concert/i],["Shopping",/amazon|best buy|canadian tire|winners|h&m|zara|ikea|indigo|dollarama|sport chek|apple store/i],["Travel",/air canada|westjet|sunwing|expedia|airbnb|hotel|booking\.com|flair|porter/i],["Education",/osap|university|college|tuition|bookstore/i],["Fees",/fee|interest charge|overdraft|nsf/i],["Transfer",/transfer|e-transfer|etransfer|interac|tfr|payment - thank you|credit card payment/i],["Income",/payroll|salary|direct dep|pay ?cheque|paycheque/i]];
const PLAID_MAP={FOOD_AND_DRINK:"Dining",GENERAL_MERCHANDISE:"Shopping",TRANSPORTATION:"Transport",TRAVEL:"Travel",RENT_AND_UTILITIES:"Utilities",ENTERTAINMENT:"Entertainment",MEDICAL:"Health",PERSONAL_CARE:"Health",LOAN_PAYMENTS:"Transfer",TRANSFER_IN:"Transfer",TRANSFER_OUT:"Transfer",INCOME:"Income",BANK_FEES:"Fees",HOME_IMPROVEMENT:"Shopping",GENERAL_SERVICES:"Other",GOVERNMENT_AND_NON_PROFIT:"Other"};
const PLAID_DETAILED=[[/GROCER/,"Groceries"],[/RESTAURANT|FAST_FOOD|COFFEE|BEER_WINE|VENDING|FOOD_AND_DRINK_OTHER/,"Dining"],[/TRANSPORTATION_GAS|GAS_STATION|FUEL/,"Gas"],[/SUBSCRIPTION|STREAMING/,"Subscriptions"]];
const merchantKey=m=>String(m||"").toLowerCase().replace(/[#*]\s*\d+/g,"").replace(/\d{3,}/g,"").replace(/[^a-z& ]+/g," ").replace(/\s+/g," ").trim().slice(0,40)||"unknown";
function normCat(c){if(!c)return "";const parts=(Array.isArray(c)?c:[c]).map(x=>String(x).trim());const s=parts[0];
 for(const p of [...parts].reverse()){const u=p.toUpperCase().replace(/[ &]+/g,"_");for(const [re,cat] of PLAID_DETAILED)if(re.test(u))return cat}
 if(/^gas|fuel/i.test(parts[parts.length-1]))return "Gas";const hit=CATN.find(x=>x.toLowerCase()===s.toLowerCase());if(hit)return hit;if(PLAID_MAP[s.toUpperCase()])return PLAID_MAP[s.toUpperCase()];if(/grocer/i.test(s))return "Groceries";if(/restaurant|food|dining|coffee/i.test(s))return "Dining";if(/transfer/i.test(s))return "Transfer";if(/subscri/i.test(s))return "Subscriptions";return ""}
function categoryOf(S,t){const k=merchantKey(t.merchant);if(S.merchantCats&&S.merchantCats[k])return S.merchantCats[k];const c=normCat(t.category);if(c)return c;for(const [cat,re] of KEYWORDS)if(re.test(t.merchant||""))return cat;return t.amount>0?"Income":"Other"}
const isCreditL=a=>/credit|loan/i.test((a.type||"")+" "+(a.subtype||""));
function balL(S,a){const adj=(S.adjustments||[]).filter(x=>x.accountId===a.id).sort((x,y)=>y.at-x.at)[0],synced=S.bank&&S.bank.lastSynced?Date.parse(S.bank.lastSynced):0;return adj&&adj.at>synced?Number(adj.balance)||0:Number(a.currentBalance)||0}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0};
function detectRecurring(tx){const by={};tx.forEach(t=>{(by[merchantKey(t.merchant)]=by[merchantKey(t.merchant)]||[]).push(t)});const bills=[],pays=[];
 for(const L of Object.values(by)){if(L.length<2)continue;L.sort((a,b)=>a.date.localeCompare(b.date));const gaps=L.slice(1).map((t,i)=>(parse(t.date)-parse(L[i].date))/864e5),g=median(gaps),amts=L.map(t=>Math.abs(t.amount)),am=median(amts);
  if(amts.some(a=>Math.abs(a-am)>am*.2+1))continue;const last=L[L.length-1];
  if(last.amount<0&&last.cat!=='Transfer'&&g>=26&&g<=35&&(parse(today())-parse(last.date))/864e5<45)bills.push({id:'r'+bills.length,m:last.merchant,a:Math.round(am*100)/100,day:+last.date.slice(8),cat:last.cat,acc:last.acc});
  if(last.amount>0&&last.cat==='Income'&&g>=6&&g<=35){let nx=addDays(last.date,Math.round(g));let k=0;while(nx<today()&&k++<60)nx=addDays(nx,Math.round(g));pays.push({name:last.merchant,amount:Math.round(last.amount*100)/100,every:Math.round(g),next:nx})}}
 return {bills,pays}}
const FREQD={weekly:7,biweekly:14,semimonthly:15,monthly:30};
function mapLive(S){const B=S.bank||{},ign=new Set(((S.settings||{}).ignoredMasks||[]).map(String));
 const accs=(B.accounts||[]).filter(a=>!ign.has(String(a.mask||'')));let chqId=null;
 const st=S.settings||{},prim=accs.find(a=>a.id===st.primaryAccountId)||accs.find(a=>/check|chequ/i.test(a.subtype||a.name||''))||accs.find(a=>!isCreditL(a));chqId=prim?prim.id:null;
 const accounts=accs.map(a=>{const cr=isCreditL(a),kind=cr?'credit':a.id===chqId?'chequing':/sav/i.test((a.subtype||'')+' '+(a.name||''))?'savings':'chequing';
  const bal=balL(S,a);return {id:a.id,name:a.name||'Account',mask:a.mask||'',kind,bal,limit:cr&&a.availableBalance!=null?Math.round((Math.abs(bal)+Number(a.availableBalance))*100)/100:undefined}});
 const rid=id=>id===chqId?'chq':id;accounts.forEach(a=>a.id=rid(a.id));const ids=new Set(accounts.map(a=>a.id));
 const txns=(B.transactions||[]).filter(t=>ids.has(rid(t.accountId))||!t.accountId).map(t=>({id:String(t.id),date:String(t.date).slice(0,10),amount:Number(t.amount)||0,merchant:String(t.merchant||'Unknown'),cat:categoryOf(S,t),acc:rid(t.accountId)||'chq',pending:!!t.pending})).sort((a,b)=>b.date.localeCompare(a.date));
 const rec=detectRecurring(txns);
 const ps=((S.settings||{}).paySchedule||[]).filter(j=>Number(j.amount)>0&&j.next&&FREQD[j.frequency]).map(j=>{let nx=j.next,k=0;while(nx<today()&&k++<200)nx=addDays(nx,FREQD[j.frequency]);return {name:j.name||'Pay',amount:Number(j.amount),every:FREQD[j.frequency],next:nx}});
 const src=v=>{const s=((v.rule||{}).sources||[])[0];if(s==='savings')return (accounts.find(a=>a.kind==='savings')||{}).id;if(s==='chequing')return 'chq';return rid(s)};
 return {v:1,linked:true,lastSynced:B.lastSynced||new Date().toISOString(),accounts,txns,bills:rec.bills,pay:ps.length?ps:rec.pays.slice(0,1),
  budgets:(S.budgets||[]).map((b,i)=>{const cats=Array.isArray(b.categories)&&b.categories.length?b.categories:Array.isArray(b.cats)&&b.cats.length?b.cats:b.category?[b.category]:[];return {id:b.id||'lb'+i,name:b.name||cats.join(' + '),cats,limit:Number(b.limit)||0}}).filter(b=>b.cats.length&&b.limit>0),
  virtuals:(S.virtuals||[]).map(v=>({id:v.id,name:v.name,amount:Number(v.amount)||0,from:src(v),rule:{amount:Number((v.rule||{}).amount)||0,day:Number((v.rule||{}).day)||1,cap:(v.rule||{}).cap||null,end:(v.rule||{}).endDate||''}})),
  goals:(S.goals||[]).map(g=>({id:g.id,name:g.name,target:Number(g.target)||0,date:g.date||'',saved:Number(g.saved)||0,virtualId:g.virtualId||''})),
  debts:(S.debts||[]).map(d=>({id:d.id,name:d.name,balance:Number(d.balance)||0,apr:Number(d.apr)||0,minPay:Number(d.minPay)||0})),
  invest:(S.invest||[]).filter(h=>h&&h.ticker).map((h,i)=>({id:h.id||'h'+i,ticker:h.ticker,shares:Number(h.shares)||0,last:Number(h.last)||Number(h.cost)||0,cost:Number(h.cost)||Number(h.last)||0})),
  merchantCats:{},settings:{name:(S.settings||{}).name||'',low:Number((S.settings||{}).lowBalance)||200,hide:!!(S.settings||{}).hideMoney,currency:(S.settings||{}).currency||'CAD',sym:(S.settings||{}).symbol||'$'}}}
const hasLive=S=>!!(S&&S.bank&&Array.isArray(S.bank.accounts)&&S.bank.accounts.length);
const blank=()=>({v:1,manual:true,lastSynced:null,accounts:[],txns:[],bills:[],pay:[],budgets:[],virtuals:[],goals:[],debts:[],invest:[],merchantCats:{},settings:{name:'',low:200,hide:false,currency:'CAD',sym:'$',onboarded:false}});
const OVER=['budgets','goals','virtuals','merchantCats','settings','bills','pay','debts'];

/* ---------- prefs storage: stackPrefs/{uid} (never stack/{uid}) ---------- */
const LK=()=>'stackw:prefs:'+A.user.uid;
async function getPrefs(){let local=null;try{local=JSON.parse(localStorage.getItem(LK())||'null')}catch(e){}
 try{const s=await fb.db.doc('stackPrefs/'+A.user.uid).get();A.cloud=true;if(s.exists){const d=s.data();localStorage.setItem(LK(),JSON.stringify(d));return d}if(local){try{await fb.db.doc('stackPrefs/'+A.user.uid).set(local)}catch(e){}}return local}
 catch(e){if(denied(e))A.cloud=false;console.warn('prefs',e);return local}}
let tmr=null;
function savePrefs(p){p.updatedAt=Date.now();localStorage.setItem(LK(),JSON.stringify(p));if(A.cloud===false)return;clearTimeout(tmr);tmr=setTimeout(async()=>{try{await fb.db.doc('stackPrefs/'+A.user.uid).set(JSON.parse(JSON.stringify(p)));A.cloud=true}catch(e){if(denied(e))A.cloud=false;console.warn('prefs save',e)}},500)}

/* ---------- sign-in screen (email/password, same as live Stack) ---------- */
function gate(){return new Promise(res=>{const el=document.createElement('div');el.className='sgate';document.body.appendChild(el);let create=false,err='';
 const draw=()=>{el.innerHTML=`<div class="sgi"><img class="applogo" src="icon-512.png" alt=""><h2>Stack</h2><p class="lede">Your money on one home screen. Sign in with your Stack account, or create one to start from scratch.</p>
  <div class="seg"><button data-m="in" class="${create?'':'on'}">Sign in</button><button data-m="up" class="${create?'on':''}">Create account</button></div>
  <input id="sg_e" type="email" autocomplete="email" placeholder="Email"><input id="sg_p" type="password" autocomplete="${create?'new-password':'current-password'}" placeholder="Password">
  <button class="btn block" id="sg_go">${create?'Create account':'Sign in'}</button>${create?'':'<button class="btn ghost block" id="sg_fp">Forgot password?</button>'}<p class="sgerr">${esc(err)}</p>
  <p class="muted" style="font-size:12.5px;text-align:center">Same login as the Stack app. The preview only reads your Stack data; it never changes it.</p></div>`;
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const em=el.querySelector('#sg_e').value;create=b.dataset.m==='up';err='';draw();el.querySelector('#sg_e').value=em});
  el.querySelector('#sg_go').onclick=async()=>{const em=el.querySelector('#sg_e').value.trim(),pw=el.querySelector('#sg_p').value;if(!em||!pw){err='Enter your email and password.';return draw()}
   try{await init();const c=create?await fb.auth.createUserWithEmailAndPassword(em,pw):await fb.auth.signInWithEmailAndPassword(em,pw);el.remove();res(c.user)}catch(e){err=errMsg(e);draw();el.querySelector('#sg_e').value=em}};
  const fp=el.querySelector('#sg_fp');if(fp)fp.onclick=async()=>{const em=el.querySelector('#sg_e').value.trim();if(!em){err='Type your email first.';return draw()}try{await init();await fb.auth.sendPasswordResetEmail(em)}catch(e){}err='If that email has an account, a reset link is on its way.';draw();el.querySelector('#sg_e').value=em}};
 draw()})}

/* ---------- boot ---------- */
async function start(){
 if(/[?&]sample=1\b/.test(location.search)){A.mode='sample';return}
 await init();let u=await new Promise(r=>{const off=fb.auth.onAuthStateChanged(x=>{off();r(x)})});
 if(!u)u=await gate();A.user=u;
 A.signOut=async()=>{await fb.auth.signOut();location.reload()};
 let live=null;try{const s=await fb.db.doc('stack/'+u.uid).get();live=s.exists?s.data():null}catch(e){console.warn('live read',e)}
 const prefs=(await getPrefs())||{v:1};A.prefs=prefs;
 if(live&&hasLive(live.state)){A.mode='linked';const D=mapLive(live.state);const ov=prefs.overlay||{};OVER.forEach(k=>{if(ov[k]!==undefined)D[k]=k==='settings'?Object.assign(D.settings,ov[k]):ov[k]});D.merchantCats=D.merchantCats||{};A.D=D;
  A.save=d=>{const o={};OVER.forEach(k=>o[k]=d[k]);prefs.overlay=o;prefs.mode='linked';savePrefs(prefs)};
  A.resetOverlay=async()=>{delete prefs.overlay;savePrefs(prefs);location.reload()}}
 else{A.mode='manual';A.D=Object.assign(blank(),prefs.manual||{});A.D.settings=Object.assign(blank().settings,(prefs.manual||{}).settings||{});
  A.save=d=>{prefs.manual=JSON.parse(JSON.stringify(d));prefs.mode='manual';savePrefs(prefs)}}}
A.ready=start().catch(e=>{console.error(e);A.mode='error';A.err=String(e.message||e)}).then(()=>{
 if(A.mode==='error'){document.getElementById('app').innerHTML=`<div class="sgate"><div class="sgi"><h2>Can’t open Stack</h2><p class="lede">${esc(A.err)}</p><button class="btn block" onclick="location.reload()">Try again</button></div></div>`;return}
 const s=document.createElement('script');s.src='app.js?v='+(window.PREVIEW_BUILD||'');document.body.appendChild(s)});
})();
