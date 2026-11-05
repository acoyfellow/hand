import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

const site = fileURLToPath(new URL('..', import.meta.url));

await $`bun lab/build.ts --offline`.cwd(fileURLToPath(new URL('../..', import.meta.url)));
await $`./node_modules/.bin/vite --port ${process.env.PORT ?? '8799'}`.cwd(site);
