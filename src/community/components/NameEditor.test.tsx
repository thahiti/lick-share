/** 표시 이름 편집 — My licks 머리글. 보기 / 편집 두 상태, 유일성 판정은 onSave 결과로 받는다. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenameResult } from '../api/profiles';
import { NameEditor } from './NameEditor';

const onSave = vi.fn<(name: string) => Promise<RenameResult>>();

const startEditing = (name = 'Old Name') => {
  render(<NameEditor name={name} onSave={onSave} />);
  fireEvent.click(screen.getByText('Edit'));
  return screen.getByRole('textbox') as HTMLInputElement;
};

describe('NameEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue({ ok: true });
  });

  it('보기 상태: 이름과 Edit 버튼', () => {
    render(<NameEditor name="Old Name" onSave={onSave} />);
    expect(screen.getByText('Old Name')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Edit을 누르면 현재 이름이 채워진 입력창', () => {
    const input = startEditing();
    expect(input.value).toBe('Old Name');
    expect(input.maxLength).toBe(30);
  });

  it('비어 있거나 그대로면 Save 비활성', () => {
    const input = startEditing();
    const save = screen.getByText('Save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'New' } });
    expect(save.disabled).toBe(false);
  });

  it('Save는 앞뒤 공백을 지운 이름으로 onSave를 부르고 성공하면 편집을 닫는다', async () => {
    const input = startEditing();
    fireEvent.change(input, { target: { value: '  New Name  ' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('New Name');
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('이미 쓰는 이름이면 Already taken을 보여주고 편집을 유지한다', async () => {
    onSave.mockResolvedValue({ ok: false, reason: 'taken' });
    const input = startEditing();
    fireEvent.change(input, { target: { value: 'Dup' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Already taken')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('그 밖의 실패는 메시지를 보여준다', async () => {
    onSave.mockResolvedValue({ ok: false, reason: 'error', message: 'Not allowed' });
    const input = startEditing();
    fireEvent.change(input, { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Not allowed')).toBeTruthy();
  });

  it('Cancel은 저장하지 않고 편집을 닫는다', () => {
    const input = startEditing();
    fireEvent.change(input, { target: { value: 'Typed' } });
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Old Name')).toBeTruthy();
  });
});
