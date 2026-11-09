import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateDisplayName } from './profiles';

// 체이닝 질의 빌더 mock — 메서드 호출을 기록하고 await 시 미리 정한 결과를 돌려준다
const calls: Array<[string, unknown[]]> = [];
let result: { data: unknown; error: { code: string; message: string } | null };

vi.mock('../supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const m of ['update', 'eq', 'select']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder['then'] = (resolve: (v: unknown) => void) => resolve(result);
  return {
    supabase: {
      from: (table: string) => {
        calls.push(['from', [table]]);
        return builder;
      },
    },
  };
});

beforeEach(() => {
  calls.length = 0;
  result = { data: [{ id: 'user-1' }], error: null };
});

describe('updateDisplayName', () => {
  it('본인 행의 display_name만 갱신하고 ok를 돌려준다', async () => {
    const r = await updateDisplayName('user-1', 'New Name');
    expect(r).toEqual({ ok: true });
    expect(calls).toContainEqual(['from', ['profiles']]);
    expect(calls).toContainEqual(['update', [{ display_name: 'New Name' }]]);
    expect(calls).toContainEqual(['eq', ['id', 'user-1']]);
  });

  it('unique 위반(23505)은 taken', async () => {
    result = { data: null, error: { code: '23505', message: 'duplicate key' } };
    expect(await updateDisplayName('user-1', 'Dup')).toEqual({ ok: false, reason: 'taken' });
  });

  it('그 밖의 DB 오류는 메시지와 함께 error', async () => {
    result = { data: null, error: { code: '23514', message: 'check violation' } };
    expect(await updateDisplayName('user-1', '')).toEqual({
      ok: false,
      reason: 'error',
      message: 'check violation',
    });
  });

  it('RLS가 걸러 바뀐 행이 없으면 조용히 성공하지 않고 error', async () => {
    result = { data: [], error: null };
    const r = await updateDisplayName('someone-else', 'X');
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ reason: 'error' });
  });
});
