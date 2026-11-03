import { Flags, Model } from './model.ts';
import { init, update } from './update.ts';
import { view } from './view.ts';

export const program = { Model, Flags, init, update, view } as const;
