import { Effect } from 'effect';
import { Rendered, renderToString } from 'foldkit/experimental/server';
import { PAGE_PATHS, pageAt } from './pages.ts';
import { program } from './program.ts';

export const renderPage = (request: Request) => {
  const pathname = new URL(request.url).pathname;
  const status = pageAt(pathname) === undefined && pathname !== PAGE_PATHS.notFound ? 404 : 200;
  return Effect.runPromise(renderToString(program, { url: request.url })).then((application) => Rendered(application, status === 404 ? { status } : {}));
};
