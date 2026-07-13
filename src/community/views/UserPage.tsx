/**
 * 유저 페이지 (설계 §8.3). public_id로 프로필을 조회해 헤더(아바타·이름) + 해당 유저의
 * 피드(Feed 재사용, authorId=profile.id)를 보여준다.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { Player } from '../../adapters/player';
import { fetchProfileByPublicId, type Profile } from '../api/profiles';
import { Feed } from './Feed';

interface Props {
  readonly publicId: string;
  readonly player: Player;
}

type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'notfound' }
  | { readonly kind: 'ready'; readonly profile: Profile };

const UserPageView = ({ publicId }: Props): JSX.Element => {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const started = useRef(false);
  const alive = useRef(true);

  /* 프로필 로드 — StrictMode 이중 이펙트에서도 fetchProfileByPublicId는 정확히 1회 (Feed와 동일 패턴) */
  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      void fetchProfileByPublicId(publicId).then((profile) => {
        if (!alive.current) return;
        setPhase(profile ? { kind: 'ready', profile } : { kind: 'notfound' });
      });
    }
    return () => {
      alive.current = false;
    };
  }, [publicId]);

  if (phase.kind === 'loading') return <p className="c-state">불러오는 중…</p>;
  if (phase.kind === 'notfound') return <p className="c-state">사용자를 찾을 수 없어요</p>;

  const { profile } = phase;
  return (
    <div className="c-list">
      <div className="c-row">
        {profile.avatar_url && <img src={profile.avatar_url} alt="" width={32} height={32} />}
        <div className="c-title">{profile.display_name}</div>
      </div>
      <Feed authorId={profile.id} />
    </div>
  );
};

/** publicId별로 완전히 새 인스턴스 (Feed·LickDetail과 동일한 key 리마운트 패턴) */
export const UserPage = (props: Props): JSX.Element => <UserPageView key={props.publicId} {...props} />;
