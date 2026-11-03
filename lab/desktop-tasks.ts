import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const osa = async (...lines: string[]): Promise<string> => {
  const { stdout } = await run('osascript', lines.flatMap((line) => ['-e', line]), { timeout: 30_000 });
  return stdout.trim();
};

export const helperText = async (helper: string, app: string): Promise<string> => {
  const { stdout } = await run(helper, ['text', app], { timeout: 30_000 });
  return (JSON.parse(stdout) as { lines: string[] }).lines.join('\n');
};

export interface DesktopTask {
  readonly id: string;
  readonly app: string;
  readonly text: string;
  setup(): Promise<void>;
  check(helper: string): Promise<boolean>;
  teardown(): Promise<void>;
}

const clearCalculator = async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { stdout } = await run('native/ax', ['snapshot', 'Calculator'], { timeout: 30_000 });
    const clear = (JSON.parse(stdout) as { candidates: { name: string; path: number[]; ref: string }[] }).candidates.find((c) => c.name === 'All Clear' || c.name === 'Clear');
    if (!clear) return;
    await run('native/ax', ['press', 'Calculator', clear.path.join('.'), '--ref', clear.ref], { timeout: 30_000 });
  }
};

const calculatorReads = async (helper: string, want: string) => (await helperText(helper, 'Calculator')).split('\n').some((line) => line.replace(/[,\s]/g, '') === want);

const calculator = (id: string, text: string, want: string): DesktopTask => ({
  id,
  app: 'Calculator',
  text,
  setup: async () => {
    await osa('tell application "Calculator" to launch');
    await clearCalculator();
  },
  check: (helper) => calculatorReads(helper, want),
  teardown: async () => {},
});

let labDocument = '';

const textedit = (id: string, start: string, text: string, check: (body: string) => boolean): DesktopTask => ({
  id,
  app: 'TextEdit',
  text,
  setup: async () => {
    labDocument = await osa(
      'tell application "TextEdit"',
      `set d to make new document with properties {text:${JSON.stringify(start)}}`,
      'return name of d',
      'end tell',
    );
  },
  check: async () => check(await osa(`tell application "TextEdit" to get text of document ${JSON.stringify(labDocument)}`)),
  teardown: async () => {
    if (!labDocument) return;
    await osa(`tell application "TextEdit" to close document ${JSON.stringify(labDocument)} saving no`).catch(() => '');
    labDocument = '';
  },
});

export const DESKTOP_TASKS: DesktopTask[] = [
  calculator('calc-add', 'In Calculator, work out 12 + 30.', '42'),
  calculator('calc-multiply', 'In Calculator, work out 7 times 8.', '56'),
  calculator('calc-subtract', 'Use Calculator to compute 100 minus 37.', '63'),
  calculator('calc-divide', 'Use Calculator to divide 144 by 12.', '12'),
  calculator('calc-chain', 'In Calculator, compute 9 times 9, then add 19 to the result.', '100'),
  calculator('calc-percent', 'In Calculator, find 25 percent of 80.', '20'),
  textedit('te-append', 'Shopping list', 'In TextEdit, add the word "milk" on a new line at the end of the document.', (body) => /milk\s*$/i.test(body.trim()) && body.includes('Shopping list')),
  textedit('te-replace', 'Hello wrld', 'In TextEdit, fix the typo so the document says "Hello world".', (body) => body.trim() === 'Hello world'),
  textedit('te-write', '', 'In TextEdit, write "Meeting moved to 3pm" in the empty document.', (body) => body.trim() === 'Meeting moved to 3pm'),
  textedit('te-clear', 'delete me please', 'In TextEdit, delete all the text in the document so it is empty.', (body) => body.trim() === ''),
];
