/** 서버 전송 실패에서 화면에 노출해도 되는 안전한 사용자 안내를 전달한다. */
export class ChatSendFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatSendFailure';
  }
}
