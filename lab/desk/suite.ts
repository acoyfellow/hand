import { HARD_TASKS, TASKS } from '../../bench/tasks.ts';
import { NATIVE_TASKS } from './native-tasks.ts';
import { type Vm, vm } from './vm.ts';

export interface DeskTask {
  readonly id: string;
  readonly kind: 'pwa' | 'native';
  readonly app: string;
  readonly text: string;
  readonly allow: readonly string[];
  readonly prepare: (box: Vm) => Promise<void>;
  readonly passed: (box: Vm) => Promise<boolean>;
}

const PWA = 'http://127.0.0.1:8787';
const WEB_TASKS = [...TASKS, ...HARD_TASKS.slice(0, 30 - TASKS.length)];

const openPwa = (screen: string, seed: number) =>
  `curl -s -X POST ${PWA}/reset >/dev/null; open -na "Google Chrome" --args --app="${PWA}/app?screen=${screen}&seed=${seed}" --user-data-dir=$HOME/.desk-chrome --no-first-run ${process.env.DESK_PWA_QUIET === '1' ? "--no-default-browser-check --disable-infobars --disable-component-update --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' " : ''}--window-size=${process.env.DESK_PWA_WINDOW ?? '1280,800'} --window-position=0,30`;

const pwaState = async (box: Vm) => {
  const body = await box.run(`curl -s ${PWA}/state`);
  return (JSON.parse(body) as { state: unknown }).state;
};

const seedState = async (box: Vm, screen: string, seed: number) => {
  await box.run(`pkill -f desk-chrome; ${openPwa(screen, seed)}`);
  for (let attempt = 0; attempt < 40; attempt++) {
    const state = await pwaState(box);
    if (state) return state;
    await Bun.sleep(250);
  }
  throw new Error(`PWA did not report state for ${screen} seed ${seed}`);
};

const built = new Map<string, ReturnType<(typeof WEB_TASKS)[number]['build']>>();

const webTask = (build: (typeof WEB_TASKS)[number]): DeskTask => ({
  id: `pwa-${build.id}`,
  kind: 'pwa',
  app: 'Workbench (PWA)',
  get text() {
    const done = built.get(build.id);
    if (!done) throw new Error(`prepare ${build.id} before reading its text`);
    return `In the Workbench app: ${done.text}`;
  },
  get allow() {
    return built.get(build.id)?.allow ?? [];
  },
  prepare: async (box) => {
    const state = await seedState(box, build.screen, build.seed);
    built.set(build.id, build.build(state));
  },
  passed: async (box) => {
    const done = built.get(build.id);
    const state = await pwaState(box);
    return Boolean(done && state && done.check(state));
  },
});

const nativeTask = (task: (typeof NATIVE_TASKS)[number]): DeskTask => ({
  id: `mac-${task.id}`,
  kind: 'native',
  app: task.app,
  text: task.text,
  allow: task.allow,
  prepare: async (box) => {
    await box.run(task.setup);
  },
  passed: async (box) => (await box.status(task.check)) === 0,
});

export const DESK_TASKS: readonly DeskTask[] = [...WEB_TASKS.map(webTask), ...NATIVE_TASKS.map(nativeTask)];

export const defaultVm = () => vm(process.env.DESK_VM_HOST ?? '192.168.64.7');
