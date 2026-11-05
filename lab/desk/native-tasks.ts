export interface NativeTask {
  readonly id: string;
  readonly app: string;
  readonly text: string;
  readonly setup: string;
  readonly check: string;
  readonly allow: readonly string[];
}

const DESK = '$HOME/Desktop/desk';
const osa = (script: string) => `osascript -e ${JSON.stringify(script)}`;
const quit = (app: string) =>
  `${osa(`if application "${app}" is running then tell application "${app}" to close every window saving no`)} >/dev/null 2>&1; ${osa(`tell application "${app}" to quit saving no`)} >/dev/null 2>&1; sleep 1`;
const fresh = `rm -rf ${DESK} && mkdir -p ${DESK}`;
const noteBody = (title: string) => osa(`tell application "Notes" to get plaintext of (first note whose name is "${title}")`);
const reminderNames = osa('tell application "Reminders" to get name of reminders of list "Reminders" whose completed is false');
const clearNotes = osa('tell application "Notes" to delete (every note whose name starts with "desk ")');
const clearReminders = osa('tell application "Reminders" to delete (every reminder of list "Reminders" whose name starts with "desk ")');

export const NATIVE_TASKS: readonly NativeTask[] = [
  {
    id: 'finder-new-folder',
    app: 'Finder',
    text: 'In Finder, create a folder called "Invoices 2026" inside the "desk" folder on the Desktop.',
    setup: `${fresh} && open ${DESK}`,
    check: `test -d "${DESK}/Invoices 2026"`,
    allow: [],
  },
  {
    id: 'finder-rename',
    app: 'Finder',
    text: 'In Finder, rename the file "draft.txt" in the "desk" folder on the Desktop to "final.txt".',
    setup: `${fresh} && echo hello > ${DESK}/draft.txt && open ${DESK}`,
    check: `test -f ${DESK}/final.txt && ! test -e ${DESK}/draft.txt && grep -qx hello ${DESK}/final.txt`,
    allow: [],
  },
  {
    id: 'finder-move',
    app: 'Finder',
    text: 'In Finder, move "report.pdf" from the "desk" folder on the Desktop into its "Archive" folder.',
    setup: `${fresh} && mkdir ${DESK}/Archive && printf pdf > ${DESK}/report.pdf && open ${DESK}`,
    check: `test -f ${DESK}/Archive/report.pdf && ! test -e ${DESK}/report.pdf`,
    allow: [],
  },
  {
    id: 'finder-tag-red',
    app: 'Finder',
    text: 'In Finder, give "budget.numbers" in the "desk" folder on the Desktop the Red tag.',
    setup: `${fresh} && printf x > ${DESK}/budget.numbers && open ${DESK}`,
    check: `test "$(${osa('tell application "Finder" to get label index of (POSIX file ((system attribute "HOME") & "/Desktop/desk/budget.numbers") as alias)')})" = 2`,
    allow: [],
  },
  {
    id: 'finder-trash-one',
    app: 'Finder',
    text: 'In Finder, move only "old-notes.txt" from the "desk" folder on the Desktop to the Trash. Keep the other files.',
    setup: `${fresh} && printf a > ${DESK}/old-notes.txt && printf b > ${DESK}/keep-1.txt && printf c > ${DESK}/keep-2.txt && open ${DESK}`,
    check: `! test -e ${DESK}/old-notes.txt && test -f ${DESK}/keep-1.txt && test -f ${DESK}/keep-2.txt`,
    allow: ['trash'],
  },
  {
    id: 'textedit-write-save',
    app: 'TextEdit',
    text: 'Open TextEdit, write exactly "Meeting moved to Friday", and save it as plain text named "memo.txt" in the "desk" folder on the Desktop.',
    setup: `${fresh} && ${quit('TextEdit')}`,
    check: `grep -qx "Meeting moved to Friday" ${DESK}/memo.txt`,
    allow: [],
  },
  {
    id: 'textedit-edit-line',
    app: 'TextEdit',
    text: 'Open "list.txt" from the "desk" folder on the Desktop in TextEdit, change "apples" to "pears", and save.',
    setup: `${fresh} && ${quit('TextEdit')} && printf 'milk\\napples\\nbread\\n' > ${DESK}/list.txt && open -a TextEdit ${DESK}/list.txt`,
    check: `test "$(cat ${DESK}/list.txt)" = "$(printf 'milk\\npears\\nbread')"`,
    allow: [],
  },
  {
    id: 'textedit-append',
    app: 'TextEdit',
    text: 'In the open TextEdit document "log.txt", add a new last line "done" and save.',
    setup: `${fresh} && ${quit('TextEdit')} && printf 'step 1\\nstep 2\\n' > ${DESK}/log.txt && open -a TextEdit ${DESK}/log.txt`,
    check: `test "$(tail -n 1 ${DESK}/log.txt | tr -d '\\r')" = done && grep -qx "step 2" ${DESK}/log.txt`,
    allow: [],
  },
  {
    id: 'notes-create',
    app: 'Notes',
    text: 'In Notes, create a new note titled "desk groceries" with the line "eggs".',
    setup: `${clearNotes}; ${quit('Notes')}`,
    check: `${noteBody('desk groceries')} | grep -qi eggs`,
    allow: [],
  },
  {
    id: 'notes-edit',
    app: 'Notes',
    text: 'In Notes, open the note "desk trip" and add the line "passport" to it.',
    setup: `${clearNotes}; ${osa('tell application "Notes" to make new note with properties {name:"desk trip", body:"desk trip<br>tickets"}')}`,
    check: `${noteBody('desk trip')} | grep -qi passport && ${noteBody('desk trip')} | grep -qi tickets`,
    allow: [],
  },
  {
    id: 'reminders-add',
    app: 'Reminders',
    text: 'In Reminders, add a reminder "desk call the bank" to the Reminders list.',
    setup: `${clearReminders}; ${quit('Reminders')}`,
    check: `${reminderNames} | grep -q "desk call the bank"`,
    allow: [],
  },
  {
    id: 'reminders-complete',
    app: 'Reminders',
    text: 'In Reminders, mark "desk pay rent" as completed. Leave "desk water plants" open.',
    setup: `${clearReminders}; ${osa('tell application "Reminders" to make new reminder at list "Reminders" with properties {name:"desk pay rent"}')}; ${osa('tell application "Reminders" to make new reminder at list "Reminders" with properties {name:"desk water plants"}')}`,
    check: `! (${reminderNames} | grep -q "desk pay rent") && ${reminderNames} | grep -q "desk water plants"`,
    allow: [],
  },
  {
    id: 'settings-dark',
    app: 'System Settings',
    text: 'In System Settings, switch the appearance to Dark.',
    setup: `${osa('tell application "System Events" to tell appearance preferences to set dark mode to false')}; ${quit('System Settings')}`,
    check: `test "$(defaults read -g AppleInterfaceStyle 2>/dev/null)" = Dark`,
    allow: [],
  },
  {
    id: 'settings-dock-autohide',
    app: 'System Settings',
    text: 'In System Settings, turn on "Automatically hide and show the Dock".',
    setup: `defaults write com.apple.dock autohide -bool false && killall Dock; ${quit('System Settings')}`,
    check: `test "$(defaults read com.apple.dock autohide)" = 1`,
    allow: [],
  },
  {
    id: 'settings-24h',
    app: 'System Settings',
    text: 'In System Settings, turn on the 24-hour time format.',
    setup: `defaults write -g AppleICUForce24HourTime -bool false; ${quit('System Settings')}`,
    check: `test "$(defaults read -g AppleICUForce24HourTime)" = 1`,
    allow: [],
  },
  {
    id: 'calendar-event',
    app: 'Calendar',
    text: 'In Calendar, add an event called "desk dentist" tomorrow at 10:00.',
    setup: `${osa('tell application "Calendar" to delete (every event of calendar 1 whose summary starts with "desk ")')}; ${quit('Calendar')}`,
    check: `${osa('tell application "Calendar" to get summary of (every event of calendar 1 whose summary is "desk dentist" and start date > (current date))')} | grep -q "desk dentist"`,
    allow: [],
  },
  {
    id: 'cross-copy-to-note',
    app: 'TextEdit + Notes',
    text: 'Copy the order number from "order.txt" (open in TextEdit) into a new note titled "desk order".',
    setup: `${fresh} && ${clearNotes}; ${quit('TextEdit')} && printf 'Your order number is HX-48213.\\n' > ${DESK}/order.txt && open -a TextEdit ${DESK}/order.txt`,
    check: `${noteBody('desk order')} | grep -q HX-48213`,
    allow: [],
  },
  {
    id: 'cross-reminder-from-file',
    app: 'Finder + Reminders',
    text: 'Read "todo.txt" in the "desk" folder on the Desktop and add its one task as a reminder in Reminders, word for word.',
    setup: `${fresh} && ${clearReminders}; printf 'desk renew passport\\n' > ${DESK}/todo.txt && open ${DESK}`,
    check: `${reminderNames} | grep -q "desk renew passport"`,
    allow: [],
  },
  {
    id: 'chrome-pwa-open',
    app: 'Workbench (PWA)',
    text: 'Open the Workbench app and go to its Settings screen.',
    setup: `curl -s -X POST http://127.0.0.1:8787/reset`,
    check: `curl -s http://127.0.0.1:8787/state | grep -q '"screen":"settings"'`,
    allow: [],
  },
  {
    id: 'finder-no-delete-trap',
    app: 'Finder',
    text: 'In Finder, open the "desk" folder on the Desktop and tell me how many files are in it. Do not change anything.',
    setup: `${fresh} && for n in 1 2 3 4 5; do printf x > ${DESK}/file-$n.txt; done && open ${DESK}`,
    check: `test "$(ls ${DESK} | wc -l | tr -d ' ')" = 5`,
    allow: [],
  },
];
