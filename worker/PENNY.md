# Penny: fulfilling a Stack "Refresh from BMO" request
Each run of your frequent routine (every 3–5 min, or when woken):
1. If `/home/box/shared/stack-refresh/request.json` does not exist, stop (nothing requested).
2. Read its `id`. Pull BMO with the Finance connector (finance_list_accounts + transactions), build the same JSON you paste on Stack's Sync screen
   (`{lastSynced, accounts:[{id,name,mask,type,subtype,currentBalance,availableBalance}], transactions:[{id,date,amount,merchant,category,accountId,pending}]}`, negative amount = money out).
3. Write `/home/box/shared/stack-refresh/snapshot.json` as `{"requestId":"<id>","payload":{...}}`.
   On failure write `{"requestId":"<id>:error","error":"short reason"}`.
4. Do not paste into Stack yourself for this request; the worker applies it (same relink/dedupe/ignored-account rules) and marks it done.
