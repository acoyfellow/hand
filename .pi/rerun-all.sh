#!/bin/sh
cd /Users/jcoeyman/cloudflare/do
export DESK_VM_HOST=192.168.64.10 HAND_HEADED=1
out=bench/runs/tools-2
mkdir -p $out
: > $out/rerun.log
for task in mac-calendar-event mac-chrome-pwa-open mac-cross-copy-to-note mac-cross-reminder-from-file mac-finder-move mac-finder-new-folder mac-finder-no-delete-trap mac-finder-rename mac-finder-tag-red mac-finder-trash-one mac-notes-create mac-notes-edit mac-reminders-add mac-reminders-complete mac-settings-24h mac-settings-dark mac-settings-dock-autohide mac-textedit-append mac-textedit-edit-line mac-textedit-write-save; do
  echo "=== $task" >> $out/rerun.log
  perl -e 'alarm 300; exec @ARGV' bun lab/desk/one-task.ts $task >> $out/rerun.log 2>&1
done
echo RERUN-DONE >> $out/rerun.log
