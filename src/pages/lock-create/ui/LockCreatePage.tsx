import { useState } from 'react';
import { useNavigate } from 'react-router';

import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { RecordCreateForm } from '../../../features/record-create/ui/RecordCreateForm';
import { HomeWeather } from '../../../features/home-weather/ui/HomeWeather';
import '../../pageShell.css';
import './lockCreatePage.css';

/** 자물쇠 작성 화면을 조립하고 생성 완료 후 홈으로 이동한다. */
export function LockCreatePage() {
  const navigate = useNavigate();
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );

  return (
    <main className="static-page">
      <div className="static-page-content lock-create-content">
        <header className="lock-create-header">
          <button
            aria-label="이전 화면으로 돌아가기"
            className="lock-create-back"
            type="button"
            onClick={() => navigate(-1)}
          >
            ‹
          </button>
          <h1 className="static-page-title">자물쇠 만들기</h1>
          <span aria-hidden="true" className="lock-create-header-spacer" />
        </header>
        <RecordCreateForm
          onCoordinatesChange={setCoordinates}
          onCreated={() => navigate('/', { replace: true })}
          weather={<HomeWeather coordinates={coordinates} />}
        />
      </div>
      <MainNavigation activeItem="dashboard" />
    </main>
  );
}
