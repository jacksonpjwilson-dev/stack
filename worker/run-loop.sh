#!/usr/bin/env bash
# Stack refresh worker loop (no cron/systemd on the box). Start ONLY after refresh-btn is merged:
#   STACK_UID=Sz9kHcgl3fhuUO6Xh9I7tyG8wuI3 nohup /workspace/stack/worker/run-loop.sh >/dev/null 2>&1 &
# Needs STACK_SA_KEY_JSON (or STACK_SA_KEY path) in the environment. Logs: /tmp/stack-refresh.log. Stop: kill $(cat /tmp/stack-refresh.pid)
cd "$(dirname "$0")" || exit 1
: "${STACK_UID:?set STACK_UID}"
[ -n "$STACK_SA_KEY_JSON$STACK_SA_KEY" ] || { echo "no key in env" >>/tmp/stack-refresh.log; exit 1; }
echo $$ >/tmp/stack-refresh.pid
mkdir -p /home/box/shared/stack-refresh
while true; do
  out=$(timeout 120 node refresh-worker.mjs 2>&1 | grep -v -i "private_key"); rc=$?
  [ -n "$out" ] && echo "$(date -Is) $out" >>/tmp/stack-refresh.log
  sleep 180
done
