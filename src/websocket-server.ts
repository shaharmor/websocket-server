import {
  App,
  TemplatedApp,
  us_listen_socket,
  us_listen_socket_close,
  us_socket_local_port,
  WebSocket,
} from 'uWebSockets.js';
import { Hook } from '@/decorators/hook';
import { WebSocketClient } from '@/websocket-client';

type WebSocketServerAuthCallback<ClientData> = (allowed: boolean, userData?: ClientData) => void;
type WebSocketServerAuthHandler<ClientData> = (
  data: WebSocketServerAuthData,
  callback: WebSocketServerAuthCallback<ClientData>
) => void;
type WebSocketServerConnectionHandler = (ws: WebSocketClient) => void;
type WebSocketServerCloseHandler = () => void;
type WebSocketMessageHandler = (buffer: ArrayBuffer) => void;
type WebSocketCloseHandler = () => void;

export interface WebSocketServerAuthData {
  url: string;
  ip: string;
  headers: Map<string, string>;
}

export interface ExtendedWebSocket extends WebSocket {
  onMessage?: WebSocketMessageHandler;
  onClose?: WebSocketCloseHandler;
  url: string;
  ip: string;
  headers: Map<string, string>;
}

export class WebSocketServer<ClientData extends Record<string, unknown> = Record<string, unknown>> {
  @Hook public onAuth?: WebSocketServerAuthHandler<ClientData>;
  @Hook public onConnection?: WebSocketServerConnectionHandler;
  @Hook public onClose?: WebSocketServerCloseHandler;
  private readonly app: TemplatedApp;
  private listenSocket?: us_listen_socket;

  public get port(): number {
    if (this.listenSocket) {
      return us_socket_local_port(this.listenSocket);
    }
    return 0;
  }

  constructor() {
    this.app = App().ws('/*', {
      upgrade: (res, req, context) => {
        const path = req.getUrl();
        const query = req.getQuery();
        const host = req.getHeader('host');
        const url = `ws://${host}${path}${query ? `?${query}` : ''}`;

        // save WebSocket specific headers for future use, as they won't be available after this event loop
        const secWebSocketKey = req.getHeader('sec-websocket-key');
        const secWebSocketProtocol = req.getHeader('sec-websocket-protocol');
        const secWebSocketExtensions = req.getHeader('sec-websocket-extensions');
        const headers = new Map();
        req.forEach((key, value) => headers.set(key, value));
        const ip = Buffer.from(res.getRemoteAddressAsText()).toString();

        if (!this.onAuth) {
          res.upgrade({ url, ip, headers }, secWebSocketKey, secWebSocketProtocol, secWebSocketExtensions, context);
          return;
        }

        // listen to client side abort
        let clientAborted = false;
        res.onAborted(() => (clientAborted = true)); // eslint-disable-line no-return-assign

        this.onAuth({ url, ip, headers }, (allowed, extraClientData) => {
          if (clientAborted) {
            return;
          }

          if (!allowed) {
            res.close();
            return;
          }
          setImmediate(() =>
            res.upgrade(
              { ...extraClientData, url, ip, headers },
              secWebSocketKey,
              secWebSocketProtocol,
              secWebSocketExtensions,
              context
            )
          );
        });
      },
      open: (ws) => this.onConnection?.(new WebSocketClient(ws as ExtendedWebSocket)),
      message: (ws, message) => (ws as ExtendedWebSocket).onMessage?.(message),
      close: (ws) => (ws as ExtendedWebSocket).onClose?.(),
    });
  }

  public async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.listen(port, (listenSocket: us_listen_socket) => {
        if (!listenSocket) {
          reject(new Error(`Failed to listen on port ${port}`));
          return;
        }
        this.listenSocket = listenSocket;
        resolve();
      });
    });
  }

  public stop(): void {
    if (this.listenSocket) {
      us_listen_socket_close(this.listenSocket);
      this.listenSocket = undefined;
    }
  }
}
