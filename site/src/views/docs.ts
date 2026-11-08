import type { Html } from 'foldkit/html';
import { type Child, GITHUB, type H, codeBlock, scrollRegion } from './kit.ts';

const RELEASES = `${GITHUB}/releases/latest`;

const K = (text: string) => `<span class="text-[#c2410c] dark:text-[#ff9e64]">${text}</span>`;
const S = (text: string) => `<span class="text-[#15803d] dark:text-[#9ece6a]">${text}</span>`;
const F = (text: string) => `<span class="text-[#1d4ed8] dark:text-[#7aa2f7]">${text}</span>`;
const C = (text: string) => `<span class="text-dim italic">${text}</span>`;

const SECTION = 'pt-10 md:pt-14';
const H2 = 'm-0 mb-3 scroll-mt-20 text-[1.3rem] font-semibold tracking-[-0.01em]';
const H3 = 'mt-6 mb-2 text-base font-semibold';
const P = 'my-3 text-dim text-pretty';
const CODE = 'rounded bg-raise px-1 py-0.5 font-mono text-[0.85em] text-text';
const CELL = 'border-b border-line px-3 py-2 text-left align-top';
const HEAD = `${CELL} text-[0.8rem] font-medium text-dim`;

const code = (h: H, text: string): Html => h.code([h.Class(CODE)], [text]);

const TOC: readonly (readonly [string, string])[] = [
  ['quickstart', 'Quickstart'],
  ['headed', 'Headed or headless'],
  ['tools', 'MCP tools'],
  ['code', 'Use it from code'],
  ['settings', 'Settings'],
  ['helper', 'The macOS helper'],
  ['trouble', 'When something fails'],
  ['remove', 'Sign out and uninstall'],
];

const toc = (h: H): Html =>
  h.nav(
    [h.AriaLabel('On this page'), h.Class('mt-6 rounded-[10px] border border-line p-4')],
    [
      h.p([h.Class('m-0 mb-2 text-[0.8rem] font-medium text-dim')], ['On this page']),
      h.ol(
        [h.Class('m-0 grid list-none gap-1 p-0 sm:grid-cols-2')],
        TOC.map(([id, label]) => h.li([], [h.a([h.Href(`#${id}`)], [label])])),
      ),
    ],
  );

const step = (h: H, number: number, title: string, body: readonly Child[]): Html =>
  h.div([h.Class('mt-6')], [h.h3([h.Class('m-0 mb-2 text-base font-semibold')], [h.span([h.Class('mr-2 text-dim')], [`${number}.`]), title]), ...body]);

