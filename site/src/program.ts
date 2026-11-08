import type { UrlRequest } from 'foldkit/navigation';
import type { Url } from 'foldkit/url';
import { Message } from './message.ts';
import { Model } from './model.ts';
import { init, update } from './update.ts';
import { view } from './view.ts';

export const routing = {
  onUrlRequest: (request: UrlRequest) => Message.RequestedUrl({ request }),
  onUrlChange: (url: Url) => Message.ChangedUrl({ url }),
};

export const program = { Model, init, update, view, routing } as const;
