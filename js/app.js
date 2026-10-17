import {ctx,loadLocal,save,pullCloud,pushCloud,fbConfig,migrate,FB_LS} from "./store.js";
import * as V from "./views.js";
import * as A from "./analysis.js";
import {runSync} from "./sync.js";
import {esc,val,num,uid,monthKey,monthLabel,todayISO} from "./util.js";
import {demoState} from "./demo.js";

export const APP_BUILD=40;
ctx.S=ctx.demo?migrate(demoState()):loadLocal();

const TITLES={home:null,spending:"Spending",budgets:"Budgets",plan:"Plan",goals:"Goals",sync:"Sync",settings:"Settings",invest:"Invest"};
function greeting(){const h=new Date().getHours(),n=(ctx.S.settings.name||"").trim();const hi=h<12?"Good morning":h<17?"Good afternoon":"Good evening";return n?hi+", "+n.split(" ")[0]:hi;}
function applyStyle(){const id=ctx.S.settings.style||"vault";document.documentElement.setAttribute("data-style",id);document.documentElement.setAttribute("data-theme",id==="slate"?"":(ctx.S.settings.theme==="light"?"light":"dark"));}
function paintAvatar(){const el=document.getElementById("avatarBtn");if(!el)return;const n=(ctx.S.settings.name||"").trim();const ini=n?n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase():"S";el.innerHTML=ctx.S.settings.avatar?`<img alt="" src="${ctx.S.settings.avatar}">`:ini;}
export function render(){
  applyStyle();paintAvatar();
  const v=ctx.view;document.getElementById("hello").textContent=v==="home"?greeting():(TITLES[v]||"Stack");
  document.getElementById("todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
  document.querySelector('nav.tabs button[data-view="invest"]').style.display=ctx.S.settings.showInvest?"":"none";
  document.querySelectorAll("nav.tabs button").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  document.getElementById("content").innerHTML=(V[v]||V.home)();
}
const G=window;
G.showView=v=>{ctx.view=v;render();document.getElementById("content").scrollTop=0;};
G.setMonth=m=>{ctx.month=m;render();};
G.openSheet=html=>{document.getElementById("sheetPanel").innerHTML=`<div class="handle"></div>${html}`;document.getElementById("sheet").classList.add("open");};
G.closeSheet=()=>document.getElementById("sheet").classList.remove("open");
const catOpts=sel=>A.CATS.map(([c])=>`<option ${c===sel?"selected":""}>${c}</option>`).join("");

G.doSync=async()=>{const out=document.getElementById("syncResult"),btn=document.getElementById("syncBtn");btn.disabled=true;
  try{const r=await runSync(val("syncInput"));out.innerHTML=`<span class="pos">Imported.</span> +${r.added} new, ${r.updated} updated, ${r.unchanged} unchanged, ${r.pendingResolved} pending resolved · ${r.accountsUpdated} accounts updated, ${r.accountsAdded} added · ${esc(r.cloud)}`;out.dataset.status="ok";document.getElementById("syncInput").value="";}
  catch(e){out.innerHTML=`<span class="neg">Import failed: ${esc(e.message)}</span>`;out.dataset.status="error";}
  btn.disabled=false;};

G.openTxn=id=>{const t=A.txns().find(x=>x.id===id);if(!t)return;const k=A.merchantKey(t.merchant);
  G.openSheet(`<h2>${esc(t.merchant)}</h2><div class="tiny">${t.date} · ${V.money(t.amount,true)}${t.category?` · bank category: ${esc(t.category)}`:""}</div><label>Category for all "${esc(k)}" transactions</label><select id="f-cat">${catOpts(A.categoryOf(t))}</select><button class="btn" onclick="setCat('${esc(k)}')">Save</button>${ctx.S.merchantCats[k]?`<button class="btn ghost" onclick="clearCat('${esc(k)}')">Reset to automatic</button>`:""}`);};
G.setCat=k=>{ctx.S.merchantCats[k]=val("f-cat");save();G.closeSheet();render();};
G.clearCat=k=>{delete ctx.S.merchantCats[k];save();G.closeSheet();render();};

G.openBudget=(id,cat)=>{const b=ctx.S.budgets.find(x=>x.id===id)||{category:cat||"Groceries",limit:""};
  G.openSheet(`<h2>${id?"Edit":"New"} budget</h2><label>Category</label><select id="f-cat">${catOpts(b.category)}</select><label>Monthly limit</label><input id="f-amt" type="number" step="1" value="${b.limit}"><button class="btn" onclick="saveBudget('${id||""}')">Save</button>${id?`<button class="btn ghost" onclick="delRec('budgets','${id}')">Delete</button>`:""}`);};
G.saveBudget=id=>{const rec={id:id||uid(),category:val("f-cat"),limit:num("f-amt")};const L=ctx.S.budgets,i=L.findIndex(x=>x.id===rec.id);i>=0?L[i]=rec:L.push(rec);save();G.closeSheet();render();};
G.delRec=(list,id)=>{ctx.S[list]=ctx.S[list].filter(x=>x.id!==id);save();G.closeSheet();render();};

G.openGoal=id=>{const g=ctx.S.goals.find(x=>x.id===id)||{name:"",target:"",date:"",accountId:"",saved:0};
  G.openSheet(`<h2>${id?"Edit":"New"} goal</h2><label>Name</label><input id="f-name" value="${esc(g.name)}"><label>Target amount</label><input id="f-amt" type="number" value="${g.target||""}"><label>Date</label><input id="f-date" type="date" value="${g.date||""}">
  <label>Track progress with account</label><select id="f-acct"><option value="">Manual amount</option>${ctx.S.bank.accounts.filter(a=>!A.isCredit(a)).map(a=>`<option value="${esc(a.id)}" ${a.id===g.accountId?"selected":""}>${esc(a.name)} (${V.money(A.accountBalance(a))})</option>`).join("")}</select>
  <label>Amount already in that account that isn't for this goal</label><input id="f-start" type="number" value="${g.startBalance||0}">
  <label>Saved so far (manual mode)</label><input id="f-saved" type="number" value="${g.saved||0}">
  <button class="btn" onclick="saveGoal('${id||""}')">Save</button>${id?`<button class="btn ghost" onclick="delRec('goals','${id}')">Delete</button>`:""}`);};
G.saveGoal=id=>{const old=ctx.S.goals.find(x=>x.id===id)||{created:todayISO()};const rec={...old,id:id||uid(),name:val("f-name")||"Goal",target:num("f-amt"),date:val("f-date"),accountId:val("f-acct"),startBalance:num("f-start"),saved:num("f-saved")};const L=ctx.S.goals,i=L.findIndex(x=>x.id===rec.id);i>=0?L[i]=rec:L.push(rec);save();G.closeSheet();render();};

G.openDebt=id=>{const d=ctx.S.debts.find(x=>x.id===id)||{name:"",principal:"",apr:"",minPay:"",note:""};
  G.openSheet(`<h2>${id?"Edit":"New"} loan</h2><label>Name</label><input id="f-name" value="${esc(d.name)}"><label>Balance owed</label><input id="f-amt" type="number" value="${d.balance??d.principal??""}"><label>APR %</label><input id="f-apr" type="number" step="0.01" value="${d.apr??""}"><label>Monthly payment</label><input id="f-min" type="number" value="${d.minPay??""}"><label>Note</label><input id="f-note" value="${esc(d.note||"")}"><button class="btn" onclick="saveDebt('${id||""}')">Save</button>${id?`<button class="btn ghost" onclick="delRec('debts','${id}')">Delete</button>`:""}`);};
G.saveDebt=id=>{const old=ctx.S.debts.find(x=>x.id===id)||{};const rec={...old,id:id||uid(),name:val("f-name"),balance:num("f-amt"),payments:[],apr:num("f-apr"),minPay:num("f-min"),note:val("f-note")};const L=ctx.S.debts,i=L.findIndex(x=>x.id===rec.id);i>=0?L[i]=rec:L.push(rec);save();G.closeSheet();render();};

G.saveSettings=()=>{const st=ctx.S.settings;st.name=val("s-name");st.lowBalance=num("s-low");st.primaryAccountId=val("s-prim");st.showInvest=document.getElementById("s-inv").checked;st.hideMoney=document.getElementById("s-hide").checked;save();render();};
G.setStyle=id=>{ctx.S.settings.style=id;save();render();};
G.adjust=id=>{ctx.S.adjustments.push({id:uid(),accountId:id,balance:num("adj-"+id),at:Date.now()});save();render();};
G.setAvatar=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{ctx.S.settings.avatar=r.result;save();paintAvatar();};r.readAsDataURL(f);};
G.exportData=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(ctx.S)],{type:"application/json"}));a.download="stack-backup.json";a.click();};
G.importData=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{ctx.S=migrate(JSON.parse(r.result));save();render();}catch(err){alert("Bad file");}};r.readAsText(f);};
G.exportMonthPdf=()=>{const mk=monthKey(),t=A.monthTotals(mk),c=A.spendByCat(mk),w=window.open("","_blank");if(!w)return;
  w.document.write(`<!doctype html><title>Stack ${monthLabel(mk)}</title><style>body{font-family:system-ui;padding:24px;color:#111}td,th{border-bottom:1px solid #ddd;text-align:left;padding:6px;font-size:13px}table{width:100%;border-collapse:collapse}</style><h1>Stack · ${monthLabel(mk)}</h1><p>In ${V.money(t.inn)} · Out ${V.money(t.out)}</p><table><tr><th>Category</th><th>Spent</th><th>Budget</th></tr>${Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const b=ctx.S.budgets.find(x=>x.category===k);return `<tr><td>${k}</td><td>${V.money(v)}</td><td>${b?V.money(b.limit):""}</td></tr>`;}).join("")}</table><script>print()<\/script>`);w.document.close();};

