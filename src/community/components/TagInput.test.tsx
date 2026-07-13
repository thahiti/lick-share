/** 태그 칩 입력 — Enter/','로 커밋, ×·Backspace로 제거, 3개 상한 (publish-tags 설계 §5). */
import { useState, type JSX } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TagInput } from './TagInput';

/** 제어 컴포넌트 검증용 하네스 — 실제 사용처(Publish)와 동일하게 useState로 배선 */
const Harness = ({ initial = [] }: { initial?: string[] }): JSX.Element => {
  const [tags, setTags] = useState<string[]>(initial);
  return <TagInput value={tags} onChange={setTags} />;
};

const field = (): HTMLInputElement => screen.getByLabelText('Add tags') as HTMLInputElement;

const type = (text: string): void => {
  fireEvent.change(field(), { target: { value: text } });
};

const press = (key: string): void => {
  fireEvent.keyDown(field(), { key });
};

afterEach(cleanup);

describe('TagInput 태그 칩 입력', () => {
  it('Enter로 현재 입력을 정규화해 칩으로 커밋하고 필드를 비운다', () => {
    render(<Harness />);
    type('#Jazz Blues');
    press('Enter');
    expect(screen.getByText('#jazz-blues')).toBeTruthy();
    expect(field().value).toBe('');
  });

  it("','로도 커밋한다", () => {
    render(<Harness />);
    type('bebop');
    press(',');
    expect(screen.getByText('#bebop')).toBeTruthy();
  });

  it('스페이스로도 커밋한다', () => {
    render(<Harness />);
    type('bebop');
    press(' ');
    expect(screen.getByText('#bebop')).toBeTruthy();
    expect(field().value).toBe('');
  });

  it('빈 필드에서 스페이스는 칩을 만들지 않는다', () => {
    render(<Harness />);
    press(' ');
    expect(document.querySelector('.c-tag')).toBeNull();
  });

  it('정규화 결과가 null이면 칩을 추가하지 않는다', () => {
    render(<Harness />);
    type('!!!');
    press('Enter');
    expect(document.querySelector('.c-tag')).toBeNull();
  });

  it('이미 존재하는 태그는 무시한다 (대소문자 차이 포함)', () => {
    render(<Harness initial={['bebop']} />);
    type('Bebop');
    press('Enter');
    expect(screen.getAllByText('#bebop')).toHaveLength(1);
  });

  it('칩의 × 클릭으로 해당 칩을 제거한다', () => {
    render(<Harness initial={['jazz', 'blues']} />);
    fireEvent.click(screen.getByLabelText('Remove jazz'));
    expect(screen.queryByText('#jazz')).toBeNull();
    expect(screen.getByText('#blues')).toBeTruthy();
  });

  it('빈 입력 필드에서 Backspace는 마지막 칩을 제거한다', () => {
    render(<Harness initial={['jazz', 'blues']} />);
    press('Backspace');
    expect(screen.queryByText('#blues')).toBeNull();
    expect(screen.getByText('#jazz')).toBeTruthy();
  });

  it('입력이 남아 있으면 Backspace로 칩을 제거하지 않는다', () => {
    render(<Harness initial={['jazz']} />);
    type('b');
    press('Backspace');
    expect(screen.getByText('#jazz')).toBeTruthy();
  });

  it('칩이 3개면 입력 필드를 비활성화하고 안내 문구를 보여준다', () => {
    render(<Harness initial={['a', 'b', 'c']} />);
    expect(field().disabled).toBe(true);
    expect(screen.getByText('Up to 3 tags')).toBeTruthy();
  });

  it('필드 blur 시 입력 중이던 draft를 자동으로 칩 커밋한다 (유실 방지)', () => {
    render(<Harness />);
    type('ballad');
    fireEvent.blur(field());
    expect(screen.getByText('#ballad')).toBeTruthy();
    expect(field().value).toBe('');
  });

  it('제스처 힌트 문구를 상시 노출한다', () => {
    render(<Harness />);
    expect(screen.getByText(/space, enter, or comma/i)).toBeTruthy();
  });

  it('추천 태그 칩을 클릭하면 해당 태그가 추가된다', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add tag bebop' }));
    expect(screen.getByText('#bebop')).toBeTruthy();
  });

  it('이미 추가된 추천 태그 칩은 노출하지 않는다', () => {
    render(<Harness initial={['bebop']} />);
    expect(screen.queryByRole('button', { name: 'Add tag bebop' })).toBeNull();
  });

  it('칩이 3개(가득)면 추천 태그·힌트를 노출하지 않는다', () => {
    render(<Harness initial={['a', 'b', 'c']} />);
    expect(screen.queryByText(/space, enter, or comma/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add tag / })).toBeNull();
  });
});
