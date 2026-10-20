import { useEffect, useState } from 'react';

import type { FriendNotice } from '../../../features/friend/model/useFriends';

// 사용자가 확인할 시간을 주고 화면을 계속 가리지 않도록 완료 안내만 4초 뒤 닫는다.
const NOTICE_DURATION_MS = 4_000;

/** 완료 결과를 짧게 알리고 사용자가 안내를 조작하는 동안 자동 닫힘을 멈춘다. */
export function FriendToast({
  notice,
  onDismiss,
  onViewFriends,
}: {
  notice: FriendNotice;
  onDismiss: () => void;
  onViewFriends: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(onDismiss, NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [notice.id, hovered, focused, onDismiss]);

  return (
    <div
      className="friends-toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span className="friends-toast-check" aria-hidden="true">
        ✓
      </span>
      <p role="status">{notice.message}</p>
      {notice.showFriends ? (
        <button className="friends-toast-action" type="button" onClick={onViewFriends}>
          친구 보기
        </button>
      ) : null}
      <button
        aria-label="완료 안내 닫기"
        className="friends-toast-close"
        type="button"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