// Investments (kept, simplified)
async function fetchQuote(ticker){const raw=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;let last="No quote";
  for(const u of [raw,"https://corsproxy.io/?"+encodeURIComponent(raw),"https://api.allorigins.win/raw?url="+encodeURIComponent(raw)]){try{const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);const m=(await r.json()).chart.result[0].meta;const px=Number(m.regularMarketPrice||m.previousClose);if(!px)throw new Error("No price");return {price:px,name:m.shortName||ticker,currency:m.currency||"USD"};}catch(e){last=e.message;}}throw new Error(last);}
G.addHolding=async()=>{const ticker=(prompt("Ticker? (AAPL, SHOP.TO)")||"").trim().toUpperCase();if(!ticker)return;const shares=Number(prompt("Shares?")||"");if(!shares)return;const cost=Number(prompt("Cost per share? (optional)")||"")||0;const h={id:"h_"+Date.now(),ticker,shares,cost,last:cost};ctx.S.invest.push(h);save();render();try{Object.assign(h,{last:(await fetchQuote(ticker)).price});save();render();}catch(e){alert("Saved, but price lookup failed: "+e.message);}};
G.refreshHoldings=async()=>{ctx.investMsg="Updating prices…";render();for(const h of ctx.S.invest){try{const q=await fetchQuote(h.ticker);h.last=q.price;h.currency=q.currency;}catch(e){}}ctx.investMsg="";save();render();};
G.delHolding=id=>{if(!confirm("Remove this holding?"))return;ctx.S.invest=ctx.S.invest.filter(h=>h.id!==id);save();render();};

