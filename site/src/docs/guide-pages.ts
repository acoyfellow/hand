import reference from '../generated/reference.json';
import { codeBlock, GITHUB, type H } from '../views/kit.ts';
import { C, F, K, S, type Section, code, link, list, note, p, steps, strong } from './kit.ts';

const DMG = 'https://github.com/acoyfellow/hand/releases/latest/download/hand.dmg';
const RELEASES = `${GITHUB}/releases/latest`;

const MCP_JSON = `{\n  ${S('"mcpServers"')}: {\n    ${S('"hand"')}: {\n      ${S('"command"')}: ${S('"/Applications/hand.app/Contents/Resources/bin/hand"')},\n      ${S('"args"')}: [${S('"mcp"')}],\n      ${S('"env"')}: { ${S('"HAND_AX_HELPER"')}: ${S('"/Applications/hand.app/Contents/Resources/bin/ax"')} }\n    }\n  }\n}`;

export const overviewSections = (h: H): readonly Section[] => [
  {
    id: 'what',
    title: 'What hand is',
    body: [
      p(h, 'hand lets an AI agent use the apps on your Mac. It lists what can be clicked, a small model called Clef picks one and says how sure it is, and hand presses it and checks that it worked.'),
      p(h, 'It runs as an MCP server, so any agent that speaks MCP can use it. Clef runs on Workers AI in your own Cloudflare account, about a cent per task.'),
    ],
  },
  {
    id: 'start',
    title: 'Start here',
    body: [
      list(h, [
        [strong(h, 'Tutorial'), ' — ', link(h, '/docs/tutorials/first-task/', 'Install hand and run your first task'), '. Five minutes from download to an agent typing into TextEdit.'],
        [strong(h, 'How-to'), ' — ', link(h, '/docs/how-to/use-from-code/', 'Use hand from code'), '. Drive a Mac app from TypeScript.'],
        [strong(h, 'How-to'), ' — ', link(h, '/docs/how-to/headed-mode/', 'Turn on keystrokes and the mouse'), '. For Notes bodies, Finder renames and web pages.'],
        [strong(h, 'How-to'), ' — ', link(h, '/docs/how-to/run-agents-in-parallel/', 'Run several agents at once'), '. Each gets its own cursor.'],
        [strong(h, 'Reference'), ' — ', link(h, '/docs/reference/mcp-tools/', 'MCP tools'), `. All ${reference.tools.length}, every argument.`],
        [strong(h, 'Reference'), ' — ', link(h, '/docs/reference/hand-class/', 'The Hand class'), '. Every method and option.'],
        [strong(h, 'Reference'), ' — ', link(h, '/docs/reference/replies-and-errors/', 'Replies and error codes'), '. What went wrong and what to do.'],
        [strong(h, 'Explanation'), ' — ', link(h, '/docs/explanation/how-it-works/', 'How hand works'), '. Why it lists controls instead of guessing pixels.'],
        [strong(h, 'Explanation'), ' — ', link(h, '/docs/explanation/data-and-billing/', 'Data, billing and permissions'), '. What it reads and where it goes.'],
      ]),
    ],
  },
  {
    id: 'agents',
    title: 'For agents',
    body: [p(h, 'The whole reference as plain text is at ', link(h, '/llms-full.txt', 'llms-full.txt'), ', and a short version at ', link(h, '/llms.txt', 'llms.txt'), '.')],
  },
];

