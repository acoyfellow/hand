import { describe, expect, test } from 'bun:test';
import { describeChange } from '../src/hand.ts';
import type { Candidate } from '../src/perceive.ts';

const control = (id: string, name: string): Candidate => ({ id, role: 'button', name, backendNodeId: 0, x: 0, y: 0, w: 10, h: 10 });

describe('describeChange', () => {
  test('reports new screen text, new controls and gone controls', () => {
    const change = describeChange(
      [control('e1', 'Archive'), control('e2', 'Star')],
      [control('e1', 'Star'), control('e2', 'Undo')],
      'Inbox',
      'Inbox\nArchived 1 email',
    );
    expect(change).toBe('new text: "Archived 1 email"; new controls: button "Undo"; gone: button "Archive".');
  });

  test('returns nothing when the screen did not change', () => {
    expect(describeChange([control('e1', 'Archive')], [control('e1', 'Archive')], 'Inbox', 'Inbox')).toBe('');
  });
});
