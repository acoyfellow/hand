import { describe, expect, test } from 'bun:test';
import type { Transport } from '../src/clef.ts';
import { type Device, Hand } from '../src/hand.ts';
import type { Candidate } from '../src/perceive.ts';

const body: Candidate = { id: 'e1', role: 'textbox', name: 'Note body', backendNodeId: 0, x: 0, y: 0, w: 100, h: 100 };

const noteDevice = (withInsert: boolean) => {
  const calls: string[] = [];
  const device: Device = {
    viewport: () => ({ width: 100, height: 100 }),
    screenshot: async () => 'data:image/jpeg;base64,',
    marked: async () => 'data:image/jpeg;base64,',
    gridShot: async () => ({ img: '', cells: {} }),
    candidates: async () => [body],
    click: async () => {},
    typeInto: async (_, text) => {
      calls.push(`replace:${text}`);
    },
    ...(withInsert
      ? {
          insertAtCursor: async (_: Candidate, text: string) => {
            calls.push(`insert:${text}`);
          },
        }
      : {}),
    setValue: async () => true,
    settle: async () => {},
  };
  return { device, calls };
};

const noModel = (() => {
  throw new Error('a reference to an outlined control needs no model call');
}) as unknown as Transport;

const handOn = (device: Device) => new Hand(noModel, device, { model: 'clef', method: 'ax_text', tau: 0.5, riskTau: 0.5, injectionTau: 0.5, verify: false });

describe('type modes', () => {
  test('replace is the default and replaces the field', async () => {
    const note = noteDevice(true);
    const hand = handOn(note.device);
    await hand.outline();
    expect(await hand.type('Todo', 'e1')).toStartWith('Typed into');
    expect(note.calls).toEqual(['replace:Todo']);
  });

  test('insert types at the cursor and keeps the rest of the field', async () => {
    const note = noteDevice(true);
    const hand = handOn(note.device);
    await hand.outline();
    expect(await hand.type(' — 14°C', 'e1', 'insert')).toStartWith('Inserted at the cursor in');
    expect(note.calls).toEqual(['insert: — 14°C']);
  });

  test('insert is refused, not silently replaced, on a device that cannot do it', async () => {
    const note = noteDevice(false);
    const hand = handOn(note.device);
    await hand.outline();
    expect(await hand.type(' — 14°C', 'e1', 'insert')).toContain('cannot type at the cursor');
    expect(note.calls).toEqual([]);
  });
});
