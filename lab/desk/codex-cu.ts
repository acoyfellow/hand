import type { DeskEntrant, EpisodeRun, Turn } from './entrants.ts';

const CODEX = 'export PATH="$HOME/.npm-global/bin:/usr/local/bin:$PATH"; cd "$HOME"; codex';

const PRICE_PER_MTOK = { input: 1.25, cachedInput: 0.125, output: 10 };

interface CodexEvent {
  readonly type: string;
  readonly item?: { type?: string; server?: string; tool?: string; command?: string; arguments?: unknown; text?: string; aggregated_output?: string };
  readonly usage?: { input_tokens: number; cached_input_tokens: number; output_tokens: number };
}

export const codexSandbox = process.env.DESK_CODEX_SANDBOX ?? 'danger-full-access';

export const codexCu: DeskEntrant = {
  id: 'codex-cu',
  label: 'Codex computer use',
  install: async (box) => {
    if ((await box.status(`${CODEX} mcp list | grep -q computer-use`)) !== 0) return { ok: false, reason: 'codex CLI or its computer-use MCP server not found in the VM' };
    const child = Bun.spawn(['perl', '-e', 'alarm 120; exec @ARGV', 'ssh', ...box.sshOptions, '-R', '49449:127.0.0.1:49449', `ax@${box.host}`, `${CODEX} exec --skip-git-repo-check --json -s read-only "Call the computer-use list_apps tool once and stop." 2>&1 | grep mcp_tool_call | tail -1`], { stdout: 'pipe', stderr: 'pipe' });
    const probe = await new Response(child.stdout).text();
    if (!probe.includes('mcp_tool_call')) return { ok: false, reason: `Codex never called its computer-use tool during the install probe: ${probe.slice(0, 160) || 'no output'}` };
    return /procNotFound|bootstrapTimedOut|"status":"failed"/.test(probe)
      ? { ok: false, reason: 'Codex Computer Use was not granted macOS Accessibility and Screen Recording in the VM (its tool returns procNotFound). macOS accepts that grant only from a human click in System Settings.' }
      : { ok: true };
  },
  run: async (box, task, limits): Promise<EpisodeRun> => {
    const seconds = Math.max(10, Math.round((limits.deadline - Date.now()) / 1000));
    const command = `${CODEX} exec --skip-git-repo-check --json -s ${codexSandbox} ${JSON.stringify(task)} 2>&1 | tail -c 200000`;
    const child = Bun.spawn(['perl', '-e', `alarm ${seconds}; exec @ARGV`, 'ssh', ...box.sshOptions, '-R', '49449:127.0.0.1:49449', `ax@${box.host}`, command], { stdout: 'pipe', stderr: 'pipe' });
    const out = await new Response(child.stdout).text();
    const code = await child.exited;
    const events = out
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as CodexEvent);
    const trace: Turn[] = events
      .filter((event) => event.type === 'item.completed' && event.item && event.item.type !== 'agent_message' && event.item.type !== 'reasoning')
      .map((event) => ({
        tool: event.item?.type === 'command_execution' ? 'shell' : `${event.item?.server ?? ''}.${event.item?.tool ?? event.item?.type ?? ''}`,
        args: { value: event.item?.command ?? event.item?.arguments ?? '' },
        result: String(event.item?.aggregated_output ?? '').slice(0, 300),
      }));
    const usage = events.filter((event) => event.usage).reduce((sum, event) => ({ input: sum.input + (event.usage?.input_tokens ?? 0), cached: sum.cached + (event.usage?.cached_input_tokens ?? 0), output: sum.output + (event.usage?.output_tokens ?? 0) }), { input: 0, cached: 0, output: 0 });
    const usd = ((usage.input - usage.cached) * PRICE_PER_MTOK.input + usage.cached * PRICE_PER_MTOK.cachedInput + usage.output * PRICE_PER_MTOK.output) / 1_000_000;
    const finished = events.some((event) => event.type === 'turn.completed');
    return { claimedDone: finished, turns: trace.length, usd, trace, ...(code === 142 ? { error: 'time limit' } : finished ? {} : { error: out.slice(-300) }) };
  },
};