const quickstart = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('quickstart'), h.Class(SECTION)],
    [
      h.h2([h.Id('quickstart'), h.Class(H2)], ['Quickstart']),
      h.p([h.Class(P)], ['The quickest way is the Mac app. It needs a Mac on macOS 13 or later and a Cloudflare account.']),
      step(h, 1, 'Download and open', [
        h.p([h.Class(P)], [
          h.a([h.Href('https://github.com/acoyfellow/hand/releases/latest/download/hand.dmg')], ['Download hand.dmg']),
          ', open it and drag hand into Applications. hand is not signed by Apple yet, so the first time, right-click hand and choose Open.',
        ]),
      ]),
      step(h, 2, 'Connect Cloudflare', [
        h.p([h.Class(P)], ['Click "Create a token on Cloudflare". The token page opens with the right permissions ticked; create it and paste it into hand. hand finds your account and keeps the token in your Keychain.']),
      ]),
      step(h, 3, 'Allow hand to use apps', [h.p([h.Class(P)], ['Click "Open Settings" and turn on hand under Accessibility. Screen Recording is optional.'])]),
      step(h, 4, 'Connect your agent', [
        h.p([h.Class(P)], ['Click "Copy MCP config" and paste it into the MCP settings of any agent that supports MCP. Restart the agent and ask it to do something on your Mac.']),
      ]),
      h.h2([h.Id('cli'), h.Class(`${H2} mt-12`)], ['From the command line']),
      h.p([h.Class(P)], ['For your own agent or scripts. You need a Mac, ', h.a([h.Href('https://bun.sh')], ['Bun']), ' and a Cloudflare account. About five minutes.']),
      step(h, 1, 'Install', [
        codeBlock(h, 'Install', `${F('bun')} add github:acoyfellow/hand#release`),
        h.p([h.Class(P)], ['The ', code(h, 'release'), ' branch holds only the library, about 220 KB.']),
      ]),
      step(h, 2, 'Add your Cloudflare credentials', [
        h.p([h.Class(P)], ['hand calls Workers AI through an ', h.a([h.Href('https://developers.cloudflare.com/ai-gateway/')], ['AI Gateway']), '.']),
        h.ul(
          [h.Class('my-3 pl-[1.1rem] text-dim')],
          [
            h.li([h.Class('my-1')], [h.strong([h.Class('text-text')], ['Account id:']), ' in the Cloudflare dashboard, Workers AI › Use REST API.']),
            h.li([h.Class('my-1')], [
              h.strong([h.Class('text-text')], ['API token:']),
              ' create one at ',
              h.a([h.Href('https://dash.cloudflare.com/profile/api-tokens')], ['dash.cloudflare.com/profile/api-tokens']),
              ' with ',
              h.em([], ['Workers AI: Read']),
              ' and ',
              h.em([], ['AI Gateway: Run']),
              '.',
            ]),
          ],
        ),
        codeBlock(
          h,
          'Credentials',
          `${F('mkdir')} -p ~/.config/hand\n${F('echo')} ${S(`'{"accountId": "&lt;id&gt;", "gateway": "default"}'`)} \\\n  &gt; ~/.config/hand/config.json\n\n${C('# paste the token when asked')}\n${F('security')} add-generic-password -a ${S('"$USER"')} -s hand-gateway -w`,
        ),
        h.p([h.Class(P)], ['Or set ', code(h, 'HAND_ACCOUNT_ID'), ', ', code(h, 'HAND_GATEWAY'), ' and ', code(h, 'HAND_TOKEN'), ' instead.']),
      ]),
      step(h, 3, 'Check everything', [
        codeBlock(h, 'Doctor', `${F('bunx')} hand doctor`),
        h.p([h.Class(P)], [
          'It checks the credentials, builds the small macOS helper, and checks two macOS permissions. Anything missing comes with the exact fix. The permissions go to the app that runs hand, such as your terminal or agent app:',
        ]),
        h.ul(
          [h.Class('my-3 pl-[1.1rem] text-dim')],
          [
            h.li([h.Class('my-1')], [h.strong([h.Class('text-text')], ['Accessibility']), ' (System Settings › Privacy & Security › Accessibility) lets hand read and press controls. Required.']),
            h.li([h.Class('my-1')], [
              h.strong([h.Class('text-text')], ['Screen Recording']),
              ' (System Settings › Privacy & Security › Screen & System Audio Recording) is needed only for screenshots and the ',
              code(h, 'look'),
              ' tool.',
            ]),
          ],
        ),
        h.p([h.Class(P)], ['Restart the app after granting either one.']),
      ]),
      step(h, 4, 'Give it to your agent', [
        h.p([h.Class(P)], ['Add this to your MCP client, such as Claude, Cursor or Pi:']),
        codeBlock(
          h,
          'MCP configuration',
          `{\n  ${S('"mcpServers"')}: {\n    ${S('"hand"')}: {\n      ${S('"command"')}: ${S('"bunx"')},\n      ${S('"args"')}: [${S('"hand"')}, ${S('"mcp"')}],\n      ${S('"env"')}: { ${S('"HAND_HEADED"')}: ${S('"1"')} }\n    }\n  }\n}`,
        ),
        h.p([h.Class(P)], ['Then ask it to do something on your Mac, for example “open Notes and start a checklist called Groceries”.']),
      ]),
    ],
  );

