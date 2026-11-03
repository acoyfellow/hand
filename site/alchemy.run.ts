import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Config from 'effect/Config';
import * as Effect from 'effect/Effect';

const PRODUCTION_STAGE = 'prod';

export default Alchemy.Stack(
  'hand-site',
  { providers: Cloudflare.providers(), state: Alchemy.localState() },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const domain = yield* Config.String('HAND_SITE_DOMAIN').pipe(Config.withDefault('hand.coey.dev'));

    const site = yield* Cloudflare.Worker('hand-site', {
      name: 'hand-site',
      assets: {
        directory: './dist/client',
        htmlHandling: 'auto-trailing-slash',
        notFoundHandling: '404-page',
      },
      workersDev: stage !== PRODUCTION_STAGE,
      ...(stage === PRODUCTION_STAGE ? { domain } : {}),
    });

    return { url: site.url, worker: site.workerName };
  }),
);