export const firstTaskSections = (h: H): readonly Section[] => [
  {
    id: 'before',
    title: 'Before you start',
    body: [list(h, [['A Mac with Apple silicon on macOS 13 or later.'], ['A Cloudflare account. The free plan works.'], ['An agent that supports MCP, such as Claude, Cursor, Codex, Zed, VS Code or Pi.']])],
  },
  {
    id: 'install',
    title: 'Install and set up',
    body: [
      steps(h, [
        [
          'Download and open hand',
          [
            p(h, link(h, DMG, 'Download hand.dmg'), ', open it and drag hand into Applications.'),
            note(h, strong(h, 'First open: '), 'hand is not signed by Apple yet. Right-click hand in Applications and choose Open, then Open again.'),
          ],
        ],
        ['Connect Cloudflare', [p(h, 'Click ', strong(h, 'Sign in with Cloudflare'), ' and approve it in your browser. hand picks your account and keeps the sign-in in your Keychain. If you prefer, choose ', strong(h, 'Use an API token instead'), '.')]],
        ['Allow hand to use apps', [p(h, 'Click ', strong(h, 'Open Settings'), ' and turn on hand under Accessibility. If hand is not in the list, drag it in from Applications.')]],
        ['Connect your agent', [p(h, 'Click ', strong(h, 'Copy MCP config'), ' and paste it into your agent’s MCP settings under ', code(h, 'mcpServers'), '. It looks like this:'), codeBlock(h, 'MCP config', MCP_JSON), p(h, 'Restart the agent.')]],
      ]),
    ],
  },
  {
    id: 'try',
    title: 'Run your first task',
    body: [
      p(h, 'Ask your agent:'),
      codeBlock(h, 'Prompt', 'Open TextEdit, make a new document and type "Hello from hand".'),
      p(h, 'You will see a cursor move to each control as the agent works. Each reply ends with a receipt saying what was done and whether hand saw it work.'),
      note(h, 'Nothing happened? See ', link(h, '/docs/how-to/fix-problems/', 'Fix common problems'), '.'),
    ],
  },
  {
    id: 'next',
    title: 'Next',
    body: [
      list(h, [
        [link(h, '/docs/how-to/headed-mode/', 'Turn on keystrokes and the mouse'), ' for apps that need real input.'],
        [link(h, '/docs/reference/mcp-tools/', 'MCP tools'), ' to see everything your agent can do.'],
      ]),
    ],
  },
];

export const codeSections = (h: H): readonly Section[] => [
  {
    id: 'install',
    title: 'Install',
    body: [p(h, 'You need a Mac, ', link(h, 'https://bun.sh', 'Bun'), ' and a Cloudflare account.'), codeBlock(h, 'Install', `${F('bun')} add github:acoyfellow/hand#release`), p(h, 'The ', code(h, 'release'), ' branch holds only the library, about 220 KB.')],
  },
  {
    id: 'credentials',
    title: 'Add Cloudflare credentials',
    body: [
      p(h, 'If you installed the app and signed in, hand already has credentials. Otherwise, the library calls Workers AI through an ', link(h, 'https://developers.cloudflare.com/ai-gateway/', 'AI Gateway'), ':'),
      list(h, [
        [strong(h, 'Account id:'), ' in the Cloudflare dashboard, Workers AI › Use REST API.'],
        [strong(h, 'API token:'), ' create one at ', link(h, 'https://dash.cloudflare.com/profile/api-tokens', 'dash.cloudflare.com/profile/api-tokens'), ' with Workers AI: Read and AI Gateway: Run.'],
      ]),
      codeBlock(
        h,
        'Credentials',
        `${F('mkdir')} -p ~/.config/hand\n${F('echo')} ${S(`'{"accountId": "&lt;id&gt;", "gateway": "default"}'`)} \\\n  &gt; ~/.config/hand/config.json\n\n${C('# paste the token when asked')}\n${F('security')} add-generic-password -a ${S('"$USER"')} -s hand-gateway -w`,
      ),
      p(h, 'Or set ', code(h, 'HAND_ACCOUNT_ID'), ', ', code(h, 'HAND_GATEWAY'), ' and ', code(h, 'HAND_TOKEN'), '. See ', link(h, '/docs/reference/settings/', 'Settings and credentials'), '.'),
    ],
  },
  {
    id: 'doctor',
    title: 'Check everything',
    body: [
      codeBlock(h, 'Doctor', `${F('bunx')} hand doctor`),
      p(h, 'It checks the credentials, builds the macOS helper, and checks Accessibility (required) and Screen Recording (only for ', code(h, 'look'), '). Anything missing comes with the exact fix. The permissions go to the app that runs your code, such as your terminal. Restart it after granting.'),
    ],
  },
  {
    id: 'drive',
    title: 'Drive an app',
    body: [
      codeBlock(
        h,
        'Library example',
        [
          `${K('import')} { gatewayTransport } ${K('from')} ${S("'hand/clef'")};`,
          `${K('import')} { readConfig, readToken } ${K('from')} ${S("'hand/credentials'")};`,
          `${K('import')} { macosDevice } ${K('from')} ${S("'hand/devices/macos'")};`,
          `${K('import')} { Hand } ${K('from')} ${S("'hand/hand'")};`,
          `${K('import')} { helperOrBuild } ${K('from')} ${S("'hand/helper'")};`,
          '',
          `${K('const')} transport = ${F('gatewayTransport')}({ ...${F('readConfig')}(), token: ${F('readToken')}() });`,
          `${K('const')} device = ${F('macosDevice')}({ helper: ${F('helperOrBuild')}(), app: ${S("'TextEdit'")}, headed: ${K('true')}, allowMouse: ${K('true')} });`,
          `${K('const')} hand = ${K('new')} ${F('Hand')}(transport, device, {`,
          `  model: ${S("'clef'")}, method: ${S("'ax_text'")}, verify: ${K('true')},`,
          '  tau: 0.5, minMargin: 0.6, riskTau: 0.5, injectionTau: 0.5,',
          '});',
          '',
          `${K('await')} hand.${F('outline')}();                      ${C('// controls with ids like e3')}`,
          `${K('await')} hand.${F('type')}(${S("'Hello from hand'")}, ${S("'the document'")});`,
          `${K('await')} hand.${F('act')}(${S("'the bold button'")});`,
          `${K('await')} hand.${F('look')}(${S("'Is the text bold?'")});      ${C('// p(yes)')}`,
          '',
          `console.${F('log')}(hand.costUsd, hand.steps);`,
        ].join('\n'),
      ),
      p(h, 'These are the same options the MCP server uses. Every method and option is in ', link(h, '/docs/reference/hand-class/', 'The Hand class'), '.'),
    ],
  },
];

