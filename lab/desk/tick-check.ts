import { readFileSync } from 'node:fs';
import { Effect } from 'effect';
import { transport } from '../../bench/lib.ts';
import { ask } from '../../src/clef.ts';

const windowId = process.env.DEMO_WINDOW ?? '334';
const shotPath = '/tmp/tick-check.png';

export const vmShot = async () => {
  await Bun.spawn(['screencapture', '-x', '-o', `-l${windowId}`, shotPath]).exited;
  await Bun.spawn(['sips', '-Z', '1400', '-s', 'format', 'jpeg', shotPath, '--out', '/tmp/tick-check.jpg'], { stdout: 'ignore' }).exited;
  return `data:image/jpeg;base64,${readFileSync('/tmp/tick-check.jpg').toString('base64')}`;
};

export const isTicked = async (item: string, shot: string) => {
  const result = await Effect.runPromise(
    ask(transport(), {
      model: 'clef',
      state: { item },
      images: [shot],
      questions: {
        ticked: {
          type: 'noul',
          instructions: 'The image shows a Notes window with a checklist. Each item has a circle on its left. A checked item has a filled orange circle with a white tick; an unchecked item has an empty circle. Is the circle next to `item` checked?',
        },
      },
    }),
  );
  const answer = result.answers.ticked;
  const p = answer?.type === 'noul' ? answer.p : 0;
  return { item, p, checked: p >= 0.5 };
};

if (import.meta.main) {
  const shot = await vmShot();
  for (const item of ['Weather in Lisbon', 'Population of Portugal']) console.log(await isTicked(item, shot));
}
