import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const receipt = JSON.parse(readFileSync(join(import.meta.dir, '..', '..', 'bench', 'runs', 'demo-swarm', 'receipt.json'), 'utf8')) as {
  results: { agent: string; passed: boolean; claimedDone: boolean; error?: string; events: { atMs: number; tool: string; result: string }[] }[];
};
for (const result of receipt.results) {
  console.log(`== ${result.agent} passed=${result.passed} claimedDone=${result.claimedDone} ${result.error ?? ''}`);
  for (const event of result.events) console.log(`  ${Math.round(event.atMs / 1000)} ${event.tool} ${event.result.slice(0, 240).replaceAll('\n', ' | ')}`);
}