export const headedSections = (h: H): readonly Section[] => [
  {
    id: 'headless',
    title: 'Headless, the default',
    body: [p(h, 'By default hand only uses accessibility actions. It never moves your mouse or sends keystrokes, so it cannot type into the wrong window.')],
  },
  {
    id: 'when',
    title: 'When you need headed mode',
    body: [
      p(h, 'Some steps need real input:'),
      list(h, [['Typing into a Notes body.'], ['Renaming a file in Finder.'], ['Clicking a web page control that has no accessibility action.'], ['Double click, right click and drag.']]),
      p(h, 'Those steps fail with ', code(h, 'POLICY_DENIED'), ' until headed mode is on.'),
    ],
  },
  {
    id: 'turn-on',
    title: 'Turn it on',
    body: [
      p(h, 'For the MCP server, add ', code(h, 'HAND_HEADED'), ' to its env:'),
      codeBlock(h, 'Headed MCP env', `${S('"env"')}: { ${S('"HAND_HEADED"')}: ${S('"1"')} }`),
      p(h, 'In code, pass it to the device:'),
      codeBlock(h, 'Headed device', `${F('macosDevice')}({ helper, app: ${S("'Notes'")}, headed: ${K('true')}, allowMouse: ${K('true')} })`),
      note(h, 'Headed mode sends keystrokes only to the target app and stops if that app stops being the front app (', code(h, 'NOT_FRONTMOST'), ').'),
    ],
  },
];

export const cursorSections = (h: H): readonly Section[] => [
  {
    id: 'default',
    title: 'The built-in cursor',
    body: [p(h, 'The MCP server starts a small overlay that shows a cursor and a label wherever each agent acts. You do not need to do anything for it.')],
  },
  {
    id: 'own',
    title: 'Draw your own',
    body: [
      p(h, 'If your app has its own overlay, read the ', code(h, 'hand.action'), ' notifications from the server. Each has the agent, the action, and the target’s box on screen, before and after the action.'),
      steps(h, [
        ['Turn off the built-in cursor', [p(h, 'Start the server with ', code(h, 'HAND_CURSOR=0'), ' in its env.')]],
        ['Listen for notifications', [p(h, 'In your MCP client, handle ', code(h, 'notifications/message'), ' where ', code(h, 'params.logger'), ' is ', code(h, 'hand.action'), '.')]],
        ['Draw', [p(h, 'On ', code(h, 'before'), ', move a cursor to the middle of ', code(h, 'target'), '. On ', code(h, 'after'), ', show whether ', code(h, 'ok'), ' is true.')]],
      ]),
      p(h, 'Every field is in ', link(h, '/docs/reference/action-event/', 'The hand.action event'), '.'),
    ],
  },
];

