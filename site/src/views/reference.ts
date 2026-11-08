import type { Html } from 'foldkit/html';
import reference from '../generated/reference.json';
import { CODE_NOTES, ENV_NOTES, EXPORT_NOTES, FIELD_NOTES, MEMBER_NOTES, OPTION_NOTES, REPLY_NOTES, SHAPE_NOTES } from '../reference-notes.ts';
import { type Child, type H, scrollRegion } from './kit.ts';

type Schema = { type?: string; description?: string; enum?: readonly string[]; items?: Schema; properties?: Record<string, Schema>; required?: readonly string[] };
type Field = { name: string; type: string; optional: boolean; doc: string };
type Shape = { name: string; file: string; kind: string; doc: string; fields: Field[]; text?: string };

const SECTION = 'pt-10 md:pt-14';
const H2 = 'm-0 mb-3 scroll-mt-20 text-[1.3rem] font-semibold tracking-[-0.01em]';
const H3 = 'mt-8 mb-2 scroll-mt-20 font-mono text-[0.95rem] font-semibold';
const P = 'my-3 text-dim text-pretty';
const CODE = 'rounded bg-raise px-1 py-0.5 font-mono text-[0.85em] text-text';
const CELL = 'border-b border-line px-3 py-2 text-left align-top';
const HEAD = `${CELL} text-[0.8rem] font-medium text-dim`;
const MONO = `${CELL} font-mono text-[0.8rem] whitespace-nowrap`;
const TYPE = `${CELL} font-mono text-[0.78rem] text-dim`;

const code = (h: H, text: string): Html => h.code([h.Class(CODE)], [text]);
const baseName = (signature: string) => signature.split('(')[0] ?? signature;

const table = (h: H, label: string, heads: readonly string[], rows: readonly (readonly Child[])[]): Html =>
  scrollRegion(h, label, [
    h.table(
      [h.Class('w-full border-collapse text-[0.88rem]')],
      [
        h.thead([], [h.tr([], heads.map((head) => h.th([h.Scope('col'), h.Class(HEAD)], [head])))]),
        h.tbody([], rows.map((cells) => h.tr([], [...cells]))),
      ],
    ),
  ]);

const schemaType = (schema: Schema): string => {
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (schema.type === 'array') return `${schema.items ? schemaType(schema.items) : 'unknown'}[]`;
  if (schema.type === 'object' && schema.properties) return `{ ${Object.keys(schema.properties).join(', ')} }`;
  return schema.type ?? 'unknown';
};

const TOC: readonly (readonly [string, string])[] = [
  ['ref-tools', 'MCP tools'],
  ['ref-replies', 'Replies and error codes'],
  ['ref-event', 'The hand.action event'],
  ['ref-hand', 'The Hand class'],
  ['ref-types', 'Types'],
  ['ref-env', 'Environment variables'],
  ['ref-credentials', 'Where credentials come from'],
  ['ref-exports', 'Package exports'],
];

const toc = (h: H): Html =>
  h.nav(
    [h.AriaLabel('On this page'), h.Class('mt-6 rounded-[10px] border border-line p-4')],
    [h.ul([h.Class('m-0 grid list-none gap-1 p-0 sm:grid-cols-2')], TOC.map(([id, label]) => h.li([], [h.a([h.Href(`#${id}`), h.Class('text-dim hover:text-text')], [label])])))],
  );

const tool = (h: H, entry: (typeof reference.tools)[number]): Html => {
  const schema = entry.inputSchema as unknown as Schema;
  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {});
  return h.div(
    [],
    [
      h.h3([h.Id(`tool-${entry.name}`), h.Class(H3)], [entry.name]),
      h.p([h.Class(P)], [entry.description]),
      props.length
        ? table(
            h,
            `${entry.name} arguments`,
            ['Argument', 'Type', 'Required', 'What it is'],
            props.map(([name, prop]) => [
              h.td([h.Class(MONO)], [name]),
              h.td([h.Class(TYPE)], [schemaType(prop)]),
              h.td([h.Class(`${CELL} text-dim`)], [required.has(name) ? 'yes' : 'no']),
              h.td([h.Class(`${CELL} text-dim`)], [prop.description ?? '']),
            ]),
          )
        : h.p([h.Class(P)], ['No arguments.']),
    ],
  );
};

