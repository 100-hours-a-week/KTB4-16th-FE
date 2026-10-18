import { useCallback, useEffect, useRef, useState } from 'react';

import { createChatConnection } from '../api/chatConnection';
import type { ChatConnection, ChatConnectionSnapshot } from './chatConnection.types';
import type { ChatDestination } from './chatConnection.types';

interface ChatConnectionHookOptions {
  enabled: boolean;
  sessionVersion: number;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<void>;
  onFrame?: (destination: ChatDestination, body: string) => void;
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
  onFrame,
}: ChatConnectionHookOptions) {
  const [connection, setConnection] = useState<ChatConnectionSnapshot>(idle);
  const current = useRef<ChatConnection | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const controller = createChatConnection({
      getAccessToken,
      refreshAccessToken,
      onFrame: (destination, body) => onFrame?.(destination, body),
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
  }, [enabled, sessionVersion, getAccessToken, refreshAccessToken, onFrame]);

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

  /** 연결 컨트롤러에 프레임 발행을 위임하며 연결 전 호출은 명시적으로 실패시킨다. */
  const publish = useCallback((destination: string, body: string) => {
    const controller = current.current;
    if (!controller) throw new Error('채팅 서버에 연결되어 있지 않습니다.');
    controller.publish(destination, body);
  }, []);

  return { connection: enabled ? connection : idle, retryConnection, publish };
}
