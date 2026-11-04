import { claudeCuWith } from './claude-cu.ts';
import { agentDesktopWith, type DeskEntrant, handWith } from './entrants.ts';

export const GRID_TASKS = [
  'pwa-mail-spam',
  'pwa-editor-keep',
  'pwa-chat-attach-send',
  'pwa-mail-star-open',
  'pwa-settings-lang',
  'pwa-settings-name',
  'pwa-h-shop-cheapest',
  'pwa-shop-order',
  'mac-settings-24h',
  'mac-settings-dark',
  'mac-calendar-event',
  'mac-finder-rename',
  'mac-finder-tag-red',
  'mac-textedit-edit-line',
  'mac-cross-copy-to-note',
] as const;

export const GRID_PLANNER_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6.1-sol', 'glm-5.3', 'kimi-k3'] as const;
export const GRID_CLAUDE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'] as const;

export interface GridCell {
  readonly key: string;
  readonly entrant: string;
  readonly model: string;
  readonly make: () => DeskEntrant;
}

const cell = (entrant: string, model: string, make: () => DeskEntrant): GridCell => ({ key: `${entrant}@${model}`, entrant, model, make });

export const GRID_CELLS: readonly GridCell[] = [
  ...GRID_PLANNER_MODELS.map((model) => cell('hand', model, () => handWith(model))),
  ...GRID_PLANNER_MODELS.map((model) => cell('agent-desktop', model, () => agentDesktopWith(model))),
  ...GRID_CLAUDE_MODELS.map((model) => cell('claude-cu', model, () => claudeCuWith(model))),
];

export const GRID_SPEND_LIMIT_USD = 60;
