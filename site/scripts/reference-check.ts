import reference from '../src/generated/reference.json';
import { CODE_NOTES, ENV_NOTES, EXPORT_NOTES, FIELD_NOTES, MEMBER_NOTES, OPTION_NOTES, SHAPE_NOTES } from '../src/reference-notes.ts';

const missing: string[] = [];
const need = (kind: string, names: readonly string[], notes: Record<string, string>) => {
  for (const name of names) if (!notes[name]) missing.push(`${kind} ${name}`);
  for (const name of Object.keys(notes)) if (!names.includes(name)) missing.push(`${kind} ${name} is described but no longer in the code`);
};

need('error code', reference.codes, CODE_NOTES);
need('env var', reference.envVars, ENV_NOTES);
need('export', reference.exports, EXPORT_NOTES);
need('Hand member', reference.hand.map((member) => member.name.split('(')[0] ?? member.name), MEMBER_NOTES);
need('type', reference.shapes.map((shape) => shape.name), SHAPE_NOTES);
for (const shape of reference.shapes.filter((shape) => shape.fields.length && shape.name !== 'HandOptions'))
  need(`${shape.name} field`, shape.fields.map((field) => field.name.split('(')[0] ?? field.name), FIELD_NOTES[shape.name] ?? {});
need('HandOptions field', reference.shapes.find((shape) => shape.name === 'HandOptions')?.fields.map((field) => field.name) ?? [], OPTION_NOTES);

const undescribed = (props: Record<string, { description?: string }> | undefined, at: string) => {
  for (const [name, prop] of Object.entries(props ?? {})) if (!prop.description?.trim()) missing.push(`tool argument ${at}.${name} has no description`);
};
for (const tool of reference.tools) {
  if (!tool.description.trim()) missing.push(`tool ${tool.name} has no description`);
  undescribed((tool.inputSchema as unknown as { properties?: Record<string, { description?: string }> }).properties, tool.name);
}

if (missing.length) {
  console.error(`reference is out of date:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}
console.log(`reference check PASS: ${reference.tools.length} tools, ${reference.codes.length} codes, ${reference.envVars.length} env vars, ${reference.hand.length} Hand members, ${reference.shapes.length} types, ${reference.exports.length} exports`);

const schemaLine = (name: string, prop: { type?: string; enum?: string[]; description?: string }, required: boolean) =>
  `  - ${name}${required ? '' : '?'}: ${prop.enum ? prop.enum.join(' | ') : prop.type} — ${prop.description ?? ''}`;
const lines = [
  `# hand reference ${reference.version}`,
  '',
  'Generated from the source. Human version: https://hand.coey.dev/docs/reference/',
  '',
  '## MCP tools',
  ...reference.tools.flatMap((tool) => {
    const schema = tool.inputSchema as unknown as { properties?: Record<string, { type?: string; enum?: string[]; description?: string }>; required?: string[] };
    const required = new Set(schema.required ?? []);
    return ['', `### ${tool.name}`, tool.description, ...Object.entries(schema.properties ?? {}).map(([name, prop]) => schemaLine(name, prop, required.has(name)))];
  }),
  '',
  '## Reply words',
  '- UNSURE: nothing was done; Clef could not tell which control was meant.',
  '- BLOCKED: nothing was done; the control looks destructive. Retry with confirm only if the user asked.',
  '',
  '## Error codes',
  ...reference.codes.map((name) => `- ${name}: ${CODE_NOTES[name]}`),
  '',
  '## Environment variables',
  ...reference.envVars.map((name) => `- ${name}: ${ENV_NOTES[name]}`),
  '',
  '## Hand class',
  ...reference.hand.map((member) => `- ${member.name}: ${member.type} — ${MEMBER_NOTES[member.name.split('(')[0] ?? member.name]}`),
  '',
  '## Types',
  ...reference.shapes.flatMap((shape) => [
    '',
    `### ${shape.name} (${shape.file})`,
    SHAPE_NOTES[shape.name] ?? '',
    ...(shape.text
      ? [`  ${shape.text}`]
      : shape.fields.map((field) => `  - ${field.name}${field.optional ? '?' : ''}: ${field.type} — ${(shape.name === 'HandOptions' ? OPTION_NOTES : (FIELD_NOTES[shape.name] ?? {}))[field.name.split('(')[0] ?? field.name] ?? ''}`)),
  ]),
  '',
  '## Package exports',
  ...reference.exports.map((path) => `- ${path}: ${EXPORT_NOTES[path]}`),
  '',
];
await Bun.write(new URL('../public/llms-full.txt', import.meta.url), lines.join('\n'));
