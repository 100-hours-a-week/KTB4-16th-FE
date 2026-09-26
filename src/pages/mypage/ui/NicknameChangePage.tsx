import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { UserProfile } from '../../../entities/user/model/user.types';
import { useSession } from '../../../entities/session/model/useSession';
import { getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import { NicknameChangeForm } from '../../../features/user-profile/ui/NicknameChangeForm';
import '../../pageShell.css';
import './myPage.css';

/** 현재 프로필을 조회한 뒤 닉네임 변경 폼을 조립하는 보호 화면이다. */
export function NicknameChangePage() {
  const { fetchAuthenticatedJson } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** 폼 렌더링에 필요한 현재 프로필을 새로 조회한다. */
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

  /** 변경 완료 후 마이페이지가 최신 정보를 다시 조회하도록 이동한다. */
  const handleSuccess = () => {
    navigate('/mypage', {
      replace: true,
      state: { profileMessage: '닉네임이 변경되었습니다.' },
    });
  };

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <Link className="settings-back-link" to="/mypage">
            ‹ 마이페이지
          </Link>
          <h1 className="static-page-title">닉네임 변경</h1>
        </header>
        <section className="surface-card profile-change-card" aria-live="polite">
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
              <p className="profile-change-current">현재 닉네임: {profile.nickname}</p>
              <NicknameChangeForm
                currentNickname={profile.nickname}
                onSuccess={handleSuccess}
                request={fetchAuthenticatedJson}
              />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
