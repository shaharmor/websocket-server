/* eslint-disable jest/expect-expect, jest/no-disabled-tests */

import WebSocket from 'ws';
import { WebSocketServer } from '@/websocket-server';

describe('websocket-server', () => {
  let ws1: WebSocket;
  let ws2: WebSocket;
  let server: WebSocketServer;
  let server2: WebSocketServer;
  beforeEach(async () => {
    server = new WebSocketServer();
    server2 = new WebSocketServer();
    await server.start(8080);
  });

  afterEach(() => {
    server.stop();
    server2.stop();
    try {
      ws1.close();
    } catch (err) {
      // ignore
    }
    try {
      ws2.close();
    } catch (err) {
      // ignore
    }
  });

  describe('props', () => {
    it('.url', () => {
      return new Promise<void>((resolve, reject) => {
        const url = `ws://localhost:${server.port}/some/path?key=value`;
        server.onConnection = (client) => {
          try {
            expect(client.url).toEqual(url);
            resolve();
          } catch (err) {
            reject(err);
          }
        };

        ws1 = new WebSocket(url);
      });
    });

    it.skip('.ip', () => {
      return new Promise<void>((resolve, reject) => {
        server.onConnection = (client) => {
          try {
            // TODO: handle the case of IPv6
            expect(client.ip).toMatch(/\d+\.\d+\.\d+\.\d+/);
            resolve();
          } catch (err) {
            reject(err);
          }
        };

        ws1 = new WebSocket(`ws://localhost:${server.port}`);
      });
    });
  });

  describe('.start()', () => {
    it('starts the server', () => {
      return new Promise<void>((resolve, reject) => {
        const port = 8088;
        ws1 = new WebSocket(`ws://localhost:${port}`);
        ws1.on('open', () => reject(new Error('Should not open')));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        ws1.on('error', async () => {
          await server2.start(port);
          setTimeout(() => {
            ws2 = new WebSocket(`ws://localhost:${port}`);
            ws2.on('open', () => resolve());
            ws2.on('error', () => reject(new Error('Should not error')));
            ws2.on('close', () => reject(new Error('Should not close')));
          }, 3000);
        });
      });
    });
  });

  describe('.stop()', () => {
    it('does not disconnect existing clients', () => {
      return new Promise<void>((resolve, reject) => {
        ws1 = new WebSocket(`ws://localhost:${server.port}`);

        let counter = 0;
        const limit = 5;

        server.onConnection = (client) => {
          server.stop();

          // eslint-disable-next-line no-param-reassign
          client.onMessage = () => setImmediate(() => client.send(new Uint8Array([1, 2, 3])));
        };

        ws1.on('message', () => {
          counter += 1;
          if (counter === limit) {
            resolve();
          } else {
            setImmediate(() => ws1.send(new Uint8Array([1, 2, 3])));
          }
        });

        ws1.on('open', () => setImmediate(() => ws1.send(new Uint8Array([1, 2, 3]))));
        ws1.on('close', () => {
          if (counter < 5) {
            reject(new Error('Connection closed before all messages sent/received'));
          }
        });
      });
    });

    it('blocks new connections', () => {
      return new Promise<void>((resolve, reject) => {
        server.onConnection = () => reject(new Error('Should not connect'));
        server.stop();
        ws1 = new WebSocket(`ws://localhost:${server.port}`);
        ws1.on('open', () => reject(new Error('Should not open')));
        ws1.on('error', () => resolve());
        ws1.on('close', () => reject(new Error('Should not close')));
      });
    });
  });

  describe('messages', () => {
    it('can send binary message', () => {
      return new Promise<void>((resolve, reject) => {
        ws1 = new WebSocket(`ws://localhost:${server.port}`);

        server.onConnection = (client) => {
          client.send(new Uint8Array([1, 2, 3]));
        };

        ws1.on('message', (buffer: ArrayBuffer) => {
          const data = new Uint8Array(buffer);
          try {
            expect(data).toBeInstanceOf(Uint8Array);
            expect(data.byteLength).toEqual(3);
            expect(data).toEqual(new Uint8Array([1, 2, 3]));
            expect(data[0]).toEqual(1);
            expect(data[1]).toEqual(2);
            expect(data[2]).toEqual(3);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });

    it('can receive binary message', () => {
      return new Promise<void>((resolve, reject) => {
        ws1 = new WebSocket(`ws://localhost:${server.port}`);

        server.onConnection = (client) => {
          // eslint-disable-next-line no-param-reassign
          client.onMessage = (buffer) => {
            const data = new Uint8Array(buffer);
            try {
              expect(data).toBeInstanceOf(Uint8Array);
              expect(data.byteLength).toEqual(3);
              expect(data).toEqual(new Uint8Array([1, 2, 3]));
              expect(data[0]).toEqual(1);
              expect(data[1]).toEqual(2);
              expect(data[2]).toEqual(3);
              resolve();
            } catch (err) {
              reject(err);
            }
          };
        };

        ws1.on('open', () => ws1.send(new Uint8Array([1, 2, 3])));
      });
    });
  });

  describe('auth', () => {
    it('passes the full url to the onAuth callback', () => {
      return new Promise<void>((resolve, reject) => {
        server.onAuth = (url, callback) => {
          try {
            expect(url).toEqual(`ws://localhost:${server.port}/some/path?key=value`);
            resolve();
          } catch (err) {
            reject(err);
          } finally {
            callback(false);
          }
        };

        ws1 = new WebSocket(`ws://localhost:${server.port}/some/path?key=value`);
      });
    });

    it('blocks unauthorized connections', () => {
      return new Promise<void>((resolve, reject) => {
        server.onAuth = (_url, callback) => callback(false);

        ws1 = new WebSocket(`ws://localhost:${server.port}`);
        ws1.on('open', () => reject(new Error('Should not open')));
        ws1.on('error', () => resolve());
        ws1.on('close', () => reject(new Error('Should not close')));
      });
    });

    it('blocks unauthorized connections - async', () => {
      return new Promise<void>((resolve, reject) => {
        server.onAuth = (_url, callback) => {
          setTimeout(() => callback(false), 200);
        };

        ws1 = new WebSocket(`ws://localhost:${server.port}`);
        ws1.on('open', () => reject(new Error('Should not open')));
        ws1.on('error', () => resolve());
        ws1.on('close', () => reject(new Error('Should not close')));
      });
    });

    it('allows authorized connections', () => {
      return new Promise<void>((resolve, reject) => {
        server.onAuth = (_url, callback) => callback(true);

        ws1 = new WebSocket(`ws://localhost:${server.port}`);
        ws1.on('open', () => resolve());
        ws1.on('error', () => reject(new Error('Should not error')));
        ws1.on('close', () => reject(new Error('Should not close')));
      });
    });

    it('allows authorized connections - async', () => {
      return new Promise<void>((resolve, reject) => {
        server.onAuth = (_url, callback) => {
          setTimeout(() => callback(true), 200);
        };

        ws1 = new WebSocket(`ws://localhost:${server.port}`);
        ws1.on('open', () => resolve());
        ws1.on('error', () => reject(new Error('Should not error')));
        ws1.on('close', () => reject(new Error('Should not close')));
      });
    });
  });
});