const fieldsTable = (h: H, shape: Shape, notes: Record<string, string> = {}): Html =>
  shape.text
    ? h.pre([h.Class('my-3 overflow-x-auto rounded-[10px] bg-raise p-4 font-mono text-[0.8rem] leading-[1.55] whitespace-pre-wrap'), h.Tabindex(0), h.AriaLabel(`${shape.name} type`)], [shape.text])
    : table(
        h,
        `${shape.name} fields`,
        ['Field', 'Type', 'What it is'],
        shape.fields.map((field) => [
          h.td([h.Class(MONO)], [`${field.name}${field.optional ? '?' : ''}`]),
          h.td([h.Class(TYPE)], [field.type]),
          h.td([h.Class(`${CELL} text-dim`)], [notes[baseName(field.name)] ?? field.doc]),
        ]),
      );

const shapeBlock = (h: H, shape: Shape): Html =>
  h.div(
    [],
    [
      h.h3([h.Id(`type-${baseName(shape.name.split(' ')[0] ?? shape.name)}`), h.Class(H3)], [shape.name]),
      h.p([h.Class(P)], [SHAPE_NOTES[shape.name] ?? shape.doc, ' ', h.span([h.Class('font-mono text-[0.78rem]')], [shape.file])]),
      fieldsTable(h, shape, shape.name === 'HandOptions' ? OPTION_NOTES : (FIELD_NOTES[shape.name] ?? {})),
    ],
  );

const shapes = reference.shapes as Shape[];
const shapeNamed = (name: string) => shapes.find((shape) => shape.name === name || shape.name.startsWith(`${name} `));

