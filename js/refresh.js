// "Refresh from BMO": the app writes stack/<uid>.refreshRequest; a box worker (with Penny) fulfils it.
// Schema: refreshRequest = {id, at:ms, status:"pending"|"claimed"|"done"|"error", by:"app", claimedAt?, doneAt?, error?, result?}
export const THROTTLE_MS=5*60e3;
export const STALE_MS=20*60e3; // a request nobody finished in 20 min is shown as timed out
export function canRequest(req,now=Date.now()){if(!req||!req.at)return {ok:true,wait:0};const wait=req.at+THROTTLE_MS-now;return wait>0?{ok:false,wait}:{ok:true,wait:0};}
export function newRequest(now=Date.now()){return {id:"r"+now.toString(36),at:now,status:"pending",by:"app"};}
const hhmm=ms=>new Date(ms).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
// UI label from the request + whether bank.lastSynced advanced since the request was made.
export function refreshLabel(req,lastSynced,now=Date.now()){
  if(!req||!req.at)return "";
  const synced=lastSynced?Date.parse(lastSynced):0;
  if(req.status==="done"||synced>req.at)return "Updated "+hhmm(req.doneAt||Math.max(synced,req.at));
  if(req.status==="error")return "Refresh failed"+(req.error?": "+String(req.error).slice(0,80):"");
  if(now-req.at>STALE_MS)return "Refresh timed out, try again";
  return "Refresh requested…";
}
