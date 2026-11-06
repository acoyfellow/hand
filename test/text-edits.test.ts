import { describe, expect, test } from 'bun:test';
import type { Transport } from '../src/clef.ts';
import { type Device, type ElementState, editGuard, Hand, judge, type TextEditResult } from '../src/hand.ts';
import type { Candidate } from '../src/perceive.ts';

const body: Candidate = { id: 'e1', role: 'textbox', name: 'Note body', backendNodeId: 0, x: 0, y: 0, w: 100, h: 100 };
const box: Candidate = { id: 'e2', role: 'checkbox', name: 'Automatically hide and show the Dock', backendNodeId: 1, x: 0, y: 120, w: 20, h: 20 };

const noModel = (() => {
  throw new Error('an [id] target needs no model call');
}) as unknown as Transport;

const deviceWith = (extra: Partial<Device>, calls: string[] = []): Device => ({
  viewport: () => ({ width: 100, height: 100 }),
  screenshot: async () => {
    calls.push('screenshot');
    return 'data:image/jpeg;base64,';
  },
  marked: async () => 'data:image/jpeg;base64,',
  gridShot: async () => ({ img: '', cells: {} }),
  candidates: async () => [body, box],
  click: async () => {},
  typeInto: async () => {},
  setValue: async () => true,
  settle: async () => {},
  ...extra,
});

const handOn = (device: Device) => new Hand(noModel, device, { model: 'clef', method: 'ax_text', tau: 0.5, riskTau: 0.5, injectionTau: 0.5, verify: false });

describe('editGuard', () => {
  const before = 'Todo\nWeather in Lisbon\nPopulation of Portugal\n';

  test('accepts text added at the end of the anchor line only', () => {
    expect(editGuard(before, 'Todo\nWeather in Lisbon — 16°C\nPopulation of Portugal\n', 'Weather in Lisbon', ' — 16°C')).toBeUndefined();
  });

  test('accepts an anchor taken from the middle of its line', () => {
    expect(editGuard(before, 'Todo\nWeather in Lisbon — 16°C\nPopulation of Portugal\n', 'Weather', ' — 16°C')).toBeUndefined();
  });

  test('catches a whole note replaced by the answer', () => {
    expect(editGuard(before, ' — 11.4 million', 'Population of Portugal', ' — 11.4 million')).toContain('should read');
  });

  test('catches text landing on the wrong line', () => {
    expect(editGuard(before, 'Todo\nWeather in Lisbon\nPopulation of Portugal\n — 16\n', 'Weather in Lisbon', ' — 16')).toContain('should read');
  });

  test('reports an anchor that is not there', () => {
    expect(editGuard(before, before, 'Rain in Spain', 'x')).toContain('was not in the field');
  });
});

describe('judge', () => {
  const on: ElementState = { role: 'AXCheckBox', name: 'Dock', checked: true, enabled: true };

  test('satisfied when every wanted fact holds', () => {
    expect(judge(on, { checked: true, enabled: true }).verdict).toBe('satisfied');
  });

  test('unsatisfied names what is wrong', () => {
    const result = judge(on, { checked: false });
    expect(result.verdict).toBe('unsatisfied');
    expect(result.reasons[0]).toContain('wanted false');
  });

  test('unknown when the state cannot be read, never satisfied', () => {
    expect(judge({ role: 'AXGroup', name: 'x' }, { checked: true }).verdict).toBe('unknown');
  });

  test('contains looks inside the value', () => {
    expect(judge({ role: 'AXTextArea', name: 'body', value: 'Weather in Lisbon — 16°C' }, { contains: '16°C' }).verdict).toBe('satisfied');
  });
});

describe('hand tools on exact ids', () => {
  test('type after an anchor skips the model and the screenshot, and checks the edit', async () => {
    const calls: string[] = [];
    const device = deviceWith(
      {
        insertAfter: async (_c, anchor, text): Promise<TextEditResult> => {
          calls.push(`after:${anchor}:${text}`);
          return { ok: true, detail: 'ok', before: 'Todo\nWeather in Lisbon\n', after: `Todo\nWeather in Lisbon${text}\n` };
        },
      },
      calls,
    );
    const result = await handOn(device).typeAfter(' — 16°C', 'e1', 'Weather in Lisbon');
    expect(result).toContain('Checked: the rest of the field is unchanged');
    expect(calls).toEqual(['after:Weather in Lisbon: — 16°C']);
  });

  test('type after reports a wrecked field instead of claiming success', async () => {
    const device = deviceWith({
      insertAfter: async (): Promise<TextEditResult> => ({ ok: true, detail: 'ok', before: 'Todo\nWeather in Lisbon\n', after: ' — 16°C' }),
    });
    expect(await handOn(device).typeAfter(' — 16°C', 'e1', 'Weather in Lisbon')).toStartWith('EDIT FAILED');
  });

  test('check passes the wanted state to the device and reports its read-back', async () => {
    const wanted: boolean[] = [];
    const device = deviceWith({
      setChecked: async (_c, on) => {
        wanted.push(on);
        return { ok: true, detail: 'already on; did nothing' };
      },
    });
    const result = await handOn(device).setChecked('e2', true);
    expect(wanted).toEqual([true]);
    expect(result).toContain('already on; did nothing');
  });

  test('expect reads real state through the device', async () => {
    const device = deviceWith({ state: async () => ({ role: 'AXCheckBox', name: 'Dock', checked: false }) });
    expect(await handOn(device).expect('e2', { checked: true })).toStartWith('unsatisfied');
  });
});
