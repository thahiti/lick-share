/** 내 릭 (설계 §8.4) — 표시 이름 머리글 + 로그인한 사용자의 피드(Feed 재사용, 삭제 가능). */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { fetchProfileById, updateDisplayName, type RenameResult } from '../api/profiles';
import { NameEditor } from '../components/NameEditor';
import { feedKey, feedStore } from '../feed-store';
import { Feed } from './Feed';

interface Props {
  readonly user: User | null;
  readonly player: Player;
}

const MyLicksView = ({ user, player }: { readonly user: User; readonly player: Player }): JSX.Element => {
  const [name, setName] = useState<string | null>(null);
  const [renames, setRenames] = useState(0);
  const started = useRef(false);
  const alive = useRef(true);

  /* 프로필 로드 — StrictMode 이중 이펙트에서도 fetchProfileById는 정확히 1회 (UserPage와 동일 패턴) */
  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      void fetchProfileById(user.id).then((profile) => {
        if (alive.current && profile) setName(profile.display_name);
      });
    }
    return () => {
      alive.current = false;
    };
  }, [user.id]);

  const save = async (next: string): Promise<RenameResult> => {
    const result = await updateDisplayName(user.id, next);
    if (result.ok) {
      setName(next);
      // 리마운트는 popstate 없이 일어나 lastNavKind 가 history 로 남아 있을 수 있다.
      // 옛 이름이 박힌 스냅샷이 복원되지 않게 먼저 비운다 (R12, E8)
      feedStore.invalidate(feedKey(user.id, undefined));
      setRenames((n) => n + 1);
    }
    return result;
  };

  return (
    <div className="c-list">
      {name !== null && <NameEditor name={name} onSave={save} />}
      {/* 카드의 작성자 이름은 피드 질의에 박혀 있어 이름을 바꾸면 피드를 다시 불러온다 */}
      <Feed key={renames} authorId={user.id} deletable player={player} user={user} />
    </div>
  );
};

/** 사용자별로 완전히 새 인스턴스 (UserPage와 동일한 key 리마운트 패턴) */
export const MyLicks = ({ user, player }: Props): JSX.Element =>
  user ? (
    <MyLicksView key={user.id} user={user} player={player} />
  ) : (
    <p className="c-state">Sign in required</p>
  );
