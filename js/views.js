import {ctx} from "./store.js";
import * as A from "./analysis.js";
import * as VA from "./virtuals.js";
import {esc,ago,todayISO,monthKey,monthLabel,niceDate,daysBetween,addDays} from "./util.js";

export function money(n,signed=false){const S=ctx.S,v=Number(n)||0;if(S.settings.hideMoney)return "•••";const abs=Math.abs(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});const sign=signed?(v>0?"+":v<0?"−":""):(v<0?"−":"");return `${sign}${S.settings.symbol||"$"}${abs}`;}
const bar=(pct,color)=>`<div class="bar"><i style="width:${Math.max(0,Math.min(100,pct)).toFixed(1)}%;background:${color}"></i></div>`;
const dot=c=>`<span class="cat-dot" style="background:${A.catColor(c)};display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:6px"></span>`;
const empty=(t)=>`<div class="card empty"><div class="tiny">${t}</div><button class="btn" style="margin-top:10px" onclick="showView('sync')">Open Sync</button></div>`;

function syncLine(){const B=ctx.S.bank;const stale=B.lastSynced&&Date.now()-Date.parse(B.lastSynced)>36*3600e3;
  return `<div class="tiny" style="margin:2px 0 12px">${B.lastSynced?`Synced ${ago(B.lastSynced)}`:"Not synced yet"}${stale?' <span class="flag">stale</span>':""} · ${ctx.fbUser?"Cloud: "+esc(ctx.fbUser.email||""):ctx.demo?"Demo data":"This device only"}${ctx.cloudMsg?` · <span class="${ctx.cloudMsg==="Syncing…"?"":"neg"}">${esc(ctx.cloudMsg)}</span>`:""}</div>`;}

