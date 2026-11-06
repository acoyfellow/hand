import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cuaGuideText, openCuaSession } from './entrants.ts';
import { vm } from './vm.ts';

const box = vm(process.env.DESK_VM_HOST ?? '192.168.64.9');
const outDir = join(import.meta.dir, '..', '..', 'bench', 'runs', 'rivals');
mkdirSync(outDir, { recursive: true });

const session = await openCuaSession(box);
const listed = await session.listTools();
session.close();
writeFileSync(join(outDir, 'cua-tools.json'), `${JSON.stringify(listed, null, 2)}\n`);
writeFileSync(join(outDir, 'cua-guide.txt'), await cuaGuideText(box));

const agentDesktopHelp = await box.run('PATH="$HOME/.bun/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:$PATH"; agent-desktop --help 2>&1; for c in $(agent-desktop --help 2>/dev/null | awk \'/^  [a-z]/{print $1}\'); do echo "=== $c"; agent-desktop $c --help 2>&1 | head -30; done');
writeFileSync(join(outDir, 'agent-desktop-help.txt'), agentDesktopHelp);
console.log(`cua tools: ${JSON.stringify(listed).length} chars, agent-desktop help: ${agentDesktopHelp.length} chars`);
