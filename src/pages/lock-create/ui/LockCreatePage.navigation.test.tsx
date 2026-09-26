import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../../features/record-create/ui/RecordCreateForm', () => ({
  RecordCreateForm: ({ onCreated }: { onCreated: (recordId: number) => void }) => (
    <button type="button" onClick={() => onCreated(1356)}>
      생성 성공
    </button>
  ),
}));
vi.mock('../../../features/home-weather/ui/HomeWeather', () => ({
  HomeWeather: () => null,
}));
vi.mock('../../../features/main-navigation/ui/MainNavigation', () => ({
  MainNavigation: () => null,
}));

import { LockCreatePage } from './LockCreatePage';

beforeEach(() => vi.clearAllMocks());

describe('LockCreatePage creation navigation', () => {
  it('replaces the completed form with home without exposing the record ID', () => {
    render(<LockCreatePage />);

    fireEvent.click(screen.getByRole('button', { name: '생성 성공' }));

    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(screen.queryByText(/#1356/)).not.toBeInTheDocument();
  });
});
