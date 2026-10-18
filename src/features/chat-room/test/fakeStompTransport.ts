/** 실제 StompJS가 보낸 프레임을 관찰하고 외부 WebSocket 사건만 제어한다. */
export class FakeStompSocket {
  static connections: FakeStompSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  binaryType = 'arraybuffer';
  sentFrames: string[] = [];
  autoReceipt = true;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeStompSocket.connections.push(this);
  }

  /** 외부 연결 완료를 전달해 라이브러리가 실제 CONNECT를 보내게 한다. */
  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  /** 테스트 서버 프레임을 라이브러리의 실제 파서에 전달한다. */
  receive(frame: string) {
    this.onmessage?.(new MessageEvent('message', { data: frame }));
  }

  /** 연결과 인증 성공을 구별할 수 있도록 서버 응답을 따로 제공한다. */
  connected() {
    this.receive('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\u0000');
  }

  /** 클라이언트 프레임을 기록하고 정상 종료의 서버 영수증만 모사한다. */
  send(data: string | ArrayBuffer) {
    const frame = typeof data === 'string' ? data : new TextDecoder().decode(data);
    this.sentFrames.push(frame);
    if (frame.startsWith('DISCONNECT') && this.autoReceipt) {
      const receipt = frame.match(/\nreceipt:([^\n]+)/)?.[1];
      queueMicrotask(() => this.receive(`RECEIPT\nreceipt-id:${receipt}\n\n\u0000`));
    }
  }

  /** 클라이언트 종료 요청과 서버·네트워크 종료에 동일한 close 사건을 전달한다. */
  close(code = 1000) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close', { code }));
  }
}
