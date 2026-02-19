/**
 * Host Sync (engine-level)
 *
 * Minimal, capability-safe host/client syncing.
 *
 * Transport today: BroadcastChannel (same-origin, same browser profile).
 * Transport later: WebSocket (remote).
 */

export type HostRole = 'host' | 'client';
export type HostTransport = 'broadcast' | 'websocket';

export type HostMessage =
  | {
      v: 1;
      kind: 'hello';
      token: string;
      from: string;
      ts: number;
    }
  | {
      v: 1;
      kind: 'goto';
      token: string;
      from: string;
      ts: number;
      sectionIndex: number;
      mode: 'fit' | 'focus';
      fill?: number;
      distance?: number;
    }
  | {
      v: 1;
      kind: 'scene';
      token: string;
      from: string;
      ts: number;
      sectionIndex: number;
      mode: 'fit' | 'focus';
      fill?: number;
      distance?: number;
      revealStep: number;
    };

export interface HostDriver {
  start(): void;
  stop(): void;
  send(msg: HostMessage): void;
  onMessage(cb: (msg: HostMessage) => void): void;
}

function randomId(bytes: number): string {
  try {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    let out = '';
    for (const b of a) out += b.toString(16).padStart(2, '0');
    return out;
  } catch {
    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }
}

class BroadcastChannelDriver implements HostDriver {
  private bc: BroadcastChannel | null = null;
  private cb: ((msg: HostMessage) => void) | null = null;

  constructor(
    private channelName: string,
    private token: string,
    private maxMessageBytes: number
  ) {}

  start(): void {
    if (this.bc) return;
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BroadcastChannel not available');
    }

    const bc = new BroadcastChannel(this.channelName);
    bc.onmessage = (ev) => {
      const data = ev?.data;
      if (!data || typeof data !== 'object') return;

      try {
        const approx = JSON.stringify(data);
        if (approx.length > this.maxMessageBytes) return;
      } catch {
        return;
      }

      const msg = data as HostMessage;
      if (msg.v !== 1) return;
      if (typeof msg.token !== 'string' || msg.token !== this.token) return;
      if (typeof msg.kind !== 'string') return;

      this.cb?.(msg);
    };

    this.bc = bc;
  }

  stop(): void {
    if (!this.bc) return;
    try {
      this.bc.close();
    } catch {
      // ignore
    }
    this.bc = null;
  }

  send(msg: HostMessage): void {
    if (!this.bc) return;
    if (msg.v !== 1) return;
    if (msg.token !== this.token) return;

    try {
      const approx = JSON.stringify(msg);
      if (approx.length > this.maxMessageBytes) return;
    } catch {
      return;
    }

    this.bc.postMessage(msg);
  }

  onMessage(cb: (msg: HostMessage) => void): void {
    this.cb = cb;
  }
}

export interface HostSyncConfig {
  enabled: boolean;
  role: HostRole;
  transport: HostTransport;
  /** Shared channel identifier (not secret). */
  channelId: string;
  /** Shared secret token (required). */
  token: string;
  /** Optional stable client id for logging. */
  clientId?: string;
}

export type HostSessionInfo = {
  enabled: boolean;
  role: HostRole;
  transport: HostTransport;
  channelId: string;
  token: string;
  clientId: string;
};

export class HostSync {
  private driver: HostDriver | null = null;
  private connected: boolean = false;
  private readonly clientId: string;

  private lastSendAtMs: number = 0;
  private sendBurst: number = 0;

  private onGoto: ((args: { sectionIndex: number; mode: 'fit' | 'focus'; fill?: number; distance?: number }) => void) | null = null;
  private onScene: ((args: {
    sectionIndex: number;
    mode: 'fit' | 'focus';
    fill?: number;
    distance?: number;
    revealStep: number;
  }) => void) | null = null;

  constructor(private cfg: HostSyncConfig) {
    this.clientId = cfg.clientId ?? randomId(8);
  }

