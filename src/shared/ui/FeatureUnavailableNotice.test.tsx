import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { FeatureUnavailableNotice } from './FeatureUnavailableNotice';

describe('FeatureUnavailableNotice', () => {
  it('구현 예정 상태와 홈 복귀 경로를 함께 안내한다', () => {
    render(
      <MemoryRouter>
        <FeatureUnavailableNotice
          description="기억 검색 기능은 V1 이후 구현할 예정이에요."
          title="AI 기억 검색"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'AI 기억 검색' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('구현 예정 기능입니다.');
    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
  });
});
