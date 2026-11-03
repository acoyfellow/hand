import { Effect } from 'effect';
import { Command } from 'foldkit';
import { Schema } from 'effect';
import { Mark } from './brand.ts';
import { MarkOptions } from './mark-options.ts';
import { Message } from './message.ts';

const randomSeed = (length: number) => crypto.randomUUID().replace(/-/g, '').slice(0, length);

const writeClipboard = (text: string) => Effect.promise(() => navigator.clipboard.writeText(text).catch(() => undefined));

const download = (name: string, svg: string) =>
  Effect.sync(() => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    link.download = name;
    link.click();
  });

export const AnnounceHydration = Command.define('AnnounceHydration', {
  messages: [Message.CompletedHydration],
  execute: Effect.succeed(Message.CompletedHydration()),
});

export const CopyInstall = Command.define('CopyInstall', {
  args: { text: Schema.String },
  messages: [Message.CopiedInstall],
  execute: ({ text }) => writeClipboard(text).pipe(Effect.as(Message.CopiedInstall())),
});

export const ClearCopied = Command.define('ClearCopied', {
  messages: [Message.ClearedCopied],
  execute: Effect.sleep('1500 millis').pipe(Effect.as(Message.ClearedCopied())),
});

export const RandomSeed = Command.define('RandomSeed', {
  messages: [Message.GotRandomSeed],
  execute: Effect.sync(() => Message.GotRandomSeed({ seed: randomSeed(8) })),
});

export const RandomBatch = Command.define('RandomBatch', {
  messages: [Message.GotBatch],
  execute: Effect.sync(() => Message.GotBatch({ seeds: Array.from({ length: 24 }, () => randomSeed(8)) })),
});

export const RandomAgents = Command.define('RandomAgents', {
  messages: [Message.GotAgents],
  execute: Effect.sync(() => Message.GotAgents({ seeds: Array.from({ length: 4 }, () => randomSeed(6)) })),
});

export const DownloadMark = Command.define('DownloadMark', {
  args: { options: MarkOptions },
  messages: [Message.CompletedEffect],
  execute: ({ options }) => download('hand-mark.svg', Mark.markSvg(options)).pipe(Effect.as(Message.CompletedEffect())),
});

export const DownloadIcon = Command.define('DownloadIcon', {
  args: { options: MarkOptions },
  messages: [Message.CompletedEffect],
  execute: ({ options }) => download('hand-icon.svg', Mark.iconSvg(options)).pipe(Effect.as(Message.CompletedEffect())),
});

export const CopySettings = Command.define('CopySettings', {
  args: { options: MarkOptions },
  messages: [Message.CopiedSettings],
  execute: ({ options }) => writeClipboard(JSON.stringify(options)).pipe(Effect.as(Message.CopiedSettings())),
});
