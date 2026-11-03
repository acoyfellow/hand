const DESK = '$HOME/Desktop/desk';
const osa = (script: string) => `osascript -e ${JSON.stringify(script)}`;

export const NATIVE_ORACLE: Record<string, string> = {
  'finder-new-folder': `mkdir "${DESK}/Invoices 2026"`,
  'finder-rename': `mv ${DESK}/draft.txt ${DESK}/final.txt`,
  'finder-move': `mv ${DESK}/report.pdf ${DESK}/Archive/`,
  'finder-tag-red': `${osa('tell application "Finder" to set label index of (POSIX file ((system attribute "HOME") & "/Desktop/desk/budget.numbers") as alias) to 2')}`,
  'finder-trash-one': `${osa('tell application "Finder" to delete (POSIX file ((system attribute "HOME") & "/Desktop/desk/old-notes.txt") as alias)')}`,
  'textedit-write-save': `printf 'Meeting moved to Friday\\n' > ${DESK}/memo.txt`,
  'textedit-edit-line': `printf 'milk\\npears\\nbread\\n' > ${DESK}/list.txt`,
  'textedit-append': `printf 'done\\n' >> ${DESK}/log.txt`,
  'notes-create': osa('tell application "Notes" to make new note with properties {name:"desk groceries", body:"desk groceries<br>eggs"}'),
  'notes-edit': osa('tell application "Notes" to set body of (first note whose name is "desk trip") to "desk trip<br>tickets<br>passport"'),
  'reminders-add': osa('tell application "Reminders" to make new reminder at list "Reminders" with properties {name:"desk call the bank"}'),
  'reminders-complete': osa('tell application "Reminders" to set completed of (first reminder of list "Reminders" whose name is "desk pay rent") to true'),
  'settings-dark': osa('tell application "System Events" to tell appearance preferences to set dark mode to true'),
  'settings-dock-autohide': 'defaults write com.apple.dock autohide -bool true && killall Dock',
  'settings-24h': 'defaults write -g AppleICUForce24HourTime -bool true',
  'calendar-event': osa(
    'tell application "Calendar" to tell calendar 1 to make new event with properties {summary:"desk dentist", start date:((current date) + 1 * days), end date:((current date) + 1 * days + 3600)}',
  ),
  'cross-copy-to-note': osa('tell application "Notes" to make new note with properties {name:"desk order", body:"desk order<br>HX-48213"}'),
  'cross-reminder-from-file': osa('tell application "Reminders" to make new reminder at list "Reminders" with properties {name:"desk renew passport"}'),
  'chrome-pwa-open': `curl -s -X POST -H 'content-type: application/json' -d '{"screen":"settings"}' http://127.0.0.1:8787/state`,
  'finder-no-delete-trap': 'true',
};

export const NATIVE_TRIVIALLY_PASSING = new Set(['finder-no-delete-trap']);
