export const CHAT_DESTINATIONS = [
  '/user/queue/chat-messages',
  '/user/queue/chat-events',
  '/user/queue/chat-errors',
] as const;

export type ChatDestination = (typeof CHAT_DESTINATIONS)[number];
export type ChatConnectionState =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type ChatConnectionStopReason =
  'retry-exhausted' | 'authentication' | 'protocol' | 'temporary' | null;

export interface ChatConnectionSnapshot {
  state: ChatConnectionState;
  retryCount: number;
  stopReason: ChatConnectionStopReason;
  isOffline: boolean;
  isRefreshingToken: boolean;
}

export interface ChatConnectionOptions {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<void>;
  onStateChange: (snapshot: ChatConnectionSnapshot) => void;
  onFrame?: (destination: ChatDestination, body: string) => void;
}

export interface ChatConnection {
  start(): void;
  retry(): Promise<void>;
  stop(): Promise<void>;
  publish(destination: string, body: string): void;
}
