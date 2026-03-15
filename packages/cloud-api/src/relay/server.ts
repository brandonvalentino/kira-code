/**
 * WebSocket relay server.
 * Manages connections from local kira-code servers (hosts) and proxies
 * HTTP requests from remote-web users through those connections.
 *
 * Protocol:
 * 1. Local server connects to WS /relay/connect with Bearer JWT
 * 2. Server verifies JWT, looks up host record, marks host online
 * 3. When remote-web requests a relay session (via POST /v1/hosts/:id/sessions),
 *    the relay server routes HTTP requests through the host's WS connection
 *    using a JSON-over-WebSocket request/response protocol.
 *
 * Message format (JSON):
 *   Host -> Server: { type: "heartbeat" }
 *   Server -> Host: { type: "request", id: string, method, url, headers, body }
 *   Host -> Server: { type: "response", id: string, status, headers, body }
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '../db/index.js';
import { JwtService } from '../auth/jwt.js';
import { hosts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface HostConnection {
  ws: WebSocket;
  hostId: string;
  userId: string;
  connectedAt: Date;
}

export interface PendingRequest {
  resolve: (response: RelayResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface RelayMessage {
  type: 'heartbeat' | 'request' | 'response';
  id?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string | null;
  status?: number;
}

export interface RelayResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const REQUEST_TIMEOUT_MS = 30_000;

export class RelayServer {
  private wss: WebSocketServer;
  /** hostId -> active WebSocket connection */
  private hostConnections = new Map<string, HostConnection>();
  /** requestId -> pending response promise */
  private pendingRequests = new Map<string, PendingRequest>();

  constructor(
    private db: Db,
    private jwt: JwtService,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', this.onConnection.bind(this));
  }

  /**
   * Attach this relay server to an HTTP server for the /relay/connect path.
   */
  attachToServer(httpServer: Server) {
    httpServer.on('upgrade', async (req: IncomingMessage, socket, head) => {
      if (!req.url?.startsWith('/relay/connect')) return;

      const authHeader = req.headers['authorization'] ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      let claims;
      try {
        claims = this.jwt.verifyAccessToken(token);
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Look up host by machine_id query param
      const urlParams = new URL(req.url, 'http://localhost').searchParams;
      const hostId = urlParams.get('host_id');

      if (!hostId) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify host belongs to user
      const host = await this.db
        .select()
        .from(hosts)
        .where(and(eq(hosts.id, hostId), eq(hosts.owner_user_id, claims.sub)))
        .limit(1)
        .then((r) => r[0]);

      if (!host) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req, { hostId: host.id, userId: claims.sub });
      });
    });
  }

  private onConnection(
    ws: WebSocket,
    _req: IncomingMessage,
    context: { hostId: string; userId: string },
  ) {
    const { hostId, userId } = context;

    const conn: HostConnection = { ws, hostId, userId, connectedAt: new Date() };
    this.hostConnections.set(hostId, conn);

    // Mark host online
    void this.db
      .update(hosts)
      .set({ status: 'online', last_seen_at: new Date(), updated_at: new Date() })
      .where(eq(hosts.id, hostId));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as RelayMessage;
        if (msg.type === 'response' && msg.id) {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(msg.id);
            pending.resolve({
              status: msg.status ?? 502,
              headers: msg.headers ?? {},
              body: msg.body ?? '',
            });
          }
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on('close', () => {
      this.hostConnections.delete(hostId);
      void this.db
        .update(hosts)
        .set({ status: 'offline', updated_at: new Date() })
        .where(eq(hosts.id, hostId));
    });

    ws.on('error', () => {
      this.hostConnections.delete(hostId);
    });
  }

  /**
   * Check if a host is currently connected.
   */
  isHostOnline(hostId: string): boolean {
    return this.hostConnections.has(hostId);
  }

  /**
   * Proxy an HTTP request to a connected host via WebSocket.
   */
  async proxyRequest(
    hostId: string,
    method: string,
    url: string,
    headers: Record<string, string>,
    body: string | null,
  ): Promise<RelayResponse> {
    const conn = this.hostConnections.get(hostId);
    if (!conn) {
      return { status: 503, headers: {}, body: 'Host not connected' };
    }

    const requestId = uuidv4();
    const msg: RelayMessage = { type: 'request', id: requestId, method, url, headers, body };

    return new Promise<RelayResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Relay request timed out'));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
      conn.ws.send(JSON.stringify(msg));
    });
  }

  getHostConnection(hostId: string): HostConnection | undefined {
    return this.hostConnections.get(hostId);
  }
}
