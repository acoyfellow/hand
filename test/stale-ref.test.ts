import { describe, expect, test } from 'bun:test';
import type { Transport } from '../src/clef.ts';
import { type Device, Hand } from '../src/hand.ts';
import type { Candidate } from '../src/perceive.ts';

const control = (id: string, role: string, name: string): Candidate => ({ id, role, name, backendNodeId: 0, x: 0, y: 0, w: 10, h: 10 });

function deviceShowing(screens: Candidate[][]) {
  let shown = 0;
  const clicks: string[] = [];
  const device: Device = {
    viewport: () => ({ width: 100, height: 100 }),
    screenshot: async () => 'data:image/jpeg;base64,',
    marked: async () => 'data:image/jpeg;base64,',
    gridShot: async () => ({ img: '', cells: {} }),
    candidates: async () => screens[Math.min(shown, screens.length - 1)] as Candidate[],
    click: async () => {
      clicks.push('click');
    },
    typeInto: async () => {},
    setValue: async () => true,
    settle: async () => {},
  };
  return { device, clicks, advance: () => shown++ };
}

const noModel: Transport = {
  send: () => {
    throw new Error('a stale ref must be refused before any model call');
  },
} as unknown as Transport;

const handOn = (device: Device) => new Hand(noModel, device, { model: 'clef', method: 'ax_text', tau: 0.5, riskTau: 0.5, injectionTau: 0.5, verify: false });

describe('stale refs', () => {
  test('an id that now names a different control is refused, not clicked', async () => {
    const screen = deviceShowing([[control('e1', 'button', 'Archive')], [control('e1', 'button', 'Delete account')]]);
    const hand = handOn(screen.device);
    await hand.outline();
    screen.advance();
    const result = await hand.act('e1');
    expect(result).toStartWith('STALE_REF: [e1] was button "Archive" and is now button "Delete account"');
    expect(screen.clicks).toHaveLength(0);
  });

  test('an id that no longer exists is refused', async () => {
    const screen = deviceShowing([[control('e1', 'button', 'Archive'), control('e2', 'button', 'Star')], [control('e1', 'button', 'Archive')]]);
    const hand = handOn(screen.device);
    await hand.outline();
    screen.advance();
    expect(await hand.act('e2')).toStartWith('STALE_REF: [e2] was button "Star" and is gone');
    expect(screen.clicks).toHaveLength(0);
  });

  test('typing into a stale id is refused', async () => {
    const screen = deviceShowing([[control('e1', 'textbox', 'Name')], [control('e1', 'textbox', 'Password')]]);
    const hand = handOn(screen.device);
    await hand.outline();
    screen.advance();
    expect(await hand.type('hunter2', 'e1')).toStartWith('STALE_REF: [e1] was textbox "Name" and is now textbox "Password"');
  });
});

describe('text fields whose label is their own text', () => {
  test('an id stays valid after its own text changes, when the device gives a stable key', async () => {
    const before = { ...control('e1', 'textbox', 'Todo Weather in Lisbon'), ref: 'body-key' };
    const after = { ...control('e1', 'textbox', 'Todo Weather in Lisbon — 16°C'), ref: 'body-key' };
    const screen = deviceShowing([[before], [after]]);
    const hand = handOn(screen.device);
    await hand.outline();
    screen.advance();
    expect(await hand.type('x', 'e1')).not.toStartWith('STALE_REF');
  });

  test('a different stable key is still stale', async () => {
    const screen = deviceShowing([
      [{ ...control('e1', 'textbox', 'Name'), ref: 'a' } as Candidate],
      [{ ...control('e1', 'textbox', 'Password'), ref: 'b' } as Candidate],
    ]);
    const hand = handOn(screen.device);
    await hand.outline();
    screen.advance();
    expect(await hand.type('hunter2', 'e1')).toStartWith('STALE_REF');
  });
});