  getSessionInfo(): HostSessionInfo {
    return {
      enabled: this.cfg.enabled,
      role: this.cfg.role,
      transport: this.cfg.transport,
      channelId: this.cfg.channelId,
      token: this.cfg.token,
      clientId: this.clientId
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    if (!this.cfg.enabled) return;
    if (this.driver) return;

    const channelName = `storie:host:${this.cfg.channelId}`;
    const maxMessageBytes = 16 * 1024;

    if (this.cfg.transport === 'broadcast') {
      this.driver = new BroadcastChannelDriver(channelName, this.cfg.token, maxMessageBytes);
    } else {
      throw new Error('WebSocket transport not implemented yet');
    }

    this.driver.onMessage((msg) => {
      if (msg.kind === 'hello') {
        this.connected = true;
        return;
      }

      if (msg.kind === 'goto') {
        this.connected = true;
        if (msg.from === this.clientId) return;
        this.onGoto?.({
          sectionIndex: msg.sectionIndex,
          mode: msg.mode,
          fill: msg.fill,
          distance: msg.distance
        });
        return;
      }

      if (msg.kind === 'scene') {
        this.connected = true;
        if (msg.from === this.clientId) return;
        const revealStep = Number.isFinite(msg.revealStep) ? Math.max(0, Math.floor(msg.revealStep)) : 0;
        this.onScene?.({
          sectionIndex: msg.sectionIndex,
          mode: msg.mode,
          fill: msg.fill,
          distance: msg.distance,
          revealStep
        });
      }
    });

    this.driver.start();
    this.sendHello();
  }

  stop(): void {
    this.driver?.stop();
    this.driver = null;
    this.connected = false;
  }

  onGotoSection(cb: (args: { sectionIndex: number; mode: 'fit' | 'focus'; fill?: number; distance?: number }) => void): void {
    this.onGoto = cb;
  }

  onSceneState(
    cb: (args: { sectionIndex: number; mode: 'fit' | 'focus'; fill?: number; distance?: number; revealStep: number }) => void
  ): void {
    this.onScene = cb;
  }

  sendHello(): void {
    this.send({
      v: 1,
      kind: 'hello',
      token: this.cfg.token,
      from: this.clientId,
      ts: Date.now()
    });
  }

  sendGotoSectionFit(sectionIndex: number, fill: number = 0.9): void {
    this.send({
      v: 1,
      kind: 'goto',
      token: this.cfg.token,
      from: this.clientId,
      ts: Date.now(),
      sectionIndex,
      mode: 'fit',
      fill
    });
  }

  sendSceneFit(sectionIndex: number, revealStep: number, fill: number = 0.9): void {
    this.send({
      v: 1,
      kind: 'scene',
      token: this.cfg.token,
      from: this.clientId,
      ts: Date.now(),
      sectionIndex,
      mode: 'fit',
      fill,
      revealStep: Math.max(0, Math.floor(revealStep))
    });
  }

  private send(msg: HostMessage): void {
    if (!this.driver) return;

    const now = performance.now();
    if (now - this.lastSendAtMs > 1000) {
      this.lastSendAtMs = now;
      this.sendBurst = 0;
    }
    this.sendBurst++;
    if (this.sendBurst > 20) return;

    this.driver.send(msg);
  }
}

export function parseHostParams(search: string): {
  enabled: boolean;
  role: HostRole;
  transport: HostTransport;
  channelId: string | null;
  token: string | null;
} {
  try {
    const qs = new URLSearchParams(search);

    // Short params (preferred)
    const roleRaw = qs.get('role');
    const transportRaw = qs.get('transport');
    const channel = qs.get('channel');
    const tokenRaw = qs.get('token');

    // New params
    const hostEnabled = qs.get('host') === '1' || qs.get('host') === 'true';
    const hostRoleRaw = qs.get('hostRole');
    const hostTransportRaw = qs.get('hostTransport');
    const hostChannel = qs.get('hostChannel');
    const hostToken = qs.get('hostToken');

    // Back-compat params (older naming)
    const presentEnabled = qs.get('present') === '1' || qs.get('present') === 'true';
    const presentRoleRaw = qs.get('presentRole');
    const presentTransportRaw = qs.get('presentTransport');
    const presentChannel = qs.get('presentChannel');
    const presentToken = qs.get('presentToken');

    // Enabled if explicitly set, or if any role/session params are present.
    const enabled =
      hostEnabled ||
      presentEnabled ||
      roleRaw !== null ||
      channel !== null ||
      tokenRaw !== null ||
      transportRaw !== null ||
      hostRoleRaw !== null ||
      hostChannel !== null ||
      hostToken !== null ||
      hostTransportRaw !== null ||
      presentRoleRaw !== null ||
      presentChannel !== null ||
      presentToken !== null ||
      presentTransportRaw !== null;

    const roleCandidate = (roleRaw || hostRoleRaw || presentRoleRaw || 'client').toLowerCase();
    const role: HostRole = roleCandidate === 'host' || roleCandidate === 'presenter' ? 'host' : 'client';

    // Default transport is broadcast; only include transport param when non-default.
    const transportCandidate = (transportRaw || hostTransportRaw || presentTransportRaw || 'broadcast').toLowerCase();
    const transport: HostTransport = transportCandidate === 'websocket' ? 'websocket' : 'broadcast';

    const channelId = channel || hostChannel || presentChannel;
    const token = tokenRaw || hostToken || presentToken;

    return { enabled, role, transport, channelId, token };
  } catch {
    return { enabled: false, role: 'client', transport: 'broadcast', channelId: null, token: null };
  }
}

export function makeClientJoinUrl(args: {
  url: URL;
  role: HostRole;
  transport: HostTransport;
  channelId: string;
  token: string;
}): string {
  const u = new URL(args.url.toString());

  // Short params (preferred)
  u.searchParams.set('role', args.role);
  u.searchParams.set('channel', args.channelId);
  u.searchParams.set('token', args.token);
  if (args.transport !== 'broadcast') {
    u.searchParams.set('transport', args.transport);
  } else {
    u.searchParams.delete('transport');
  }

  // Clean up long-form host params if present
  u.searchParams.delete('host');
  u.searchParams.delete('hostRole');
  u.searchParams.delete('hostTransport');
  u.searchParams.delete('hostChannel');
  u.searchParams.delete('hostToken');

  // Clean up old params if present
  u.searchParams.delete('present');
  u.searchParams.delete('presentRole');
  u.searchParams.delete('presentTransport');
  u.searchParams.delete('presentChannel');
  u.searchParams.delete('presentToken');

  return u.toString();
}

export function createHostSessionIds(): { channelId: string; token: string } {
  return {
    channelId: randomId(8),
    token: randomId(16)
  };
}
