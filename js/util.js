export const pad=n=>String(n).padStart(2,"0");
export const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const todayISO=()=>iso(new Date());
export const monthKey=(s=todayISO())=>s.slice(0,7);
export function addDays(s,n){const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return iso(d);}
export function addMonths(s,n){const d=new Date(s+"T12:00:00");const day=d.getDate();d.setMonth(d.getMonth()+n);if(d.getDate()!==day)d.setDate(0);return iso(d);}
export const daysBetween=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000);
export const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
export function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export const val=id=>document.getElementById(id)?.value??"";
export const num=id=>parseFloat(val(id)||"0")||0;
export function ago(ts){if(!ts)return "never";const t=typeof ts==="number"?ts:Date.parse(ts);if(!t)return "never";const s=Math.max(0,(Date.now()-t)/1000);if(s<90)return "just now";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago";}
export const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2;};
export function monthLabel(mk){const [y,m]=mk.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString(undefined,{month:"long",year:"numeric"});}
export function niceDate(s){return new Date(s+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});}
