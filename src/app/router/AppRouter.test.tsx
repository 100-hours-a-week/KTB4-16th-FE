import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../entities/session/model/SessionProvider';
import { useSession } from '../../entities/session/model/useSession';
import { AppRouter } from './AppRouter';

/** 라우팅 테스트에서 실제 세션 공개 API를 통해 로그인 상태를 만든다. */
function SessionActivator() {
  const { setAccessToken } = useSession();

  return (
    <button type="button" onClick={() => setAccessToken('access-token')}>
      테스트 로그인
    </button>
  );
}

/** 실제 세션 Provider와 메모리 라우터로 지정한 URL을 렌더링한다. */
function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <SessionActivator />
        <AppRouter />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  it('shows home to an anonymous visitor', () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

  it('sends an unknown path to the public home page', () => {
    renderRoute('/unknown');

    expect(screen.getByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

  it.each(['/login', '/signup'])('sends an authenticated visitor from %s to home', async (path) => {
    const user = userEvent.setup();
    renderRoute(path);

    await user.click(screen.getByRole('button', { name: '테스트 로그인' }));

    expect(screen.getByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });
});
