import { Hook } from '@/decorators/hook';
import type { ExtendedWebSocket } from '@/websocket-server';

export type WebSocketClientMessageHandler = (buffer: ArrayBuffer) => void;
export type WebSocketClientCloseHandler = () => void;

export class WebSocketClient {
  @Hook public onMessage?: WebSocketClientMessageHandler;
  @Hook public onClose?: WebSocketClientCloseHandler;

  public get ip(): string {
    return this.socket.ip;
  }

  public get url(): string {
    return this.socket.url;
  }

  constructor(private readonly socket: ExtendedWebSocket) {
    this.socket.onMessage = (buffer) => this.onMessage?.(buffer);
    this.socket.onClose = () => this.onClose?.();
  }

  public getHeader(key: string): string | undefined {
    return this.socket.headers.get(key);
  }

  public send(buffer: Uint8Array): void {
    this.socket.send(buffer, true, false);
  }

  public closeGracefully(code: number): void {
    try {
      this.socket.end(code);
    } catch (err) {
      // ignore - nothing to do here really as the socket is already closed
    }
  }

  public closeAbruptly(): void {
    try {
      this.socket.close();
    } catch (err) {
      // ignore - nothing to do here really as the socket is already closed
    }
  }
}