export function home(){
  const S=ctx.S,acc=S.bank.accounts;
  if(!acc.length)return syncLine()+empty("No bank data yet. Your Stack Finance bot pastes a daily snapshot on the Sync screen.");
  const cash=acc.filter(a=>!A.isCredit(a)).reduce((s,a)=>s+A.accountBalance(a),0);
  const owed=acc.filter(A.isCredit).reduce((s,a)=>s+Math.abs(A.accountBalance(a)),0);
  const w=A.weekly(),f=A.forecast(60);
  const net=!!S.settings.netCredit;
  const tiles=acc.map(a=>{if(A.isCredit(a))return `<div class="acct"><div class="n">${esc(a.name)}${a.mask?" ··"+esc(a.mask):""}</div><div class="b neg">${money(-Math.abs(A.accountBalance(a)))}</div>${net?'<div class="tiny">counted against Chequing</div>':""}</div>`;
    const isChq=/check|chequ/i.test(a.subtype||a.name||""),free=VA.freeBalance(a)-(isChq&&net?owed:0),held=VA.allocatedIn(a);
    const lbl=isChq?"Chequing":/saving/i.test(a.subtype||a.name||"")?"Savings":a.name;
    return `<div class="acct"><div class="n">${esc(a.name)}${a.mask?" ··"+esc(a.mask):""}</div><div class="b ${free<0?"neg":""}">${money(free)}</div><div class="tiny">${esc(lbl)} free${held||(isChq&&net&&owed)?` · bank ${money(A.accountBalance(a))}`:""}${held?` · ${money(held)} in virtual`:""}${isChq&&net&&owed?` · −${money(owed)} cards`:""}</div></div>`;}).join("");
  const virt=(S.virtuals||[]).map(v=>`<div class="kv" onclick="openVirtual('${v.id}')"><span class="l">${esc(v.name)}<br><span class="tiny">${ruleText(v)}</span></span><b>${money(v.amount)}</b></div>`).join("");
  const flags=[...w.large.map(t=>`<div class="kv"><span class="l">${esc(t.merchant)} <span class="flag">large</span><br><span class="tiny">${niceDate(t.date)} · ${A.categoryOf(t)}</span></span><b>${money(t.amount)}</b></div>`),
    ...w.dupes.map(([a,b])=>`<div class="kv"><span class="l">${esc(a.merchant)} <span class="flag">possible duplicate</span><br><span class="tiny">${niceDate(a.date)} & ${niceDate(b.date)}</span></span><b>${money(a.amount)}</b></div>`)].join("");
  const fc=f?`<div class="card ${f.firstLow?"warn":""}" onclick="showView('plan')"><div class="tiny">Chequing forecast</div>
    ${f.nextPay?`<div class="row" style="justify-content:space-between"><span>Before next payday (${niceDate(f.nextPay.date)})</span><b>${money(f.balAtPay)}</b></div>`:`<div class="tiny">Not enough history yet. Set your pay schedule in Settings.</div>`}
    <div class="row" style="justify-content:space-between"><span>Lowest in 60 days</span><b class="${f.min.bal<f.low?"neg":""}">${money(f.min.bal)}</b></div>
    ${f.firstLow?`<div class="tiny neg">Heads up: drops below ${money(f.low)} around ${niceDate(f.firstLow.date)}.</div>`:""}</div>`:"";
  return syncLine()+`<div class="totalcard card"><div class="tiny">Cash across accounts</div><div class="amount" style="font-size:30px;font-weight:700">${money(cash)}</div>${owed?`<div class="tiny">Credit owed ${money(owed)}</div>`:""}</div>
  <div class="grid2" style="margin:12px 0">${tiles}</div>
  <div class="card"><div class="section-title">Virtual accounts</div>${virt||'<div class="tiny">None</div>'}<button class="btn ghost" onclick="openVirtual()">Add virtual account</button></div>
  <div class="card"><div class="section-title">This week</div>
    <div class="grid2"><div><div class="tiny">In</div><div class="pos" style="font-size:20px;font-weight:650">${money(w.inn)}</div></div><div><div class="tiny">Out</div><div style="font-size:20px;font-weight:650">${money(w.out)}</div></div></div>
    ${flags?`<div style="margin-top:10px">${flags}</div>`:`<div class="tiny" style="margin-top:8px">Nothing unusual this week.</div>`}</div>
  ${fc}${goalsMini()}`;
}
export function ruleText(v){const r=v.rule||{};if(!(r.amount>0))return "no schedule";const last=(v.log||[]).filter(e=>e.type==="contribution").slice(-1)[0];
  return `+${money(r.amount)} on day ${r.day}${r.endDate?` until ${niceDate(r.endDate)}`:""}${r.cap?` up to ${money(r.cap)}`:""} · from ${(r.sources||[]).join(" → ")}${last?` · last ${niceDate(last.date)} from ${esc(last.accountName)}`:""}`;}
function goalsMini(){const g=ctx.S.goals.slice(0,2).map(goalCard).join("");return g?`<div class="section-title" style="margin-top:14px">Goals</div>${g}`:"";}

