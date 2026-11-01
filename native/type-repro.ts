import { execFileSync } from 'node:child_process';
import { gatewayTransport } from '../src/clef.ts';
import { readConfig, readToken } from '../src/credentials.ts';
import { macosDevice } from '../src/devices/macos.ts';
import { Hand } from '../src/hand.ts';
import { DEFAULT_HAND } from '../src/mcp.ts';

const osa = (script: string) => execFileSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 10_000 }).trim();
const helper = `${import.meta.dir}/ax`;
const rounds = Number(process.argv[2] ?? 3);
const transport = gatewayTransport({ ...readConfig(), token: readToken() });
let passed = 0;
for (let round = 0; round < rounds; round++) {
  osa('tell application "TextEdit" to close every document saving no');
  osa('tell application "TextEdit" to make new document');
  await new Promise((resolve) => setTimeout(resolve, 800));
  execFileSync(helper, ['activate', 'TextEdit']);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const device = macosDevice({ helper, app: 'TextEdit' });
  const hand = new Hand(transport, device, DEFAULT_HAND);
  const marker = `${Date.now()}`;
  const receipt = await hand.type(marker, 'the document text area').catch((error: Error) => `ERROR ${error.message}`);
  osa('tell application "System Events" to key code 53');
  const body = osa('tell application "TextEdit" to get text of front document');
  const ok = body.includes(marker);
  passed += ok ? 1 : 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} round ${round + 1}: ${receipt} | body="${body.slice(0, 40)}" | ${device.lastActions.join(' ; ')}`);
}
console.log(`${passed}/${rounds}`);
