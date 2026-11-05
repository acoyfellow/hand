import * as markModule from '../public/brand/mark.js';
import * as swarmModule from '../public/brand/swarm.js';
import type { MarkOptions } from './mark-options.ts';

type Step = { readonly shape: MarkOptions; readonly accent: string; readonly arrived: { seed: string; shape: MarkOptions; accent: string } | null };

type MarkApi = {
  readonly STYLES: readonly string[];
  readonly PROFILES: readonly string[];
  readonly THUMBS: readonly string[];
  readonly DOTS: readonly string[];
  readonly MOTIONS: readonly string[];
  readonly PRESETS: Readonly<Record<string, MarkOptions>>;
  readonly COLORS: { readonly ink: string; readonly accent: string; readonly paper: string; readonly night: string; readonly nightInk: string };
  readonly accentOf: (seed: string) => string;
  readonly generate: (seed: string, style?: string) => MarkOptions;
  readonly balance: (options: MarkOptions) => MarkOptions;
  readonly markSvg: (options: MarkOptions, settings?: { ink?: string; accent?: string; size?: number; fixed?: boolean }) => string;
  readonly iconSvg: (options: MarkOptions, settings?: { size?: number; accent?: string; fixed?: boolean }) => string;
  readonly pose: (options: MarkOptions, motion: string, time: number) => MarkOptions;
  readonly prefersStill: () => boolean;
  readonly agent: (seed: string, settings?: { style?: string }) => { seed: string; shape: MarkOptions; accent: string };
  readonly walker: (start: MarkOptions, settings?: { colorful?: boolean; startAccent?: string }) => { at: (now: number) => Step };
  readonly backdrop: (element: HTMLElement) => { stop: () => void };
};

type SwarmApi = {
  readonly swarm: (element: HTMLElement, settings?: { seeds?: readonly string[] }) => { stop: () => void };
};

export const Mark: MarkApi = markModule as unknown as MarkApi;

export const swarm = (swarmModule as unknown as SwarmApi).swarm;

export const hasCursor = (): boolean => typeof (window as { __handCursorMount?: unknown }).__handCursorMount === 'function';
