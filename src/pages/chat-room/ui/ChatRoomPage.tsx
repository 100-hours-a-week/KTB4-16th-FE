import { Link } from 'react-router';

import {
  ChatRoomContent,
  type ChatConnectionState,
  type ChatRoomLoadState,
  type ChatRoomStatus,
} from '../../../features/chat-room/ui/ChatRoomContent';
import './chatRoomPage.css';

const defaultLoadState: ChatRoomLoadState = 'ready';
const defaultConnectionState: ChatConnectionState = 'connecting';
const defaultRoomStatus: ChatRoomStatus = 'active';

/** 메시지 API가 연결되기 전의 채팅방 입력 UI를 제공한다. */
export function ChatRoomPage() {
  return (
    <main className="chat-room-page">
      <header className="chat-room-header">
        <Link aria-label="취향 투표로 돌아가기" className="chat-room-back-button" to="/matching">
          ‹
        </Link>
        <div className="chat-room-title">
          <div>
            <h1>채팅방</h1>
            <p>메시지 기능 준비 중</p>
          </div>
        </div>
        <span aria-hidden="true" className="chat-room-menu">
          ⋮
        </span>
      </header>

      <ChatRoomContent
        connectionState={defaultConnectionState}
        loadState={defaultLoadState}
        messages={[]}
        roomStatus={defaultRoomStatus}
      />
    </main>
  );
}
