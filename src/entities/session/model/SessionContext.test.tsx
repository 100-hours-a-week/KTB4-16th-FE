import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

/** 세션 공개 인터페이스를 사용자 동작으로 관찰한다. */
function SessionProbe() {
  const { accessToken, isAuthenticated, setAccessToken, clearSession } = useSession();

  return (
    <>
      <output>
        {accessToken ?? 'empty'}:{String(isAuthenticated)}
      </output>
      <button type="button" onClick={() => setAccessToken('token')}>
        login
      </button>
      <button type="button" onClick={clearSession}>
        logout
      </button>
    </>
  );
}

describe('SessionProvider', () => {
  it('keeps token only for the provider lifetime without persistent storage', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    const view = render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(screen.getByText('empty:false')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'login' }));
    expect(screen.getByText('token:true')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'logout' }));
    expect(screen.getByText('empty:false')).toBeInTheDocument();

    view.unmount();
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    expect(screen.getByText('empty:false')).toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('reports a clear error when used outside its provider', () => {
    expect(() => render(<SessionProbe />)).toThrow('useSession은 SessionProvider 안에서 사용해야 합니다.');
  });
});
