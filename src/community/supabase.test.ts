/**
 * env 미설정 안전성 (SPEC: 편집기 라우트는 supabase 없이도 동작).
 * 임포트만으로 죽지 않고, 실제 사용 시에만 명확한 에러를 낸다.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

const clearEnv = (): void => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.resetModules();
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('supabase 클라이언트 — env 미설정 안전성', () => {
  test('임포트만으로는 죽지 않는다', async () => {
    clearEnv();
    await expect(import('./supabase')).resolves.toBeDefined();
  });

  test('실제 사용 시 명확한 에러', async () => {
    clearEnv();
    const { supabase } = await import('./supabase');
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_URL/);
  });

  test('isSupabaseConfigured가 env 유무를 반영', async () => {
    const m1 = await import('./supabase');
    expect(m1.isSupabaseConfigured()).toBe(true); // vitest 더미 env 존재
    clearEnv();
    const m2 = await import('./supabase');
    expect(m2.isSupabaseConfigured()).toBe(false);
  });

  test('env 설정 시 정상 동작 (auth 접근 가능)', async () => {
    vi.resetModules();
    const { supabase } = await import('./supabase');
    expect(supabase.auth).toBeDefined();
  });
});

describe('auth — env 미설정 시 비로그인으로 우아한 저하', () => {
  test('getSessionUser → null, onAuthChange → noop 해제 함수', async () => {
    clearEnv();
    const { getSessionUser, onAuthChange } = await import('./api/auth');
    await expect(getSessionUser()).resolves.toBeNull();
    const unsub = onAuthChange(() => {});
    expect(typeof unsub).toBe('function');
    expect(unsub).not.toThrow();
  });
});