export function spending(){
  const S=ctx.S;if(!A.txns().length)return syncLine()+empty("Spending insights appear once transactions sync.");
  const mk=ctx.month||monthKey(),pm=A.prevMonth(mk);
  const cur=A.spendByCat(mk),prv=A.spendByCat(pm),t=A.monthTotals(mk),tp=A.monthTotals(pm);
  const cats=[...new Set([...Object.keys(cur),...Object.keys(prv)])].sort((a,b)=>(cur[b]||0)-(cur[a]||0));
  const max=Math.max(1,...cats.map(c=>Math.max(cur[c]||0,prv[c]||0)));
  const diff=t.out-tp.out;
  const months=[...new Set(A.txns().map(x=>x.date.slice(0,7)))].sort().reverse().slice(0,12);
  const recent=A.txns().filter(x=>x.date.slice(0,7)===mk).slice(0,60);
  return syncLine()+`<div class="seg">${months.map(m=>`<button class="${m===mk?"on":""}" onclick="setMonth('${m}')">${monthLabel(m)}</button>`).join("")}</div>
  <div class="card"><div class="tiny">Spent in ${monthLabel(mk)}</div><div style="font-size:28px;font-weight:700">${money(t.out)}</div>
   <div class="tiny">${tp.out?`${diff>=0?"▲":"▼"} ${money(Math.abs(diff))} vs ${monthLabel(pm)} (${money(tp.out)})`:"No data for last month"} · In ${money(t.inn)}</div></div>
  <div class="card"><div class="section-title">By category <span class="tiny">(this vs last month)</span></div>
   ${cats.map(c=>{const a=cur[c]||0,b=prv[c]||0;return `<div style="margin:8px 0"><div class="row" style="justify-content:space-between"><span>${dot(c)}${c}</span><span><b>${money(a)}</b> <span class="tiny">/ ${money(b)}</span></span></div>${bar(a/max*100,A.catColor(c))}<div style="opacity:.45">${bar(b/max*100,A.catColor(c))}</div></div>`;}).join("")||'<div class="tiny">No spending.</div>'}</div>
  <div class="card"><div class="section-title">Top merchants</div>${A.topMerchants(mk).map(m=>`<div class="kv"><span class="l">${dot(m.cat)}${esc(m.name)} <span class="tiny">×${m.count}</span></span><b>${money(m.total)}</b></div>`).join("")||'<div class="tiny">None</div>'}</div>
  <div class="card"><div class="section-title">Transactions <span class="tiny">tap to change category</span></div>${recent.map(x=>`<div class="kv" onclick="openTxn('${esc(x.id)}')"><span class="l">${dot(A.categoryOf(x))}${esc(x.merchant)}${x.pending?' <span class="flag ok">pending</span>':""}<br><span class="tiny">${niceDate(x.date)} · ${A.categoryOf(x)}</span></span><b class="${x.amount>0?"pos":""}">${money(x.amount,true)}</b></div>`).join("")}</div>`;
}

export function budgets(){
  const mk=monthKey(),rows=A.budgetRows(mk);const day=new Date().getDate(),dim=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const unb=Object.entries(A.spendByCat(mk)).filter(([c])=>!rows.some(r=>r.cats.includes(c))).sort((a,b)=>b[1]-a[1]);
  return syncLine()+`<div class="card"><div class="tiny">${monthLabel(mk)} · day ${day} of ${dim}</div><div class="tiny">Budgets fill automatically from synced spending.</div></div>
  ${rows.map(r=>{const pct=r.limit?r.spent/r.limit*100:0,pace=day/dim*100,over=r.spent>r.limit,hot=!over&&pct>pace+10;
    return `<div class="card ${over?"warn":""}" onclick="openBudget('${r.id}')"><div class="row" style="justify-content:space-between"><span>${dot(r.cats[0])}<b>${esc(r.name||r.cats.join(" + "))}</b>${r.cats.length>1||r.name!==r.cats[0]?`<br><span class="tiny">${r.cats.join(" + ")}</span>`:""}</span><span>${money(r.spent)} <span class="tiny">/ ${money(r.limit)}</span></span></div>${bar(pct,over?"var(--red)":A.catColor(r.cats[0]))}
    <div class="tiny">${over?`<span class="neg">Over by ${money(r.spent-r.limit)}</span>`:`${money(r.limit-r.spent)} left`}${hot?' <span class="flag">ahead of pace</span>':""}</div></div>`;}).join("")}
  <button class="btn" onclick="openBudget()">Add budget</button>
  ${unb.length?`<div class="card" style="margin-top:12px"><div class="section-title">Spending without a budget</div>${unb.map(([c,v])=>`<div class="kv"><span>${dot(c)}${c}</span><span><b>${money(v)}</b> <button class="chip" onclick="openBudget(null,'${c}')">+ budget</button></span></div>`).join("")}</div>`:""}`;
}

