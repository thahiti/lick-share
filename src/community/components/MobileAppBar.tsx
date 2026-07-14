/**
 * 모바일 상단 앱 바 (<1024px 전용, CSS가 전환) — 로고 + 돋보기 + 아바타.
 * 내비 이동은 하단 TabBar가 담당한다 (unified-nav-share 설계).
 * 돋보기 탭 → 전체 화면 검색 오버레이 (tag-search 설계 §3 — 모바일은 앵커
 * 팝오버 대신 화면을 채우는 제안 목록).
 */
import { useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '../../ui/components/common/Icon';
import { navigate } from '../routing';
import { AvatarMenu } from './AvatarMenu';
import { SearchBox } from './SearchBox';

interface Props {
  readonly user: User | null;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

export const MobileAppBar = ({ user, onSignIn, onSignOut }: Props): JSX.Element => {
  const [searching, setSearching] = useState(false);
  return (
    <header className="c-mappbar">
      <a
        className="c-brand"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
      >
        <Icon name="note" color="var(--brand-primary)" size={20} />
        <span>Lick Share</span>
      </a>
      <button
        type="button"
        className="c-msearch-btn"
        aria-label="Search"
        onClick={() => setSearching(true)}
      >
        <Icon name="search" color="var(--mut2)" size={18} />
      </button>
      <AvatarMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
      {searching && (
        <div className="c-msearch" role="dialog" aria-label="Search">
          <div className="c-msearch-bar">
            <SearchBox autoFocus onNavigated={() => setSearching(false)} />
            <button type="button" className="c-msearch-cancel" onClick={() => setSearching(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
