import { claudeCu } from './claude-cu.ts';
import { codexCu } from './codex-cu.ts';
import { agentDesktop, type DeskEntrant, hand } from './entrants.ts';
import type { Vm } from './vm.ts';

const PERMISSION_REASON =
  'macOS Accessibility and Screen Recording were not granted to this tool in the VM. macOS accepts that grant only from a human click in System Settings; synthetic clicks and TCC writes are blocked by SIP.';

const cuaDriver: DeskEntrant = {
  id: 'cua',
  label: 'cua (Cua Driver)',
  install: async (box: Vm) => {
    const out = await box.run('"$HOME/.local/bin/cua-driver" call check_permissions "{}" 2>&1 | head -c 200').catch((error: Error) => error.message);
    return out.includes('permissions_pending') ? { ok: false, reason: PERMISSION_REASON } : { ok: false, reason: `cua adapter not built: driver reports ${out.slice(0, 120)}` };
  },
  run: async () => ({ claimedDone: false, turns: 0, usd: 0, trace: [], error: 'not installed' }),
};

export const DESK_ROSTER: Record<string, DeskEntrant> = { hand, 'codex-cu': codexCu, 'claude-cu': claudeCu, 'agent-desktop': agentDesktop, cua: cuaDriver };