export function goalCard(g){
  const S=ctx.S,acct=S.bank.accounts.find(a=>a.id===g.accountId);
  const va=(S.virtuals||[]).find(v=>v.id===g.virtualId);
  const saved=va?Number(va.amount)||0:acct?Math.max(0,A.accountBalance(acct)-(Number(g.startBalance)||0)):Number(g.saved)||0;
  const target=Number(g.target)||0,left=Math.max(0,target-saved),today=todayISO();
  const days=g.date?daysBetween(today,g.date):null;const pc=g.date?A.paychequesBetween(today,g.date):null;
  const per=pc&&pc.n?left/pc.n:null;
  const T=A.txns(),from=addDays(today,-60);let net=0;T.filter(t=>t.date>from).forEach(t=>{if(A.isIncome(t))net+=t.amount;else if(A.isSpend(t))net+=t.amount;});
  const months=days!=null?Math.max(0.25,days/30.44):null,needMo=months?left/months:null,surplusMo=net/2;
  let status="";if(!target)status='<span class="flag">set a target</span>';else if(left<=0)status='<span class="flag ok">reached</span>';else if(days!=null&&days<0)status='<span class="flag">past due</span>';else if(needMo!=null&&T.length)status=surplusMo>=needMo?'<span class="flag ok">on track</span>':'<span class="flag">behind</span>';
  return `<div class="card" onclick="openGoal('${g.id}')"><div class="row" style="justify-content:space-between"><b>${esc(g.name)}</b>${status}</div>
   ${bar(target?saved/target*100:0,"var(--gold)")}
   <div class="row" style="justify-content:space-between"><span class="tiny">${money(saved)} of ${money(target)}${va?` · ${esc(va.name)} (virtual)`:acct?` · from ${esc(acct.name)}`:""}</span><span class="tiny">${g.date?`${niceDate(g.date)} · ${days>=0?days+" days":"passed"}`:""}</span></div>
   ${left>0&&target?`<div class="tiny" style="margin-top:6px">${per!=null?`Save <b>${money(per)}</b> per paycheque (${pc.n} left)`:days>0?`Save ${money(left/Math.max(1,days/7))}/week (not enough history yet; set your pay schedule in Settings)`:""}</div>`:""}</div>`;
}
export function goals(){return syncLine()+ctx.S.goals.map(goalCard).join("")+`<button class="btn" onclick="openGoal()">Add goal</button>`;}

