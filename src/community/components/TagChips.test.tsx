/** TagChips — 태그 칩은 /tag/:name 링크 (tag-search 설계 §3). */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', async (orig) => ({
  ...(await orig<typeof import('../routing')>()),
  navigate: (p: string) => navigate(p),
}));

import { TagChips } from './TagChips';

beforeEach(() => {
  navigate.mockReset();
});

describe('TagChips', () => {
  it('빈 배열이면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<TagChips tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('칩은 /tag/:name 링크이고 클릭하면 SPA 이동한다', () => {
    render(<TagChips tags={['bebop']} />);
    const link = screen.getByRole('link', { name: '#bebop' });
    expect(link.getAttribute('href')).toBe('/tag/bebop');
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith('/tag/bebop');
  });

  it('URL에 안전하지 않은 태그는 인코딩한다', () => {
    render(<TagChips tags={['발라드']} />);
    const link = screen.getByRole('link', { name: '#발라드' });
    expect(link.getAttribute('href')).toBe('/tag/' + encodeURIComponent('발라드'));
  });
});
