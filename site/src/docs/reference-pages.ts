import type { Html } from 'foldkit/html';
import reference from '../generated/reference.json';
import { CODE_NOTES, ENV_NOTES, EXPORT_NOTES, FIELD_NOTES, MEMBER_NOTES, OPTION_NOTES, REPLY_NOTES, SHAPE_NOTES } from '../reference-notes.ts';
import type { H } from '../views/kit.ts';
import { MONO, type Section, TEXT, TYPE, code, link, p, table } from './kit.ts';

type Schema = { type?: string; description?: string; enum?: readonly string[]; items?: Schema; properties?: Record<string, Schema>; required?: readonly string[] };
type Field = { name: string; type: string; optional: boolean; doc: string };
type Shape = { name: string; file: string; kind: string; doc: string; fields: Field[]; text?: string };

const shapes = reference.shapes as Shape[];
const baseName = (signature: string) => signature.split('(')[0] ?? signature;
const slug = (name: string) => (name.split(' ')[0] ?? name).toLowerCase();
const shapeNamed = (name: string) => shapes.find((shape) => shape.name === name || shape.name.startsWith(`${name} `));

const schemaType = (schema: Schema): string => {
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (schema.type === 'array') return `${schema.items ? schemaType(schema.items) : 'unknown'}[]`;
  if (schema.type === 'object' && schema.properties) return 'object';
  return schema.type ?? 'unknown';
};

const notesFor = (shape: Shape) => (shape.name === 'HandOptions' ? OPTION_NOTES : (FIELD_NOTES[shape.name] ?? {}));

const shapeBody = (h: H, shape: Shape): readonly Html[] => [
  p(h, SHAPE_NOTES[shape.name] ?? shape.doc, ' Defined in ', code(h, shape.file), '.'),
  shape.text
    ? h.pre([h.Class('my-4 overflow-x-auto rounded-[10px] bg-raise p-4 font-mono text-[0.8rem] leading-[1.6] whitespace-pre-wrap'), h.Tabindex(0), h.Role('region'), h.AriaLabel(`${shape.name} type`)], [shape.text])
    : table(
        h,
        `${shape.name} fields`,
        ['Field', 'Type', 'Description'],
        shape.fields.map((field) => [h.td([h.Class(MONO)], [`${field.name}${field.optional ? '?' : ''}`]), h.td([h.Class(TYPE)], [field.type]), h.td([h.Class(TEXT)], [notesFor(shape)[baseName(field.name)] ?? field.doc])]),
      ),
];

const shapeSection = (h: H, name: string): Section[] => {
  const shape = shapeNamed(name);
  return shape ? [{ id: slug(shape.name), title: shape.name, body: shapeBody(h, shape) }] : [];
};

const toolArgs = (h: H, schema: Schema, label: string): Html => {
  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {});
  return props.length
    ? table(
        h,
        label,
        ['Argument', 'Type', 'Required', 'Description'],
        props.map(([name, prop]) => [
          h.td([h.Class(MONO)], [name]),
          h.td([h.Class(TYPE)], [schemaType(prop)]),
          h.td([h.Class(TEXT)], [required.has(name) ? 'yes' : 'no']),
          h.td([h.Class(TEXT)], [prop.description ?? '']),
        ]),
      )
    : p(h, 'No arguments.');
};

export const toolSections = (h: H): readonly Section[] => [
  {
    id: 'overview',
    title: 'Overview',
    body: [
      p(h, 'The server is ', code(h, 'hand mcp'), ' over stdio. Each tool below is what ', code(h, 'tools/list'), ' returns, with exactly this schema. Every reply is text: what happened, then the receipts.'),
      table(
        h,
        'All tools',
        ['Tool', 'What it does'],
        reference.tools.map((tool) => [h.td([h.Class(MONO)], [h.a([h.Href(`#${tool.name}`)], [tool.name])]), h.td([h.Class(TEXT)], [tool.description.split('. ')[0]?.replace(/\.$/, '') ?? ''])]),
      ),
    ],
  },
  ...reference.tools.map((tool) => {
    const schema = tool.inputSchema as unknown as Schema;
    const stepItem = tool.name === 'steps' ? schema.properties?.steps?.items : undefined;
    return {
      id: tool.name,
      title: tool.name,
      body: [
        p(h, tool.description),
        toolArgs(h, schema, `${tool.name} arguments`),
        ...(stepItem ? [p(h, 'Each step:'), toolArgs(h, stepItem, 'step fields')] : []),
      ],
    };
  }),
];