function chart(f){
  const W=340,H=120,P=f.pts,vals=P.map(p=>p.bal),mn=Math.min(f.low,...vals),mx=Math.max(...vals,f.low+1),y=v=>H-6-(v-mn)/(mx-mn||1)*(H-12),x=i=>i/(P.length-1)*W;
  const path=P.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.bal).toFixed(1)}`).join("");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${y(f.low)}" y2="${y(f.low)}" stroke="var(--red)" stroke-dasharray="4 4" stroke-width="1"/><path d="${path}" fill="none" stroke="var(--gold)" stroke-width="2"/></svg>`;
}
export function plan(){
  const f=A.forecast(60),rec=A.recurring(),ch=rec.filter(r=>r.type==="charge"),inc=rec.filter(r=>r.type==="income");
  const total=ch.reduce((s,r)=>s+A.monthlyCost(r),0);
  const fc=!f?empty("Forecast needs a synced chequing account."):`<div class="card ${f.firstLow?"warn":""}"><div class="section-title">Cash-flow forecast · ${esc(f.acct.name)}</div>${chart(f)}
    <div class="kv"><span>Today${f.net&&f.owed?" (free, net of cards)":" (free)"}</span><b>${money(f.start)}</b></div>
    ${f.nextPay?`<div class="kv"><span>Day before payday (${niceDate(f.nextPay.date)})</span><b>${money(f.balAtPay)}</b></div><div class="kv"><span>Next paycheque</span><b class="pos">${money(f.nextPay.amount,true)}</b></div>`:'<div class="tiny">Not enough history yet. Set your pay schedule in Settings.</div>'}
    <div class="kv"><span>Lowest (${niceDate(f.min.date)})</span><b class="${f.min.bal<f.low?"neg":""}">${money(f.min.bal)}</b></div>
    <div class="kv"><span>Everyday spending assumed</span><b>${money(f.daily*30.44)}/mo</b></div><div class="kv"><span>In 60 days</span><b>${money(f.end)}</b></div>
    ${f.firstLow?`<div class="tiny neg" style="margin-top:6px">Warning: projected below your ${money(f.low)} floor on ${niceDate(f.firstLow.date)}.</div>`:""}
    <details style="margin-top:8px"><summary class="tiny">Upcoming (${f.events.length})</summary>${f.events.slice(0,25).map(e=>`<div class="kv"><span class="l">${niceDate(e.date)} · ${esc(e.name)}</span><b class="${e.amount>0?"pos":""}">${money(e.amount,true)}</b></div>`).join("")}</details></div>`;
  const subs=`<div class="card"><div class="section-title">Subscriptions & bills <span class="tiny">≈ ${money(total)}/mo</span></div>
    ${ch.map(r=>`<div class="kv"><span class="l">${dot(r.category)}${esc(r.merchant)}${r.isNew?' <span class="flag">new</span>':""}${r.increased?` <span class="flag">up from ${money(r.prevAmount)}</span>`:""}<br><span class="tiny">${A.periodLabel(r.period)} · next ~${niceDate(r.next)}</span></span><b>${money(r.amount)}</b></div>`).join("")||'<div class="tiny">None detected yet. Needs a couple of months of history.</div>'}</div>
    ${!inc.length&&A.manualStreams().length?`<div class="card"><div class="section-title">Income (from your pay schedule)</div>${A.manualStreams().map(r=>`<div class="kv"><span class="l">${esc(r.merchant)}<br><span class="tiny">${A.periodLabel(r.period)} · next ${niceDate(r.next)}</span></span><b class="pos">${money(r.amount)}</b></div>`).join("")}</div>`:""}
    ${inc.length?`<div class="card"><div class="section-title">Income detected</div>${inc.map(r=>`<div class="kv"><span class="l">${esc(r.merchant)}<br><span class="tiny">${A.periodLabel(r.period)} · next ~${niceDate(r.next)}</span></span><b class="pos">${money(r.amount)}</b></div>`).join("")}</div>`:""}`;
  return syncLine()+fc+subs+debts();
}
function debtBal(d){return Math.max(0,(Number(d.balance??d.principal)||0)-(d.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0));}
function payoff(d){const r=(Number(d.apr)||0)/1200,p=Number(d.minPay)||0;let b=debtBal(d),m=0;if(p<=0)return null;while(b>0.5&&m<600){b=b*(1+r)-p;m++;}return m>=600?null:m;}
function debts(){const D=ctx.S.debts;return `<div class="section-title" style="margin-top:14px">Loans</div>${D.map(d=>{const m=payoff(d);return `<div class="card" onclick="openDebt('${d.id}')"><div class="row" style="justify-content:space-between"><b>${esc(d.name)}</b><b>${money(debtBal(d))}</b></div><div class="tiny">${d.apr||0}% APR${d.minPay?` · ${money(d.minPay)}/mo · paid off in ~${m!=null?m+" months":"never at this rate"}`:""}${d.note?" · "+esc(d.note):""}</div></div>`;}).join("")}<button class="btn ghost" onclick="openDebt()">Add loan</button>`;}

