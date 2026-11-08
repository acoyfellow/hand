import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { TOOLS } from '../../src/mcp.ts';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const out = fileURLToPath(new URL('../src/generated/reference.json', import.meta.url));

type Field = { name: string; type: string; optional: boolean; doc: string };
type Shape = { name: string; file: string; kind: 'interface' | 'type' | 'class'; doc: string; fields: Field[]; text?: string };

const program = ts.createProgram(
  ['hand.ts', 'mcp.ts', 'clef.ts', 'credentials.ts', 'grant.ts', 'devices/macos.ts', 'perceive.ts'].map((file) => join(repo, 'src', file)),
  { allowImportingTsExtensions: true, noEmit: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
);

const docOf = (node: ts.Node): string =>
  ts
    .getJSDocCommentsAndTags(node)
    .map((doc) => (typeof doc.comment === 'string' ? doc.comment : ''))
    .join(' ')
    .trim();

const shapes = new Map<string, Shape>();
const WANT = new Set([
  'HandOptions', 'Step', 'Device', 'Expectation', 'ElementState', 'TextEditResult', 'TextLine', 'ActionEvent', 'AxOutcome', 'Receipt', 'Delivery', 'Mechanism',
  'MacosDeviceOptions', 'Candidate', 'ClefRequest', 'Question', 'Answer', 'ClefResult', 'GatewayConfig', 'Grant',
]);

for (const source of program.getSourceFiles()) {
  if (!source.fileName.startsWith(join(repo, 'src'))) continue;
  const file = source.fileName.slice(repo.length);
  const fieldsOf = (members: ts.NodeArray<ts.TypeElement> | ts.NodeArray<ts.ClassElement>): Field[] =>
    members.flatMap((member): Field[] => {
      if (!member.name || !(ts.isPropertySignature(member) || ts.isMethodSignature(member))) return [];
      const name = member.name.getText(source);
      const optional = Boolean(member.questionToken);
      if (ts.isMethodSignature(member)) {
        const params = member.parameters.map((p) => p.getText(source)).join(', ');
        return [{ name: `${name}(${params})`, type: member.type?.getText(source) ?? 'void', optional, doc: docOf(member) }];
      }
      return [{ name, type: member.type?.getText(source).replace(/\s+/g, ' ') ?? 'unknown', optional, doc: docOf(member) }];
    });
  ts.forEachChild(source, (node) => {
    if (ts.isInterfaceDeclaration(node) && WANT.has(node.name.text)) {
      const extended = node.heritageClauses?.map((clause) => clause.getText(source)).join(' ') ?? '';
      shapes.set(node.name.text, { name: node.name.text + (extended ? ` ${extended}` : ''), file, kind: 'interface', doc: docOf(node), fields: fieldsOf(node.members) });
    }
    if (ts.isTypeAliasDeclaration(node) && WANT.has(node.name.text))
      shapes.set(node.name.text, { name: node.name.text, file, kind: 'type', doc: docOf(node), fields: [], text: node.type.getText(source).replace(/\s+/g, ' ') });
  });
}

const handSource = readFileSync(join(repo, 'src/hand.ts'), 'utf8');
const handFile = ts.createSourceFile('hand.ts', handSource, ts.ScriptTarget.ESNext, true);
const methods: Field[] = [];
ts.forEachChild(handFile, (node) => {
  if (!ts.isClassDeclaration(node) || node.name?.text !== 'Hand') return;
  for (const member of node.members) {
    const isPrivate = ts.getCombinedModifierFlags(member as ts.Declaration) & ts.ModifierFlags.Private;
    if (isPrivate || !member.name) continue;
    const name = member.name.getText(handFile);
    if (ts.isMethodDeclaration(member))
      methods.push({ name: `${name}(${member.parameters.map((p) => p.getText(handFile)).join(', ')})`, type: member.type?.getText(handFile) ?? '', optional: false, doc: docOf(member) });
    else if (ts.isGetAccessor(member)) methods.push({ name, type: 'number (getter)', optional: false, doc: docOf(member) });
    else if (ts.isPropertyDeclaration(member)) methods.push({ name, type: member.type?.getText(handFile) ?? '', optional: false, doc: docOf(member) });
  }
});

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
const sources = [...walk(join(repo, 'src')).filter((file) => file.endsWith('.ts')), join(repo, 'native/ax.swift'), join(repo, 'native/cursor.swift')].filter((file) => {
  try {
    readFileSync(file);
    return true;
  } catch {
    return false;
  }
});
const allCode = sources.map((file) => readFileSync(file, 'utf8')).join('\n');
const envVars = [...new Set([...allCode.matchAll(/HAND_[A-Z][A-Z_]+/g)].map((match) => match[0]))].filter((name) => !['HAND_DIR', 'HAND_AUTH_ORIGIN_DEFAULT'].includes(name)).sort();
const codes = [...new Set([...allCode.matchAll(/(?:code: ?|refused\()["']([A-Z][A-Z_]{3,})["']/g)].map((match) => match[1]))].sort();

const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as { name: string; version: string; exports: Record<string, string> };

writeFileSync(
  out,
  `${JSON.stringify(
    {
      version: pkg.version,
      tools: TOOLS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
      hand: methods,
      shapes: [...WANT].map((name) => shapes.get(name)).filter((shape): shape is Shape => Boolean(shape)),
      envVars,
      codes,
      exports: Object.keys(pkg.exports).map((path) => `hand${path.slice(1)}`),
    },
    null,
    2,
  )}\n`,
);
console.log(`reference: ${TOOLS.length} tools, ${methods.length} Hand members, ${shapes.size} shapes, ${envVars.length} env vars, ${codes.length} codes`);
