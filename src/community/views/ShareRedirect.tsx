/**
 * 단축 공유 라우트(/s/:id) — 메신저에는 짧은 URL을 주고, 열면 곡 blob을 담은
 * 자체 완결 열람 URL(/?mode=view#v2…)로 교체(replace)한다. blob은 항상 현재
 * 코덱으로 재인코딩해 구형 blob도 최신 형식 URL로 풀린다.
 */
import { useEffect, useState, type JSX } from 'react';
import { decodeSong, encodeSong } from '../../core/codec';
import { fetchLick } from '../api/licks';

interface Props {
  readonly id: string;
  /** 테스트 주입용 — 기본은 히스토리를 남기지 않는 location.replace */
  readonly redirect?: (url: string) => void;
}

type State = 'loading' | 'notfound' | 'unreadable';

export const ShareRedirect = ({
  id,
  redirect = (url) => window.location.replace(url),
}: Props): JSX.Element => {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let alive = true;
    void fetchLick(id).then((lick) => {
      if (!alive) return;
      if (!lick) {
        setState('notfound');
        return;
      }
      const song = decodeSong(lick.blob);
      if (!song) {
        setState('unreadable');
        return;
      }
      redirect(`/?mode=view#${encodeSong(song)}`);
    });
    return () => {
      alive = false;
    };
    // redirect는 기본값 인라인 함수 — 의존성에 넣으면 매 렌더 재실행되므로 id에만 반응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === 'notfound') return <p className="c-state">Lick not found</p>;
  if (state === 'unreadable') return <p className="c-state">Couldn&apos;t read this score</p>;
  return <p className="c-state">Opening score…</p>;
};
