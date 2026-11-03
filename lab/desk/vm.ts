import { homedir } from 'node:os';
import { join } from 'node:path';

const KEY_DIR = join(homedir(), '.do', 'vm', 'sandbox-1');

export interface Vm {
  readonly host: string;
  readonly run: (command: string) => Promise<string>;
  readonly status: (command: string) => Promise<number>;
}

const sshArgs = (host: string, command: string) => [
  'ssh',
  '-i',
  join(KEY_DIR, 'id_ed25519'),
  '-o',
  `UserKnownHostsFile=${join(KEY_DIR, 'known_hosts')}`,
  '-o',
  'BatchMode=yes',
  '-o',
  'ConnectTimeout=8',
  `ax@${host}`,
  `export PATH=$HOME/.bun/bin:/usr/local/bin:$PATH; ${command}`,
];

export const vm = (host: string): Vm => ({
  host,
  run: async (command) => {
    const child = Bun.spawn(sshArgs(host, command), { stdout: 'pipe', stderr: 'pipe' });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`vm command failed (${code}): ${command.slice(0, 120)}\n${err.slice(0, 400)}`);
    return out;
  },
  status: async (command) => {
    const child = Bun.spawn(sshArgs(host, command), { stdout: 'ignore', stderr: 'ignore' });
    return child.exited;
  },
});
