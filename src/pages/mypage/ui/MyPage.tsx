import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import type { UserProfile } from '../../../entities/user/model/user.types';
import { getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { useSession } from '../../../entities/session/model/useSession';
import '../../pageShell.css';
import './myPage.css';

const accountMenus = [
  { label: '닉네임 변경', to: '/mypage/nickname' },
  { label: '비밀번호 변경', to: '/mypage/password' },
] as const;
const accountActions = ['로그아웃', '회원탈퇴'];

/** route state에서 마이페이지에 표시할 안전한 완료 안내만 추출한다. */
function getProfileMessage(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('profileMessage' in state)) {
    return null;
  }

  return typeof state.profileMessage === 'string' ? state.profileMessage : null;
}

/** 현재 사용자 정보를 조회하고 계정 메뉴를 조립한다. */
export function MyPage() {
  const { fetchAuthenticatedJson } = useSession();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const profileMessage = getProfileMessage(location.state);

  /** 프로필 요청을 시작할 때 이전 데이터를 비우고 성공·실패 상태를 갱신한다. */
  const loadProfile = useCallback(async () => {
    setProfile(null);
    setErrorMessage(null);
    setIsLoading(true);

    try {
      setProfile(await getMyProfile(fetchAuthenticatedJson));
    } catch {
      setErrorMessage('내 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchAuthenticatedJson]);

  useEffect(() => {
    let isCurrent = true;

    /** 최초 진입에서 응답을 받은 뒤에만 현재 화면 상태를 갱신한다. */
    const loadInitialProfile = async () => {
      try {
        const nextProfile = await getMyProfile(fetchAuthenticatedJson);
        if (isCurrent) {
          setProfile(nextProfile);
        }
      } catch {
        if (isCurrent) {
          setErrorMessage('내 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialProfile();

    return () => {
      isCurrent = false;
    };
  }, [fetchAuthenticatedJson]);

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">마이페이지</h1>
        </header>
        {profileMessage ? <p role="status">{profileMessage}</p> : null}
        <section className="surface-card my-profile" aria-live="polite">
          {isLoading ? <p role="status">내 정보를 불러오는 중이에요.</p> : null}
          {errorMessage ? (
            <div className="my-profile-error">
              <p role="alert">{errorMessage}</p>
              <button type="button" onClick={() => void loadProfile()}>
                다시 시도
              </button>
            </div>
          ) : null}
          {profile ? (
            <>
              <div>{profile.nickname.slice(0, 1)}</div>
              <strong>{profile.nickname}</strong>
              <small>{profile.email}</small>
            </>
          ) : null}
        </section>
        <MenuGroup items={accountMenus} />
        <MenuGroup items={accountActions} danger />
      </div>
      <MainNavigation />
    </main>
  );
}

type AccountMenuItem = (typeof accountMenus)[number];

/** 계정 변경 경로와 아직 제공하지 않는 계정 동작을 구분해 표시한다. */
function MenuGroup({
  danger = false,
  items,
}: {
  danger?: boolean;
  items: readonly AccountMenuItem[] | readonly string[];
}) {
  return (
    <section className="surface-card my-menu-group">
      {items.map((item) => (
        <MenuItem danger={danger} item={item} key={typeof item === 'string' ? item : item.to} />
      ))}
    </section>
  );
}

/** 메뉴 항목이 실제 경로인지 구현 예정 동작인지에 맞는 제어 요소를 렌더링한다. */
function MenuItem({ danger, item }: { danger: boolean; item: AccountMenuItem | string }) {
  if (typeof item !== 'string') {
    return (
      <Link to={item.to}>
        <span>{item.label}</span>
        <span aria-hidden="true">›</span>
      </Link>
    );
  }

  return (
    <button
      aria-label={`${item} 구현 예정`}
      className={danger && item === '회원탈퇴' ? 'is-danger' : ''}
      disabled
      type="button"
    >
      <span>{item}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}