export const parallelSections = (h: H): readonly Section[] => [
  {
    id: 'ids',
    title: 'Give each agent an id',
    body: [
      p(h, 'Most tools take an optional ', code(h, 'agent'), ' argument. Give each agent its own, such as ', code(h, '"writer"'), ' and ', code(h, '"researcher"'), '. Each id gets its own cursor with its name on it, and its own outline state.'),
    ],
  },
  {
    id: 'turns',
    title: 'Taking turns',
    body: [
      p(h, 'Only one agent acts on the screen at a time. The others wait. If one holds the screen for more than 10 seconds, the waiting agent gets ', code(h, 'LEASE_TIMEOUT'), ' and can retry.'),
      note(h, 'It is fastest when each agent works in its own app.'),
    ],
  },
];

export const fixSections = (h: H): readonly Section[] => [
  {
    id: 'doctor',
    title: 'Start with hand doctor',
    body: [p(h, 'Run ', code(h, 'bunx hand doctor'), '. It names what is missing and how to fix it.')],
  },
  {
    id: 'permissions',
    title: 'Accessibility is not granted',
    body: [p(h, 'Turn on the app that runs hand in System Settings › Privacy & Security › Accessibility, then restart that app. For the Mac app that is hand itself. Granting it to Terminal does not cover an agent app, and the other way round.')],
  },
  {
    id: 'credentials',
    title: 'No Cloudflare account or token',
    body: [p(h, 'Open hand and sign in again, or follow ', link(h, '/docs/how-to/use-from-code/#credentials', 'Add Cloudflare credentials'), '.')],
  },
  {
    id: 'policy',
    title: 'POLICY_DENIED',
    body: [p(h, 'The step needs keystrokes or the mouse. ', link(h, '/docs/how-to/headed-mode/', 'Turn on headed mode'), '.')],
  },
  {
    id: 'unsure',
    title: 'UNSURE',
    body: [
      p(h, 'Clef could not tell which control was meant. Describe it more exactly, or call ', code(h, 'outline'), ' and pass its id, such as ', code(h, 'e3'), '.'),
      p(h, 'Text fields are often named by what is in them, so a description like “the document” can stop matching after you type into it. Passing the id from ', code(h, 'outline'), ' always works.'),
    ],
  },
  {
    id: 'helper',
    title: 'The helper did not build',
    body: [p(h, 'Run ', code(h, 'xcode-select --install'), ', or use the ', link(h, '/docs/explanation/the-helper/#prebuilt', 'prebuilt helper'), '.')],
  },
  {
    id: 'other',
    title: 'Anything else',
    body: [p(h, 'Look the code up in ', link(h, '/docs/reference/replies-and-errors/', 'Replies and error codes'), '. Still stuck? ', link(h, `${GITHUB}/issues`, 'Open an issue'), '.')],
  },
];

export const uninstallSections = (h: H): readonly Section[] => [
  {
    id: 'steps',
    title: 'Remove hand',
    body: [
      steps(h, [
        ['Sign out', [p(h, 'Open hand and press Sign out. That revokes the Cloudflare sign-in and deletes it from your Keychain.')]],
        ['Remove it from your agent', [p(h, 'Delete the ', code(h, 'hand'), ' entry from your agent’s MCP config.')]],
        ['Delete the app', [p(h, 'Quit hand, then drag hand.app from Applications to the Bin.')]],
        ['Turn off permissions', [p(h, 'Turn hand off in System Settings › Privacy & Security › Accessibility, and Screen Recording if you turned it on.')]],
      ]),
    ],
  },
];

