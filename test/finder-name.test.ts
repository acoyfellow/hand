import { describe, expect, test } from 'bun:test';
import { isFinderFileName } from '../src/devices/macos.ts';

describe('Finder file names', () => {
  test('a name field inside the file list is a file name', () => {
    expect(isFinderFileName('Finder', { role: 'textbox', name: 'draft.txt', path: '0.0.2.0.0.1.0.1' })).toBe(true);
  });

  test('the toolbar search field is not a file name', () => {
    expect(isFinderFileName('Finder', { role: 'textbox', name: 'Search', path: '0.1.4.0' })).toBe(false);
  });

  test('an empty field is not a file name', () => {
    expect(isFinderFileName('Finder', { role: 'textbox', name: '', path: '0.0.2.0.0.1.0.1' })).toBe(false);
  });

  test('other apps are never treated as Finder', () => {
    expect(isFinderFileName('TextEdit', { role: 'textbox', name: 'draft.txt', path: '0.0.2.0.0.1.0.1' })).toBe(false);
  });
});
