import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { Schema } from 'effect';
import { Mark, hasCursor, swarm } from './brand.ts';
import { MarkOptions } from './mark-options.ts';
import { Message } from './message.ts';
import { Motion } from './model.ts';

const runUntilUnmount = (start: () => () => void) =>
  Effect.acquireRelease(Effect.sync(start), (stop) => Effect.sync(stop)).pipe(Effect.as(Message.CompletedMount()));

export const Backdrop = Mount.define('Backdrop', {
  messages: [Message.CompletedMount],
  execute: ({ element }) =>
    runUntilUnmount(() => {
      const pattern = Mark.backdrop(element as HTMLElement);
      return () => pattern.stop();
    }),
});

export const Swarm = Mount.define('Swarm', {
  args: { seeds: Schema.Array(Schema.String) },
  messages: [Message.CompletedMount],
  execute: ({ element, seeds }) =>
    runUntilUnmount(() => {
      if (!hasCursor()) return () => undefined;
      const host = element as HTMLElement;
      const running = swarm(host, { seeds });
      return () => {
        running.stop();
        host.replaceChildren();
      };
    }),
});

const peekAmount = (peek: HTMLElement) => {
  const box = peek.getBoundingClientRect();
  const shown = Math.min(1, Math.max(0, (innerHeight - box.bottom + 40) / (box.height + 40)));
  const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
  return { amount: atEnd ? 1 : shown, atEnd };
};

export const Peek = Mount.define('Peek', {
  messages: [Message.CompletedMount],
  execute: ({ element }) =>
    runUntilUnmount(() => {
      const peek = element as HTMLElement;
      const refresh = () => {
        const { amount, atEnd } = peekAmount(peek);
        peek.style.setProperty('--peek', String(amount));
        peek.dataset.settled = String(atEnd);
      };
      addEventListener('scroll', refresh, { passive: true });
      addEventListener('resize', refresh);
      refresh();
      return () => {
        removeEventListener('scroll', refresh);
        removeEventListener('resize', refresh);
      };
    }),
});

const PREVIEW_SIZES = [96, 64, 32, 16];

const paintPreview = (root: Element, shape: MarkOptions, accent: string, fixed: boolean) => {
  const paper = root.querySelector('[data-stage="paper"]');
  const night = root.querySelector('[data-stage="night"]');
  const sizes = root.querySelector('[data-stage="sizes"]');
  if (paper) paper.innerHTML = Mark.markSvg(shape, { size: 150, accent, fixed });
  if (night) night.innerHTML = Mark.markSvg(shape, { ink: Mark.COLORS.nightInk, size: 150, accent, fixed });
  if (sizes)
    sizes.innerHTML = PREVIEW_SIZES.map(
      (size) => `<figure class="m-0 grid justify-items-center gap-1">${Mark.iconSvg(shape, { size, accent, fixed })}<figcaption class="font-mono text-[11px] text-dim">${size}</figcaption></figure>`,
    ).join('');
};

export const AnimatedPreview = Mount.defineStream('AnimatedPreview', {
  args: { options: MarkOptions, accent: Schema.String, motion: Motion, morph: Schema.Boolean, colorful: Schema.Boolean },
  messages: [Message.ArrivedMorph],
  execute: ({ element, options, accent, motion, morph, colorful }) =>
    Stream.callback<typeof Message.ArrivedMorph.Type>((queue) =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            if ((!morph && motion === 'still') || Mark.prefersStill()) {
              paintPreview(element, options, accent, false);
              return () => undefined;
            }
            const walk = morph ? Mark.walker(options, { colorful, startAccent: accent }) : undefined;
            let frame = 0;
            let arrived = false;
            const tick = (now: number) => {
              let shape = options;
              let tone = accent;
              if (walk) {
                const step = walk.at(now);
                shape = step.shape;
                tone = step.accent;
                if (step.arrived && !arrived) {
                  arrived = true;
                  Queue.offerUnsafe(queue, Message.ArrivedMorph({ seed: step.arrived.seed, options: step.arrived.shape, accent: step.arrived.accent }));
                }
              }
              paintPreview(element, Mark.pose(shape, motion, now), tone, true);
              frame = requestAnimationFrame(tick);
            };
            frame = requestAnimationFrame(tick);
            return () => cancelAnimationFrame(frame);
          }),
          (stop) => Effect.sync(stop),
        );
        return yield* Effect.never;
      }),
    ),
});

export const MarkArt = Mount.define('MarkArt', {
  args: { options: MarkOptions, accent: Schema.String, size: Schema.Number },
  messages: [Message.CompletedMount],
  execute: ({ element, options, accent, size }) =>
    Effect.sync(() => {
      element.innerHTML = Mark.markSvg(options, { accent, size });
      return Message.CompletedMount();
    }),
});

const sortTableBy = (table: HTMLTableElement, column: number, direction: 1 | -1) => {
  const body = table.tBodies[0];
  if (!body) return;
  const read = (row: HTMLTableRowElement) => {
    const raw = row.cells[column]?.getAttribute('data-sortvalue') ?? '';
    const number = Number(raw);
    return raw !== '' && Number.isFinite(number) ? number : raw.toLowerCase();
  };
  const rows = [...body.rows].sort((a, b) => {
    const x = read(a);
    const y = read(b);
    return (x > y ? 1 : x < y ? -1 : 0) * direction;
  });
  body.append(...rows);
  const heads = table.tHead?.rows[0]?.cells ?? [];
  for (const [index, head] of [...heads].entries()) {
    if (index === column) head.setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');
    else head.removeAttribute('aria-sort');
  }
};

export const SortableTable = Mount.define('SortableTable', {
  messages: [Message.CompletedMount],
  execute: ({ element }) =>
    runUntilUnmount(() => {
      const table = element.querySelector('table');
      if (!table) return () => undefined;
      let current = { column: 0, direction: 1 as 1 | -1 };
      const onClick = (event: Event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-sortcolumn]');
        if (!button) return;
        const column = Number(button.getAttribute('data-sortcolumn'));
        const firstDirection: 1 | -1 = button.getAttribute('data-sortdescending') === 'true' ? -1 : 1;
        const direction: 1 | -1 = current.column === column ? (current.direction === 1 ? -1 : 1) : firstDirection;
        current = { column, direction };
        sortTableBy(table, column, direction);
      };
      table.addEventListener('click', onClick);
      return () => table.removeEventListener('click', onClick);
    }),
});