const headed = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('headed'), h.Class(SECTION)],
    [
      h.h2([h.Id('headed'), h.Class(H2)], ['Headed or headless']),
      h.p([h.Class(P)], [
        'By default hand is ',
        h.strong([h.Class('text-text')], ['headless']),
        ': it only uses accessibility actions, so it never moves your mouse or types into the wrong window.',
      ]),
      h.p([h.Class(P)], [
        'Many apps need real input for some steps: typing into a Notes body, renaming a file in Finder, or clicking a web page control that has no accessibility action. Those steps fail with ',
        code(h, 'POLICY_DENIED'),
        ' until you turn on ',
        h.strong([h.Class('text-text')], ['headed']),
        ' mode: ',
        code(h, 'HAND_HEADED=1'),
        ' for the MCP server, or ',
        code(h, 'headed: true, allowMouse: true'),
        ' on the device. Headed mode sends keystrokes only to the target app and stops if that app loses focus.',
      ]),
    ],
  );

const TOOLS: readonly (readonly [string, string])[] = [
  ['apps', 'List running Mac apps that can be controlled, with window titles.'],
  ['activate', 'Bring an app to the front.'],
  ['outline', 'List the controls in the front window and menu bar, each with an id like [e3], plus the text on screen.'],
  ['act', 'Click a control by id or plain words. Pass confirm: true only when the user asked for a destructive action.'],
  ['type', 'Type into a field by id or plain words. mode: "insert" types at the cursor and keeps the rest of the field.'],
  ['key', 'Press one key or shortcut, such as cmd+n, or shift+cmd+l for a checklist in Notes.'],
  ['steps', 'Run several act, type and key steps in one call. Stops at the first step that is unsure, blocked or fails.'],
  ['look', 'Ask a yes/no question about the screen. Returns p(yes).'],
];

const tools = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('tools'), h.Class(SECTION)],
    [
      h.h2([h.Id('tools'), h.Class(H2)], ['MCP tools']),
      scrollRegion(h, 'MCP tools', [
        h.table(
          [h.Class('w-full border-collapse text-[0.9rem]')],
          [
            h.thead([], [h.tr([], [h.th([h.Scope('col'), h.Class(HEAD)], ['tool']), h.th([h.Scope('col'), h.Class(HEAD)], ['what it does'])])]),
            h.tbody(
              [],
              TOOLS.map(([name, what]) => h.tr([], [h.td([h.Class(`${CELL} font-mono text-[0.85rem]`)], [name]), h.td([h.Class(`${CELL} text-dim`)], [what])])),
            ),
          ],
        ),
      ]),
      h.p([h.Class(P)], [
        'Every tool takes ',
        code(h, 'app'),
        '. ',
        code(h, 'act'),
        ', ',
        code(h, 'type'),
        ', ',
        code(h, 'key'),
        ' and ',
        code(h, 'steps'),
        ' also take an optional ',
        code(h, 'agent'),
        ' id, so parallel agents keep separate state and take turns. Each reply ends with a receipt of what was done, and every action is also sent as a ',
        code(h, 'notifications/message'),
        ' with logger ',
        code(h, 'hand.action'),
        '.',
      ]),
      h.h3([h.Class(H3)], ['Replies']),
      h.ul(
        [h.Class('my-3 pl-[1.1rem] text-dim')],
        [
          [code(h, 'Clicked …'), ' or ', code(h, 'Typed …'), ': done, with the probability Clef gave.'],
          [code(h, 'UNSURE'), ': Clef could not tell which control was meant, so nothing was done. Describe it more exactly, or use an id from outline.'],
          [code(h, 'BLOCKED'), ': the control looks destructive. Retry with confirm: true only if the user asked for it.'],
          [code(h, 'STALE_REF'), ': the control changed since the last outline. Call outline again.'],
        ].map((parts) => h.li([h.Class('my-1')], parts)),
      ),
    ],
  );

