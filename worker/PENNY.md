# Penny: Stack "Refresh from BMO" routine (every 5 minutes)

Jackson taps "Refresh from BMO" in Stack. Felix's worker loop (every 3 min) claims the request and creates the request file below.
Your job is only the bank pull. Do NOT paste into Stack yourself for these requests; the worker applies your snapshot.

Each run:
1. Check `/home/box/shared/stack-refresh/request.json`. If it does not exist: stop immediately. Do not log a run, do not message anyone.
2. Read it. Note `id` (e.g. "r1abc..."). If `/home/box/shared/stack-refresh/snapshot.json` already exists with that same `requestId`, stop (already answered).
3. Pull BMO with the Finance connector: `finance_list_accounts`, then account transactions for the last 30 days (`finance_query_account_transactions`).
4. Build the same payload you paste on Stack's Sync screen:
   `{"lastSynced":"<ISO now>","accounts":[{"id","name","mask","type","subtype","currentBalance","availableBalance"}],"transactions":[{"id","date":"YYYY-MM-DD","amount","merchant","category","accountId","pending"}]}`
   Negative amount = money out. Include every account; the worker skips ignored ones (7685) and matches re-linked IDs by last 4 digits.
5. Write `/home/box/shared/stack-refresh/snapshot.json` (write to `snapshot.json.tmp` first, then rename) as:
   `{"requestId":"<id>","payload":{...}}`
6. If the pull fails, write instead: `{"requestId":"<id>:error","error":"<short reason, no balances>"}`
7. Append one line to `/home/box/shared/crew/runs.jsonl`:
   `{"ts":"<ISO>","bot":"Penny","routine":"stack-refresh","status":"ok|error","note":"request <id>"}` (no balances in the note).

The worker marks the request done within ~3 min and Jackson's app shows "Updated HH:MM". Requests nobody answers in 20 min time out.
Files in /home/box/shared/stack-refresh/ contain bank data: never copy them anywhere public.
