import { claudeCu } from './claude-cu.ts';
import { codexCu } from './codex-cu.ts';
import { agentDesktop, type DeskEntrant, hand } from './entrants.ts';

export const DESK_ROSTER: Record<string, DeskEntrant> = { hand, 'codex-cu': codexCu, 'claude-cu': claudeCu, 'agent-desktop': agentDesktop };