const library = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('code'), h.Class(SECTION)],
    [
      h.h2([h.Id('code'), h.Class(H2)], ['Use it from code']),
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
          `${K('const')} transport = ${F('gatewayTransport')}({`,
          `  ...${F('readConfig')}(),`,
          `  token: ${F('readToken')}(),`,
          '});',
          `${K('const')} device = ${F('macosDevice')}({`,
          `  helper: ${F('helperOrBuild')}(),`,
          `  app: ${S("'Google Chrome'")},`,
          `  headed: ${K('true')},`,
          `  allowMouse: ${K('true')},`,
          '});',
          `${K('const')} hand = ${K('new')} ${F('Hand')}(transport, device, {`,
          `  model: ${S("'clef'")}, method: ${S("'ax_text'")}, verify: ${K('true')},`,
          '  tau: 0.3, riskTau: 0.5, injectionTau: 0.5,',
          '});',
          '',
          `${K('await')} hand.${F('outline')}();  ${C('// controls with ids like [e3]')}`,
          `${K('await')} hand.${F('act')}(${S("'switch to the termlab tab'")});`,
          `${K('await')} hand.${F('type')}(${S("'coey.dev'")}, ${S("'the address bar'")});`,
          `${K('await')} hand.${F('look')}(${S("'Is coey.dev open?'")});  ${C('// p(yes)')}`,
        ].join('\n'),
      ),
      h.p([h.Class(P)], ['Every module and export is listed in the ', h.a([h.Href(`${GITHUB}#modules`)], ['README']), '. Agents can read ', h.a([h.Href('/llms.txt')], ['llms.txt']), '.']),
    ],
  );

const SETTINGS: readonly (readonly [string, string])[] = [
  ['HAND_ACCOUNT_ID, HAND_GATEWAY, HAND_TOKEN', 'Cloudflare credentials, instead of ~/.config/hand and the Keychain.'],
  ['HAND_HEADED=1', 'Allow keystrokes and mouse clicks (see Headed or headless).'],
  ['HAND_AX_HELPER', 'Path to a helper binary, instead of building one into ~/.config/hand/bin.'],
  ['HAND_CURSOR_SOCKET', 'Show each action on the hand cursor overlay.'],
];

const settings = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('settings'), h.Class(SECTION)],
    [
      h.h2([h.Id('settings'), h.Class(H2)], ['Settings']),
      scrollRegion(h, 'Settings', [
        h.table(
          [h.Class('w-full border-collapse text-[0.9rem]')],
          [
            h.thead([], [h.tr([], [h.th([h.Scope('col'), h.Class(HEAD)], ['variable']), h.th([h.Scope('col'), h.Class(HEAD)], ['what it does'])])]),
            h.tbody(
              [],
              SETTINGS.map(([name, what]) => h.tr([], [h.td([h.Class(`${CELL} font-mono text-[0.8rem]`)], [name]), h.td([h.Class(`${CELL} text-dim`)], [what])])),
            ),
          ],
        ),
      ]),
    ],
  );

const helper = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('helper'), h.Class(SECTION)],
    [
      h.h2([h.Id('helper'), h.Class(H2)], ['The macOS helper']),
      h.p([h.Class(P)], [
        'hand reads and presses controls through a small Swift program. ',
        code(h, 'hand doctor'),
        ' builds it into ',
        code(h, '~/.config/hand/bin/ax'),
        ', which needs the Xcode command line tools (',
        code(h, 'xcode-select --install'),
        ').',
      ]),
      h.p([h.Class(P)], ['If you would rather not install those, download the prebuilt helper for Apple silicon from the ', h.a([h.Href(RELEASES)], ['releases page']), ':']),
      codeBlock(
        h,
        'Prebuilt helper',
        `${F('curl')} -LO https://github.com/acoyfellow/hand/\\\n  releases/download/v0.1.0/hand-ax-0.1.0-macos-arm64.tar.gz\n${F('tar')} -xzf hand-ax-0.1.0-macos-arm64.tar.gz\n${F('xattr')} -d com.apple.quarantine ax\n${K('export')} HAND_AX_HELPER=${S('"$PWD/ax"')}`,
      ),
      h.p([h.Class(P)], ['It is not signed with an Apple Developer ID yet, so macOS blocks it until you remove the quarantine flag as above.']),
    ],
  );