export function invest(){const H=ctx.S.invest||[];const tot=H.reduce((s,h)=>s+(Number(h.shares)||0)*(Number(h.last)||0),0);
  return `<div class="card"><div class="tiny">Holdings value</div><div style="font-size:26px;font-weight:700">${money(tot)}</div><div class="tiny">${esc(ctx.investMsg||"")}</div></div>${H.map(h=>`<div class="card"><div class="row" style="justify-content:space-between"><b>${esc(h.ticker)}</b><b>${money((h.shares||0)*(h.last||0))}</b></div><div class="tiny">${h.shares} × ${money(h.last)} ${esc(h.currency||"")}${h.cost?` · cost ${money(h.cost)}`:""} <button class="chip" onclick="delHolding('${h.id}')">remove</button></div></div>`).join("")}
  <button class="btn" onclick="addHolding()">Add holding</button><button class="btn ghost" onclick="refreshHoldings()">Refresh prices</button>`;}

export function sync(){const B=ctx.S.bank;const last=(B.imports||[])[0];
  return syncLine()+`<div class="card"><div class="section-title">Sync bank data</div><div class="tiny">Paste the JSON snapshot from Stack Finance and tap Import. Accounts update in place; transactions are de-duplicated by id. Nothing here is ever published to GitHub.</div>
  <textarea id="syncInput" class="syncbox" placeholder='{"lastSynced":"…","accounts":[…],"transactions":[…]}'></textarea>
  <button class="btn" id="syncBtn" onclick="doSync()">Import</button><div id="syncResult" class="tiny" style="margin-top:8px">${last?`Last import ${ago(last.at)}: +${last.added} new, ${last.updated} updated, ${last.accountsUpdated+last.accountsAdded} accounts.`:""}</div></div>
  <div class="card"><div class="tiny" id="syncStats">${syncStats()}</div></div>`;}
export function syncStats(){const B=ctx.S.bank;return `${B.accounts.length} accounts · ${B.transactions.length} transactions stored${B.lastSynced?" · last synced "+ago(B.lastSynced):""}${B.transactions.length>4000?' · <span class="neg">getting large; consider trimming history</span>':""}`;}

