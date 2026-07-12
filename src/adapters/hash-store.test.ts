import { describe, expect, test } from 'vitest';
import { createMemoryHashStore } from './fakes/memory-hash-store';
import { createLocationHashStore } from './location-hash-store';

describe('MemoryHashStore', () => {
  test('write/read 왕복, 초기값 빈 문자열', () => {
    const store = createMemoryHashStore();
    expect(store.read()).toBe('');
    store.write('v1.abc');
    expect(store.read()).toBe('v1.abc');
  });
});

describe('LocationHashStore (jsdom)', () => {
  test('read: 앞의 # 제거', () => {
    const store = createLocationHashStore();
    window.location.hash = '#v1.xyz';
    expect(store.read()).toBe('v1.xyz');
  });

  test('write: 히스토리 오염 없이 해시 교체', () => {
    const store = createLocationHashStore();
    const len = window.history.length;
    store.write('v1.next');
    expect(window.location.hash).toBe('#v1.next');
    expect(window.history.length).toBe(len); // replaceState — push 없음
  });
});