const TROUBLE: readonly (readonly [string, readonly Child[]])[] = [
  ['No Cloudflare account id / No Cloudflare API token', ['Follow step 2 of the Quickstart, then run hand doctor.']],
  ['Accessibility permission is not granted', ['Turn on the app that runs hand in System Settings › Privacy & Security › Accessibility, then restart that app. Granting it to Terminal does not cover an agent app, and the other way round.']],
  ['POLICY_DENIED', ['The step needs keystrokes or the mouse. Set HAND_HEADED=1 (see Headed or headless).']],
  ['UNSURE', ['Describe the control more exactly, or call outline and pass its id.']],
  ['LEASE_TIMEOUT', ['Another agent held the screen for more than 10 seconds. Retry, or give each agent its own app.']],
  ['The helper did not build', ['Run xcode-select --install, or use the prebuilt helper above.']],
];

const REMOVE_STEPS: readonly string[] = [
  'Open hand and press Sign out. That revokes the Cloudflare sign-in and deletes it from your Keychain.',
  'Remove the hand entry from your agent’s MCP config.',
  'Quit hand, then drag hand.app from Applications to the Bin.',
  'Turn hand off in System Settings › Privacy & Security › Accessibility (and Screen Recording, if you turned it on).',
];

const remove = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('remove'), h.Class(SECTION)],
    [
      h.h2([h.Id('remove'), h.Class(H2)], ['Sign out and uninstall']),
      h.p([h.Class(P)], ['hand keeps one thing: your Cloudflare sign-in, in the macOS Keychain under hand-oauth. What it reads on screen goes to Workers AI on your own Cloudflare account (or the AI Gateway you set). hand.coey.dev only sees the sign-in, to refresh it.']),
      h.ol([h.Class('my-3 list-decimal pl-6 text-dim')], REMOVE_STEPS.map((step) => h.li([h.Class('mt-1.5')], [step]))),
    ],
  );

const trouble = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('trouble'), h.Class(SECTION)],
    [
      h.h2([h.Id('trouble'), h.Class(H2)], ['When something fails']),
      h.p([h.Class(P)], ['Run ', code(h, 'bunx hand doctor'), ' first. It names what is missing and how to fix it.']),
      h.dl(
        [h.Class('my-3')],
        TROUBLE.flatMap(([problem, fix]) => [h.dt([h.Class('mt-4 font-mono text-[0.85rem] text-text')], [problem]), h.dd([h.Class('m-0 mt-1 text-dim')], [...fix])]),
      ),
      h.p([h.Class(P)], ['Still stuck? ', h.a([h.Href(`${GITHUB}/issues`)], ['Open an issue']), '.']),
    ],
  );

export const docsMain = (h: H): readonly Child[] => [
  h.article(
    [h.Class('mx-auto max-w-[44rem] pt-10 pb-16 md:pt-16')],
    [
      h.h1([h.Class('m-0 mb-3 text-[2rem] font-semibold tracking-[-0.025em]')], ['Docs']),
      h.p([h.Class('m-0 text-[1.05rem] text-dim text-pretty')], ['Set up hand on your Mac and give it to your AI agent.']),
      toc(h),
      quickstart(h),
      headed(h),
      tools(h),
      library(h),
      settings(h),
      helper(h),
      trouble(h),
      remove(h),
    ],
  ),
];
