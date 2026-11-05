import { Effect } from 'effect';
import { Rendered, renderToString } from 'foldkit/experimental/server';
import { PAGE_PATHS, pageAt } from './pages.ts';
import { program } from './program.ts';

const PRERENDERED_NOT_FOUND = PAGE_PATHS.notFound;

export const renderPage = (request: Request) => {
  const pathname = new URL(request.url).pathname;
  const page = pageAt(pathname) ?? 'notFound';
  const status = page === 'notFound' && pathname !== PRERENDERED_NOT_FOUND ? 404 : 200;
  return Effect.runPromise(renderToString(program, { flags: { page } })).then((application) => Rendered(application, status === 404 ? { status } : {}));
};
