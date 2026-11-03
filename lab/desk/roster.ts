import { claudeCu } from './claude-cu.ts';
import { agentDesktop, type DeskEntrant, hand } from './entrants.ts';

export const DESK_ROSTER: Record<string, DeskEntrant> = { hand, 'agent-desktop': agentDesktop, 'claude-cu': claudeCu };
