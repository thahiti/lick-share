import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('빈 앱 셸을 렌더한다', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.app')).not.toBeNull();
  });
});
