import type { Document } from 'foldkit/html';
import type { Model } from './model.ts';
import { PAGE_META } from './pages.ts';
import { brandMain } from './views/brand.ts';
import { brandLabMain } from './views/brand-lab.ts';
import { docsMain } from './views/docs.ts';
import { referenceMain } from './views/reference.ts';
import { homeMain } from './views/home.ts';
import type { Child, H } from './views/kit.ts';
import { labMain } from './views/lab.ts';
import { layout } from './views/layout.ts';
import { notFoundMain } from './views/not-found.ts';

const mainFor = (h: H, model: Model): readonly Child[] => {
  switch (model.page) {
    case 'home':
      return homeMain(h, model);
    case 'docs':
      return docsMain(h);
    case 'reference':
      return referenceMain(h);
    case 'lab':
      return labMain(h);
    case 'brand':
      return brandMain(h, model);
    case 'brandLab':
      return brandLabMain(h, model);
    case 'notFound':
      return notFoundMain(h);
  }
};

export const view = (model: Model, h: H): Document => {
  const meta = PAGE_META[model.page];
  return {
    title: meta.title,
    lang: 'en',
    ...(meta.canonical ? { canonical: meta.canonical } : {}),
    body: layout(h, model.page, mainFor(h, model)),
  };
};