export const replySections = (h: H): readonly Section[] => [
  {
    id: 'replies',
    title: 'Reply words',
    body: [
      p(h, 'A reply starts with what happened. When nothing was done it starts with one of these words, and the agent should not assume the step worked.'),
      table(h, 'Reply words', ['Word', 'Meaning'], Object.entries(REPLY_NOTES).map(([word, note]) => [h.td([h.Class(MONO)], [word]), h.td([h.Class(TEXT)], [note])])),
    ],
  },
  {
    id: 'codes',
    title: 'Error codes',
    body: [
      p(h, 'Receipts and failed actions carry one of these codes in ', code(h, 'code'), '.'),
      table(h, 'Error codes', ['Code', 'Meaning'], reference.codes.map((name) => [h.td([h.Class(MONO)], [name]), h.td([h.Class(TEXT)], [CODE_NOTES[name] ?? ''])])),
    ],
  },
  ...shapeSection(h, 'Delivery'),
  ...shapeSection(h, 'Mechanism'),
];

export const eventSections = (h: H): readonly Section[] => [
  {
    id: 'format',
    title: 'Message',
    body: [
      p(h, 'Before and after every action the server writes a JSON-RPC notification:'),
      h.pre(
        [h.Class('my-4 overflow-x-auto rounded-[10px] bg-raise p-4 font-mono text-[0.8rem] leading-[1.6]'), h.Tabindex(0), h.Role('region'), h.AriaLabel('Example notification')],
        [
          JSON.stringify(
            {
              jsonrpc: '2.0',
              method: 'notifications/message',
              params: { level: 'info', logger: 'hand.action', data: { phase: 'before', agent: 'agent', app: 'TextEdit', action: 'press', target: { role: 'checkbox', name: 'bold', x: 222, y: 152, w: 20, h: 20 }, ok: true } },
            },
            null,
            2,
          ),
        ],
      ),
      p(h, 'If your app draws its own cursor from these, start the server with ', code(h, 'HAND_CURSOR=0'), ' so hand does not draw a second one. See ', link(h, '/docs/how-to/draw-your-own-cursor/', 'Draw your own cursor'), '.'),
    ],
  },
  ...shapeSection(h, 'ActionEvent'),
];

export const handSections = (h: H): readonly Section[] => [
  {
    id: 'constructor',
    title: 'Constructor',
    body: [
      h.pre([h.Class('my-4 overflow-x-auto rounded-[10px] bg-raise p-4 font-mono text-[0.82rem]'), h.Tabindex(0), h.Role('region'), h.AriaLabel('Constructor')], ["import { Hand } from 'hand/hand';\n\nnew Hand(transport: Transport, device: Device, options: HandOptions)"]),
      p(h, 'Every method returns the reply text an agent would see. ', code(h, 'hand.steps'), ' keeps a record of each one.'),
    ],
  },
  {
    id: 'members',
    title: 'Methods and properties',
    body: [
      h.dl(
        [h.Class('my-4 divide-y divide-line rounded-[10px] border border-line')],
        reference.hand.flatMap((member) => [
          h.div(
            [h.Class('px-4 py-3')],
            [
              h.dt([h.Class('font-mono text-[0.82rem] break-words text-text')], [h.span([h.Class('font-semibold')], [baseName(member.name)]), member.name.slice(baseName(member.name).length), h.span([h.Class('text-faint')], [`  →  ${member.type}`])]),
              h.dd([h.Class('m-0 mt-1 text-[0.92rem] text-dim')], [MEMBER_NOTES[baseName(member.name)] ?? member.doc]),
            ],
          ),
        ]),
      ),
    ],
  },
  ...shapeSection(h, 'HandOptions'),
  ...shapeSection(h, 'Step'),
  ...shapeSection(h, 'Expectation'),
];