export const howSections = (h: H): readonly Section[] => [
  {
    id: 'list',
    title: 'List, don’t guess',
    body: [
      p(h, 'Most computer-use tools send a screenshot to a large model and ask where to click. hand asks the Mac instead: the accessibility system already knows every button, field and menu, with its name and box.'),
      p(h, 'hand lists those controls, so the question becomes “which of these?”, not “which pixel?”.'),
    ],
  },
  {
    id: 'pick',
    title: 'A small model picks',
    body: [
      p(h, 'Clef is a small model on Workers AI that answers typed questions with probabilities. hand asks it which control matches the request. If the top pick is below ', code(h, 'tau'), ', or too close to the second, hand does nothing and replies ', code(h, 'UNSURE'), '.'),
      p(h, 'Clef is also asked whether the control looks destructive (', code(h, 'riskTau'), ') and whether text on screen looks like instructions aimed at the agent (', code(h, 'injectionTau'), ').'),
    ],
  },
  {
    id: 'act',
    title: 'Act, then check',
    body: [
      p(h, 'The helper presses the control through accessibility, or with a real click or keystroke in headed mode. Then hand reads the control back, and with ', code(h, 'verify'), ' on, asks Clef whether the screen changed as intended.'),
      p(h, 'Every action gets a receipt: ', code(h, 'delivered_verified'), ', ', code(h, 'delivered_unverified'), ' or ', code(h, 'not_delivered'), '.'),
    ],
  },
  {
    id: 'writing',
    title: 'Writing text',
    body: [p(h, 'Clef never writes text. When a task needs new words, such as a reply to an email, the agent writes them and hand types them.')],
  },
];

export const dataSections = (h: H): readonly Section[] => [
  {
    id: 'reads',
    title: 'What hand reads',
    body: [p(h, 'The controls and text in the front window of the app it is working in, and a screenshot only when ', code(h, 'look'), ' is used.')],
  },
  {
    id: 'sends',
    title: 'Where it goes',
    body: [
      p(h, 'What it reads goes to Clef on Workers AI in your own Cloudflare account, or through the AI Gateway you set. hand.coey.dev only sees your sign-in, to refresh it. Nothing is stored except the sign-in, in your Keychain under ', code(h, 'hand-oauth'), '.'),
    ],
  },
  {
    id: 'billing',
    title: 'Who pays',
    body: [p(h, 'Clef calls are billed to your Cloudflare account at Workers AI prices, about a cent per task. hand itself is free and MIT licensed. ', code(h, 'hand.costUsd'), ' tells you what a run cost.')],
  },
  {
    id: 'permissions',
    title: 'macOS permissions',
    body: [
      list(h, [
        [strong(h, 'Accessibility'), ' (required) lets hand read and press controls.'],
        [strong(h, 'Screen Recording'), ' (optional) is only for ', code(h, 'look'), ' and screenshots.'],
      ]),
      p(h, 'Both go to the app that runs hand. See ', link(h, '/docs/how-to/uninstall/', 'Sign out and uninstall'), ' to remove them.'),
    ],
  },
];

export const helperSections = (h: H): readonly Section[] => [
  {
    id: 'what',
    title: 'What it is',
    body: [p(h, 'hand reads and presses controls through ', code(h, 'ax'), ', a small Swift program. The Mac app includes it. For the library, ', code(h, 'hand doctor'), ' builds it into ', code(h, '~/.config/hand/bin/ax'), ', which needs the Xcode command line tools (', code(h, 'xcode-select --install'), ').')],
  },
  {
    id: 'prebuilt',
    title: 'Prebuilt helper',
    body: [
      p(h, 'To skip building, download it for Apple silicon from the ', link(h, RELEASES, 'releases page'), ':'),
      codeBlock(
        h,
        'Prebuilt helper',
        `${F('curl')} -LO https://github.com/acoyfellow/hand/\\\n  releases/download/v0.1.0/hand-ax-0.1.0-macos-arm64.tar.gz\n${F('tar')} -xzf hand-ax-0.1.0-macos-arm64.tar.gz\n${F('xattr')} -d com.apple.quarantine ax\n${K('export')} HAND_AX_HELPER=${S('"$PWD/ax"')}`,
      ),
    ],
  },
  {
    id: 'signing',
    title: 'Why it is not signed',
    body: [p(h, 'hand does not have an Apple Developer ID yet, so macOS blocks the helper until you remove the quarantine flag as above, and the app until you right-click and choose Open the first time.')],
  },
];