// Auth (same Firebase project + email/password as before)
const authMsg=t=>{const el=document.getElementById("authMsg");if(el)el.textContent=t||"";};
G.showAuth=()=>document.getElementById("authGate").classList.add("show");
const hideAuth=()=>document.getElementById("authGate").classList.remove("show");
function initFirebase(){
  if(ctx.demo||typeof firebase==="undefined")return false;
  try{if(!ctx.fbAuth){firebase.initializeApp(fbConfig());ctx.fbAuth=firebase.auth();ctx.fbDb=firebase.firestore();}
    ctx.fbAuth.onAuthStateChanged(async u=>{ctx.fbUser=u||null;if(u){ctx.fbSkip=false;hideAuth();authMsg("");await pullCloud();render();}else if(!ctx.fbSkip)G.showAuth();render();});return true;}
  catch(e){console.warn(e);return false;}
}
G.authSignIn=async()=>{if(!ctx.fbAuth)return authMsg("Cloud unavailable (offline?)");try{authMsg("Signing in…");await ctx.fbAuth.signInWithEmailAndPassword(val("authEmail"),val("authPass"));}catch(e){authMsg(e.message);}};
G.authRegister=async()=>{if(!ctx.fbAuth)return authMsg("Cloud unavailable (offline?)");try{authMsg("Creating account…");await ctx.fbAuth.createUserWithEmailAndPassword(val("authEmail"),val("authPass"));}catch(e){authMsg(e.message);}};
G.authSkip=()=>{ctx.fbSkip=true;hideAuth();};
G.authSignOut=async()=>{if(ctx.fbAuth)await ctx.fbAuth.signOut();ctx.fbUser=null;G.showAuth();};

if("serviceWorker" in navigator&&!ctx.demo)navigator.serviceWorker.register("sw.js").catch(()=>{});
if(ctx.demo)document.body.insertAdjacentHTML("afterbegin",'<div class="demo-banner">DEMO MODE · made-up data · nothing is saved</div>');
initFirebase();render();
setTimeout(()=>{const s=document.getElementById("splash");if(s)s.remove();},1200);
G.__stack=ctx; // for debugging/tests
