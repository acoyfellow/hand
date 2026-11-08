K=$(ps eww "$(pgrep -f bridge/mcp-host.mjs | head -1)" | tr ' ' '\n' | grep '^T2T_KEY=' | cut -d= -f2)
call() { perl -e 'alarm 60; exec @ARGV' curl -s -X POST localhost:5196/call -H "authorization: Bearer $K" -H 'content-type: application/json' -d "$1" > /dev/null; }
perl -e 'alarm 40; exec @ARGV' curl -s -X POST localhost:5196/connect -H "authorization: Bearer $K" -H 'content-type: application/json' -d '{"server":"hand"}' > /dev/null
SEQ=$(curl -s "localhost:5196/actions?since=0" -H "authorization: Bearer $K" | bun -e 'console.log(JSON.parse(await Bun.stdin.text()).seq)')
open -a TextEdit
sleep 1
osascript -e 'tell application "TextEdit" to make new document' -e 'tell application "TextEdit" to activate' > /dev/null
sleep 1
call '{"server":"hand","tool":"menu","arguments":{"app":"TextEdit","path":["Format","Font","Show Fonts"]}}'
screencapture -x /tmp/cp-1.png
sleep 0.5
screencapture -x /tmp/cp-2.png
call '{"server":"hand","tool":"act","arguments":{"app":"TextEdit","intent":"press the bold button"}}' &
sleep 1.2
screencapture -x /tmp/cp-3.png
wait
curl -s "localhost:5196/actions?since=$SEQ" -H "authorization: Bearer $K" | bun -e 'for (const e of JSON.parse(await Bun.stdin.text()).events) console.log(e.phase, e.action, e.target?.name, e.target?.x, e.target?.y)'
osascript -e 'tell application "TextEdit" to close every document saving no' -e 'quit app "TextEdit"' > /dev/null 2>&1
for n in 1 2 3; do sips -Z 1400 /tmp/cp-$n.png --out /tmp/cp-$n-s.png > /dev/null; done