export const referenceMain = (h: H): readonly Child[] => [
  h.article(
    [h.Class('mx-auto max-w-[52rem] pt-10 pb-16 md:pt-16')],
    [
      h.h1([h.Class('m-0 mb-3 text-[2rem] font-semibold tracking-[-0.025em]')], ['Reference']),
      h.p([h.Class('m-0 text-[1.05rem] text-dim text-pretty')], [
        `Every tool, type, error code and setting in hand ${reference.version}, generated from the source so it cannot drift. New to hand? Start with the `,
        h.a([h.Href('/docs/')], ['docs']),
        '.',
      ]),
      toc(h),
      h.section(
        [h.AriaLabelledBy('ref-tools'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-tools'), h.Class(H2)], [`MCP tools (${reference.tools.length})`]),
          h.p([h.Class(P)], ['The server is ', code(h, 'hand mcp'), ' over stdio. Each tool below is listed by tools/list with exactly this schema.']),
          ...reference.tools.map((entry) => tool(h, entry)),
        ],
      ),
      h.section(
        [h.AriaLabelledBy('ref-replies'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-replies'), h.Class(H2)], ['Replies and error codes']),
          h.p([h.Class(P)], ['A reply is text. It starts with what happened and ends with receipts. When nothing was done it starts with one of these words:']),
          table(h, 'Reply words', ['Word', 'Meaning'], Object.entries(REPLY_NOTES).map(([word, note]) => [h.td([h.Class(MONO)], [word]), h.td([h.Class(`${CELL} text-dim`)], [note])])),
          h.p([h.Class(P)], ['Receipts and failed actions carry a code:']),
          table(h, 'Error codes', ['Code', 'Meaning'], reference.codes.map((name) => [h.td([h.Class(MONO)], [name]), h.td([h.Class(`${CELL} text-dim`)], [CODE_NOTES[name] ?? ''])])),
        ],
      ),
      h.section(
        [h.AriaLabelledBy('ref-event'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-event'), h.Class(H2)], ['The hand.action event']),
          h.p([h.Class(P)], [
            'Before and after every action the server sends ',
            code(h, 'notifications/message'),
            ' with ',
            code(h, 'logger: "hand.action"'),
            ' and this as ',
            code(h, 'data'),
            '. Use it to draw your own cursor, and set ',
            code(h, 'HAND_CURSOR=0'),
            ' so you do not get two.',
          ]),
          ...['ActionEvent', 'Delivery', 'Mechanism'].map((name) => shapeNamed(name)).filter((shape): shape is Shape => Boolean(shape)).map((shape) => shapeBlock(h, shape)),
        ],
      ),
      h.section(
        [h.AriaLabelledBy('ref-hand'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-hand'), h.Class(H2)], ['The Hand class']),
          h.p([h.Class(P)], [code(h, "import { Hand } from 'hand/hand'"), ', then ', code(h, 'new Hand(transport, device, options)'), '. Every method returns the reply text an agent would see.']),
          table(
            h,
            'Hand members',
            ['Member', 'Returns', 'What it does'],
            reference.hand.map((member) => [
              h.td([h.Class(`${CELL} font-mono text-[0.78rem]`)], [member.name]),
              h.td([h.Class(TYPE)], [member.type]),
              h.td([h.Class(`${CELL} text-dim`)], [MEMBER_NOTES[baseName(member.name)] ?? member.doc]),
            ]),
          ),
          ...['HandOptions', 'Step'].map((name) => shapeNamed(name)).filter((shape): shape is Shape => Boolean(shape)).map((shape) => shapeBlock(h, shape)),
        ],
      ),
      h.section(
        [h.AriaLabelledBy('ref-types'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-types'), h.Class(H2)], ['Types']),
          ...shapes
            .filter((shape) => !['ActionEvent', 'Delivery', 'Mechanism', 'HandOptions', 'Step'].includes(shape.name))
            .map((shape) => shapeBlock(h, shape)),
        ],
      ),
      h.section(
        [h.AriaLabelledBy('ref-env'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-env'), h.Class(H2)], [`Environment variables (${reference.envVars.length})`]),
          table(h, 'Environment variables', ['Variable', 'What it does'], reference.envVars.map((name) => [h.td([h.Class(MONO)], [name]), h.td([h.Class(`${CELL} text-dim`)], [ENV_NOTES[name] ?? ''])])),
        ],
      ),
      h.section(
        [h.AriaLabelledBy('ref-credentials'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-credentials'), h.Class(H2)], ['Where credentials come from']),
          h.p([h.Class(P)], ['The MCP server takes the first of these that exists:']),
          h.ol(
            [h.Class('my-3 list-decimal pl-6 text-dim')],
            [
              ['If ', code(h, 'HAND_TOKEN'), ' is set, that token, with the account from ', code(h, 'HAND_ACCOUNT_ID'), ' or ', code(h, '~/.config/hand/config.json'), '.'],
              ['Otherwise the Cloudflare sign-in from the app, in the Keychain under ', code(h, 'hand-oauth'), '. It calls Workers AI directly and refreshes through hand.coey.dev.'],
              ['Otherwise an API token in the Keychain under ', code(h, 'hand-gateway'), ' or in ', code(h, '~/.config/hand/token'), ', with the account from the config file.'],
            ].map((parts) => h.li([h.Class('mt-1.5')], parts)),
          ),
        ],
      ),
      h.section(
        [h.AriaLabelledBy('ref-exports'), h.Class(SECTION)],
        [
          h.h2([h.Id('ref-exports'), h.Class(H2)], [`Package exports (${reference.exports.length})`]),
          table(h, 'Package exports', ['Import', 'What it holds'], reference.exports.map((path) => [h.td([h.Class(MONO)], [path]), h.td([h.Class(`${CELL} text-dim`)], [EXPORT_NOTES[path] ?? ''])])),
        ],
      ),
    ],
  ),
];
