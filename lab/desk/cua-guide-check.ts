import { cuaGuideText } from './entrants.ts';
import { vm } from './vm.ts';

const guide = await cuaGuideText(vm(process.env.DESK_VM_HOST ?? '192.168.64.9'));
console.log(`guide: ${guide.length} chars`);
console.log(guide.slice(0, 300));
