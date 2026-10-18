import { useCallback, useEffect, useRef, useState } from 'react';

import { createChatConnection } from '../api/chatConnection';
import type { ChatConnection, ChatConnectionSnapshot } from './chatConnection.types';

interface ChatConnectionHookOptions {
  enabled: boolean;
  sessionVersion: number;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<void>;
}

const idle: ChatConnectionSnapshot = {
  state: 'idle',
  retryCount: 0,
  stopReason: null,
  isOffline: false,
  isRefreshingToken: false,
};

/** 화면 수명과 로그인 교체에만 연결을 맞추고 일반 토큰 갱신에는 기존 연결을 유지한다. */
export function useChatConnection({
  enabled,
  sessionVersion,
  getAccessToken,
  refreshAccessToken,
}: ChatConnectionHookOptions) {
  const [connection, setConnection] = useState<ChatConnectionSnapshot>(idle);
  const current = useRef<ChatConnection | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const controller = createChatConnection({
      getAccessToken,
      refreshAccessToken,
      onStateChange: (snapshot) => {
        if (alive) setConnection(snapshot);
      },
    });
    current.current = controller;
    controller.start();
    return () => {
      alive = false;
      if (current.current === controller) current.current = null;
      void controller.stop().catch(() => undefined);
    };
  }, [enabled, sessionVersion, getAccessToken, refreshAccessToken]);

  /** 중단된 화면 연결을 재시작하고 이미 끝난 화면의 실패는 반영하지 않는다. */
  const retryConnection = useCallback(() => {
    const controller = current.current;
    void controller?.retry().catch(() => {
      if (current.current === controller) {
        setConnection((previous) => ({
          ...previous,
          state: 'disconnected',
          stopReason: 'temporary',
        }));
      }
    });
  }, []);

  return { connection: enabled ? connection : idle, retryConnection };
}