export function settings(){const S=ctx.S,st=S.settings;
  return `<div class="card"><div class="section-title">Account</div><div class="tiny">${ctx.fbUser?"Signed in as "+esc(ctx.fbUser.email):ctx.demo?"Demo mode: nothing is saved":"Not signed in. Data is only on this device."}</div>${ctx.fbUser?'<button class="btn ghost" onclick="authSignOut()">Sign out</button>':ctx.demo?"":'<button class="btn" onclick="showAuth()">Sign in</button>'}</div>
  <div class="card"><label>Name</label><input id="s-name" value="${esc(st.name)}">
   <label>Low-balance warning (chequing)</label><input id="s-low" type="number" value="${esc(st.lowBalance)}">
   <label>Forecast account</label><select id="s-prim"><option value="">Auto (chequing)</option>${S.bank.accounts.map(a=>`<option value="${esc(a.id)}" ${a.id===st.primaryAccountId?"selected":""}>${esc(a.name)}</option>`).join("")}</select>
   <label><input type="checkbox" id="s-net" ${st.netCredit?"checked":""} style="width:auto"> Show Chequing net of credit cards owed (card spending counts against Chequing)</label>
   <label><input type="checkbox" id="s-inv" ${st.showInvest?"checked":""} style="width:auto"> Show Invest tab</label>
   <label><input type="checkbox" id="s-hide" ${st.hideMoney?"checked":""} style="width:auto"> Hide amounts</label>
   <button class="btn" onclick="saveSettings()">Save</button></div>
  <div class="card"><div class="section-title">Pay schedule</div><div class="tiny">Used for the forecast and goals until enough paycheques have synced to detect the pattern automatically${A.recurring().some(r=>r.type==="income")?' (<span class="pos">auto-detected now, so this is ignored</span>)':""}.</div>
   ${[0,1].map(i=>{const j=(st.paySchedule||[])[i]||{};return `<div style="margin-top:10px"><label>Job ${i+1} name</label><input id="ps-name${i}" value="${esc(j.name||"")}" placeholder="${i?"e.g. EA":"e.g. Chartright"}">
   <div class="grid2"><div><label>Take-home per cheque</label><input id="ps-amt${i}" type="number" step="0.01" value="${j.amount||""}"></div><div><label>How often</label><select id="ps-freq${i}">${["biweekly","weekly","semimonthly","monthly"].map(f=>`<option value="${f}" ${(j.frequency||"biweekly")===f?"selected":""}>${{biweekly:"Every 2 weeks",weekly:"Weekly",semimonthly:"Twice a month",monthly:"Monthly"}[f]}</option>`).join("")}</select></div></div>
   <label>Next pay date</label><input id="ps-next${i}" type="date" value="${j.next||""}"></div>`;}).join("")}
   <button class="btn" onclick="savePaySchedule()">Save pay schedule</button></div>
  <div class="card"><div class="section-title">Style</div><div class="theme-grid">${STYLES.map(s=>`<button class="theme-chip ${(st.style||"vault")===s.id?"on":""}" onclick="setStyle('${s.id}')"><span class="theme-swatch" style="background:${s.a}"><i style="background:${s.b}"></i></span>${s.name}</button>`).join("")}</div></div>
  <div class="card"><div class="section-title">Merchant category overrides</div>${Object.entries(S.merchantCats).map(([k,c])=>`<div class="kv"><span class="l">${esc(k)} → ${c}</span><button class="chip" onclick="clearCat('${esc(k)}')">reset</button></div>`).join("")||'<div class="tiny">None. Tap a transaction on Spending to set one.</div>'}</div>
  <div class="card"><div class="section-title">Backup</div><button class="btn" onclick="exportData()">Export backup (JSON)</button><button class="btn ghost" onclick="document.getElementById('imp').click()">Restore backup</button><input id="imp" type="file" accept="application/json" style="display:none" onchange="importData(event)"><button class="btn ghost" onclick="exportMonthPdf()">Print this month (PDF)</button></div>
  <details class="card"><summary class="tiny">Accounts in Stack</summary>${S.bank.accounts.map(a=>`<div class="kv"><span class="l">${esc(a.name)}${a.mask?" ··"+esc(a.mask):""}</span><button class="chip" onclick="removeAcct('${esc(a.id)}')">Remove</button></div>`).join("")||'<div class="tiny">No accounts.</div>'}${(st.ignoredMasks||[]).length?`<div class="tiny" style="margin-top:6px">Skipped on import: ${st.ignoredMasks.map(m=>`··${esc(m)} <button class="chip" onclick="unignoreMask('${esc(m)}')">undo</button>`).join(" ")}</div>`:""}</details>
  <details class="card"><summary class="tiny">Advanced: manual balance adjust</summary><div class="tiny">Only if sync is broken. Overrides an account balance until the next sync.</div>${S.bank.accounts.map(a=>`<div class="kv"><span class="l">${esc(a.name)}</span><input style="width:120px" type="number" step="0.01" id="adj-${esc(a.id)}" value="${A.accountBalance(a)}"><button class="chip" onclick="adjust('${esc(a.id)}')">set</button></div>`).join("")||'<div class="tiny">No accounts.</div>'}</details>`;}
export const STYLES=[{id:"vault",name:"Vault",a:"#0c121b",b:"#d4b06a"},{id:"ice",name:"Vault Ice",a:"#0b121a",b:"#9ec0d8"},{id:"midnight",name:"Midnight Gold",a:"#07080b",b:"#d4b06a"},{id:"harbour",name:"Harbour",a:"#07141a",b:"#5ec4b0"},{id:"graphite",name:"Graphite",a:"#111214",b:"#7f92aa"},{id:"slate",name:"Slate Sky",a:"#1a222c",b:"#d4b06a"},{id:"ember",name:"Ember",a:"#120e0c",b:"#d4894a"},{id:"alpine",name:"Alpine",a:"#0c1614",b:"#d7c396"},{id:"signal",name:"Signal",a:"#0c121b",b:"#e0b34a"}];