const TYPE_ORDER = ['Device', 'Candidate', 'MacosDeviceOptions', 'Receipt', 'AxOutcome', 'ElementState', 'TextEditResult', 'TextLine', 'ClefRequest', 'Question', 'Answer', 'ClefResult', 'GatewayConfig', 'Grant'];
export const typeSections = (h: H): readonly Section[] => TYPE_ORDER.flatMap((name) => shapeSection(h, name));

export const settingsSections = (h: H): readonly Section[] => [
  {
    id: 'variables',
    title: 'Environment variables',
    body: [table(h, 'Environment variables', ['Variable', 'Description'], reference.envVars.map((name) => [h.td([h.Class(MONO)], [name]), h.td([h.Class(TEXT)], [ENV_NOTES[name] ?? ''])]))],
  },
  {
    id: 'credentials',
    title: 'Where credentials come from',
    body: [
      p(h, 'The MCP server uses the first of these that is there:'),
      h.ol(
        [h.Class('my-3 max-w-[68ch] list-decimal pl-6 text-dim')],
        [
          ['If ', code(h, 'HAND_TOKEN'), ' is set, that token, with the account from ', code(h, 'HAND_ACCOUNT_ID'), ' or the config file.'],
          ['Otherwise the Cloudflare sign-in from the app, in the Keychain under ', code(h, 'hand-oauth'), '. It calls Workers AI directly and refreshes through hand.coey.dev.'],
          ['Otherwise an API token in the Keychain under ', code(h, 'hand-gateway'), ' or in ', code(h, '~/.config/hand/token'), ', with the account from the config file.'],
        ].map((parts) => h.li([h.Class('my-1.5 pl-1')], parts)),
      ),
    ],
  },
  ...shapeSection(h, 'GatewayConfig').map((section) => ({ ...section, id: 'config-file', title: '~/.config/hand/config.json' })),
];

export const exportSections = (h: H): readonly Section[] => [
  {
    id: 'paths',
    title: 'Import paths',
    body: [
      p(h, 'Install with ', code(h, 'bun add github:acoyfellow/hand#release'), '.'),
      table(h, 'Package exports', ['Import', 'What it holds'], reference.exports.map((path) => [h.td([h.Class(MONO)], [path]), h.td([h.Class(TEXT)], [EXPORT_NOTES[path] ?? ''])])),
      p(h, 'Agents can read all of this as plain text at ', link(h, '/llms-full.txt', 'llms-full.txt'), '.'),
    ],
  },
];

export const referenceIndex = (h: H): readonly Section[] => [
  {
    id: 'contents',
    title: 'Contents',
    body: [
      p(h, `Everything here is generated from hand ${reference.version} at build time. The build fails if a tool, argument, error code, setting or type is in the code without a description, so this cannot drift from what hand does.`),
      h.ul(
        [h.Class('my-4 grid max-w-[68ch] list-none gap-3 p-0')],
        (
          [
            ['/docs/reference/mcp-tools/', 'MCP tools', `${reference.tools.length} tools, every argument`],
            ['/docs/reference/replies-and-errors/', 'Replies and error codes', `${reference.codes.length} codes and what to do`],
            ['/docs/reference/action-event/', 'The hand.action event', 'For drawing your own cursor'],
            ['/docs/reference/hand-class/', 'The Hand class', `${reference.hand.length} methods and properties, options and steps`],
            ['/docs/reference/types/', 'Types', 'Device, receipts, Clef and more'],
            ['/docs/reference/settings/', 'Settings and credentials', `${reference.envVars.length} environment variables`],
            ['/docs/reference/exports/', 'Package exports', `${reference.exports.length} import paths`],
          ] as const
        ).map(([href, title, what]) =>
          h.li([], [h.a([h.Href(href), h.Class('block rounded-[10px] border border-line px-4 py-3 no-underline hover:border-text')], [h.span([h.Class('block font-semibold text-text')], [title]), h.span([h.Class('block text-[0.9rem] text-dim')], [what])])]),
        ),
      ),
    ],
  },
];
