type Handler<E> = ((event: E) => void) | null;

/**
 * Stand-in for React Native's WebSocket, installed as the global one in
 * jest.setup.js. A socket stays CONNECTING until the test drives it with
 * open() / receive() / fail() / drop(). Every socket ever created is kept in
 * FakeWebSocket.instances (cleared with FakeWebSocket.reset()).
 */
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  static reset() {
    FakeWebSocket.instances = [];
  }

  /** The newest socket; throws when none was created. */
  static last(): FakeWebSocket {
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    if (!socket) {
      throw new Error('No WebSocket was created');
    }
    return socket;
  }

  /** Sockets the client has not closed (normally at most one). */
  static live(): FakeWebSocket[] {
    return FakeWebSocket.instances.filter(
      socket => socket.readyState !== FakeWebSocket.CLOSED,
    );
  }

  readyState = FakeWebSocket.CONNECTING;
  readonly headers: Record<string, string>;
  /** Frames the client sent. */
  readonly sent: string[] = [];
  /** The code/reason the client closed with, if it did. */
  closedWith: { code?: number; reason?: string } | null = null;

  onopen: Handler<void> = null;
  onmessage: Handler<{ data: unknown }> = null;
  onerror: Handler<{ message?: string }> = null;
  onclose: Handler<{ code?: number; reason?: string }> = null;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[] | null,
    options?: { headers?: Record<string, string> } | null,
  ) {
    this.headers = options?.headers ?? {};
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closedWith = { code, reason };
    this.readyState = FakeWebSocket.CLOSED;
  }

  // --- driven by tests (the "server" side) ---

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  /** A frame from the server; objects are sent as JSON. */
  receive(data: unknown) {
    this.onmessage?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
  }

  /** The connection failed like React Native reports it: error, then close 1006. */
  fail(reason = 'Socket is not connected') {
    this.readyState = FakeWebSocket.CLOSED;
    this.onerror?.({});
    this.onclose?.({ code: 1006, reason });
  }

  /** The handshake was refused with 401 (iOS wording). */
  reject401() {
    this.fail('Received bad response code from server: 401.');
  }

  /** The server closed an open connection. */
  drop(code = 1006, reason = '') {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}
