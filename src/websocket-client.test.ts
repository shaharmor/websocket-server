import { WebSocketClient } from '@/websocket-client';
import { ExtendedWebSocket } from '@/websocket-server';

describe('websocket-client', () => {
  let socket: ExtendedWebSocket;

  beforeEach(() => {
    socket = {
      send: jest.fn(),
      close: jest.fn(),
      end: jest.fn(),
      ip: '1.1.1.1',
      url: 'ws://sub.domain.com/path?key=value',
      headers: new Map([['key', 'value']]),
    } as unknown as ExtendedWebSocket;
  });

  describe('props', () => {
    it('.ip', () => {
      const client = new WebSocketClient(socket);
      expect(client.ip).toEqual('1.1.1.1');
    });

    it('.url', () => {
      const client = new WebSocketClient(socket);
      expect(client.url).toEqual('ws://sub.domain.com/path?key=value');
    });
  });

  describe('.getHeader', () => {
    it('returns undefined for an unknown header', () => {
      const client = new WebSocketClient(socket);
      expect(client.getHeader('unknown')).toEqual(undefined);
    });

    it('returns correct value for a known header', () => {
      const client = new WebSocketClient(socket);
      expect(client.getHeader('key')).toEqual('value');
    });
  });

  describe('.send()', () => {
    it('forwards the buffer to the socket', () => {
      const client = new WebSocketClient(socket);
      expect(socket.send).toHaveBeenCalledTimes(0);
      const buffer = new Uint8Array([1, 2, 3]);
      client.send(buffer);
      expect(socket.send).toHaveBeenCalledTimes(1);
      expect(socket.send).toHaveBeenNthCalledWith(1, buffer, true, false);
    });
  });

  describe('.closeGracefully()', () => {
    it('calls .end() on the socket with the matching code', () => {
      const client = new WebSocketClient(socket);
      expect(socket.end).toHaveBeenCalledTimes(0);
      client.closeGracefully(4);
      expect(socket.end).toHaveBeenCalledTimes(1);
      expect(socket.end).toHaveBeenNthCalledWith(1, 4);
    });

    it('does not throw if the socket throws', () => {
      const client = new WebSocketClient(socket);
      socket.end = jest.fn(() => {
        throw new Error('err');
      });
      expect(socket.end).toHaveBeenCalledTimes(0);
      expect(() => client.closeGracefully(4)).not.toThrow();
      expect(socket.end).toHaveBeenCalledTimes(1);
      expect(socket.end).toHaveBeenNthCalledWith(1, 4);
    });
  });

  describe('.closeAbruptly()', () => {
    it('calls .close() on the socket', () => {
      const client = new WebSocketClient(socket);
      expect(socket.close).toHaveBeenCalledTimes(0);
      client.closeAbruptly();
      expect(socket.close).toHaveBeenCalledTimes(1);
    });

    it('does not throw if the socket throws', () => {
      const client = new WebSocketClient(socket);
      socket.close = jest.fn(() => {
        throw new Error('err');
      });
      expect(socket.close).toHaveBeenCalledTimes(0);
      expect(() => client.closeAbruptly()).not.toThrow();
      expect(socket.close).toHaveBeenCalledTimes(1);
    });
  });
});
