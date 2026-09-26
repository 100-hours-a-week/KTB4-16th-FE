import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { FeatureUnavailableNotice } from './FeatureUnavailableNotice';

describe('FeatureUnavailableNotice', () => {
  it('미구현 상태와 홈 복귀 경로를 함께 안내한다', () => {
    render(
      <MemoryRouter>
        <FeatureUnavailableNotice
          description="기억 검색 API는 V1에서 구현하지 않습니다."
          title="AI 기억 검색"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'AI 기억 검색' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('미구현 기능입니다.');
    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
  });
});
