/**
 * 아바타 드롭다운 — 계정 메뉴의 단일 정의처. AppBar(데스크톱)·MobileAppBar(모바일)가 공유한다.
 * 항목: (로그인) My licks · Sign out / (비로그인) Sign in with Google.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { navigate } from '../routing';

interface Props {
  readonly user: User | null;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

/** 표시 이름 → 이니셜 1글자 (없으면 '?') */
const initial = (user: User): string => {
  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? '';
  return name.trim().charAt(0).toUpperCase() || '?';
};

export const AvatarMenu = ({ user, onSignIn, onSignOut }: Props): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  /* 앱바는 화면이 바뀌어도 남아 있으므로 메뉴는 스스로 닫혀야 한다: 항목 선택 또는 메뉴 밖 누름 */
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (!wrap.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const choose = (action: () => void) => (): void => {
    setMenuOpen(false);
    action();
  };

  return (
    <div className="c-avatarwrap" ref={wrap}>
      <button
        type="button"
        className="c-avatar"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {user ? initial(user) : '?'}
      </button>
      {menuOpen && (
        <div className="c-avatarmenu" role="menu">
          {user ? (
            <>
              <button type="button" role="menuitem" onClick={choose(() => navigate('/me'))}>
                My licks
              </button>
              <button type="button" role="menuitem" onClick={choose(onSignOut)}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" role="menuitem" onClick={choose(onSignIn)}>
              Sign in with Google
            </button>
          )}
        </div>
      )}
    </div>
  );
};
