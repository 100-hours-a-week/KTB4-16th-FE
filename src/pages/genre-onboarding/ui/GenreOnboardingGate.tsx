import { useEffect, useState, type PropsWithChildren } from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import type { UserProfile } from '../../../entities/user/model/user.types';
import { hasRequiredPreferredGenres } from '../../../features/genre-onboarding/model/genreOnboardingPolicy';
import { GenreOnboardingSheet } from '../../../features/genre-onboarding/ui/GenreOnboardingSheet';
import { getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import './genreOnboardingGate.css';

type ProfileState =
  | { accessToken: string; retryKey: number; status: 'error' }
  | { accessToken: string; retryKey: number; status: 'ready'; profile: UserProfile };

/** 로그인된 모든 경로에서 선호 장르 확인이 끝날 때까지 서비스 화면을 감춘다. */
export function GenreOnboardingGate({ children }: PropsWithChildren) {
  const { accessToken, fetchAuthenticatedJson, isAuthenticated, isSessionRestoring } = useSession();
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (isSessionRestoring) return;
    if (!isAuthenticated || !accessToken) return;

    let isCurrent = true;
    void getMyProfile(fetchAuthenticatedJson)
      .then((profile) => {
        if (isCurrent) setProfileState({ accessToken, retryKey, status: 'ready', profile });
      })
      .catch(() => {
        if (isCurrent) setProfileState({ accessToken, retryKey, status: 'error' });
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, fetchAuthenticatedJson, isAuthenticated, isSessionRestoring, retryKey]);

  if (isSessionRestoring) {
    return <div className="genre-onboarding-gate-status" role="status" aria-label="세션 확인 중" />;
  }

  if (!isAuthenticated || !accessToken) return children;

  if (
    !profileState ||
    profileState.accessToken !== accessToken ||
    profileState.retryKey !== retryKey
  ) {
    return (
      <div className="genre-onboarding-gate-status" role="status" aria-label="선호 장르 확인 중" />
    );
  }

  if (profileState.status === 'error') {
    return (
      <main className="genre-onboarding-gate-error">
        <p role="alert">선호 장르 정보를 확인하지 못했어요.</p>
        <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
          다시 시도
        </button>
      </main>
    );
  }

  if (hasRequiredPreferredGenres(profileState.profile)) return children;

  return (
    <GenreOnboardingSheet
      request={fetchAuthenticatedJson}
      onSaved={(preferredGenres) => {
        setProfileState({
          accessToken,
          retryKey,
          status: 'ready',
          profile: { ...profileState.profile, preferredGenres, genreOnboardingDone: true },
        });
      }}
    />
  );
}
