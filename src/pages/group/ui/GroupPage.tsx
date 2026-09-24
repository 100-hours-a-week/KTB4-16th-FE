import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './groupPage.css';

const friends = [
  { name: '지수', initial: '지', locks: '자물쇠 18개' },
  { name: '민준', initial: '민', locks: '자물쇠 31개' },
] as const;

/** 목업의 친구 목록 화면을 실제 친구 기능 없이 정적 상태로 표시한다. */
export function GroupPage() {
  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">그룹</h1>
          <span className="static-page-chip">친구 3</span>
        </header>
        <button className="group-add-friend" type="button">
          + 닉네임으로 친구 추가하기
        </button>
        <div className="group-friend-list">
          {friends.map((friend) => (
            <button className="surface-card group-friend" key={friend.name} type="button">
              <span className="group-avatar">{friend.initial}</span>
              <span>
                <strong>{friend.name}</strong>
                <small>{friend.locks}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <MainNavigation />
    </main>
  );
}
