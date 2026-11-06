import { cuaGuideText, openCuaSession } from './entrants.ts';
import { vm } from './vm.ts';

const box = vm(process.env.DESK_VM_HOST ?? '192.168.64.9');
const guide = await cuaGuideText(box);
console.log(`guide: ${guide.length} chars`);
const session = await openCuaSession(box);
const started = Date.now();
const apps = await session.call('list_apps', {});
console.log(`list_apps in ${Date.now() - started} ms: ${apps.slice(0, 160).replace(/\n/g, ' ')}`);
const bad = await session.call('hotkey', { keys: ['return'] });
console.log(`bad hotkey comes back as text: ${bad.slice(0, 120).replace(/\n/g, ' ')}`);
session.close();
