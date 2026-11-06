import { DESK_ROSTER } from './roster.ts';
import { vm } from './vm.ts';

const box = vm(process.env.DESK_VM_HOST ?? '192.168.64.9');
for (const id of ['codex-cu', 'cua'] as const) {
  const started = Date.now();
  const result = await DESK_ROSTER[id].install(box);
  console.log(`${id}: ${result.ok ? 'READY' : 'NOT READY'} in ${((Date.now() - started) / 1000).toFixed(1)} s${result.ok ? '' : ` - ${result.reason}`}`);
}
