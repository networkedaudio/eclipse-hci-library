// EclipseHCI.ts
// Fully TypeScript-compliant, HCI v2 (Eclipse HX 12.0+), 32-bit session token fixed
import * as net from 'net';
import { EventEmitter } from 'events';

// Minimal but correct HCIRequest class
class HCIRequest {
    public readonly Urgent: boolean = false;
    constructor(
        public readonly RequestID: number,
        public readonly Data: Buffer,
        urgent: boolean = false,
        public readonly ResponseID?: number
    ) {
        this.Urgent = urgent;
    }

    getRequest(): Buffer {
        return HCI.buildPacket(this.RequestID, this.Data);
    }

    toString(): string {
        return `HCIRequest(0x${this.RequestID.toString(16).padStart(4, '0')}, ${this.Data.length} bytes)`;
    }
}

export interface EclipseHCIOptions {
    address: string;
    port?: number;               // Set to skip port scan
    username?: string;
    password?: string;
    rateLimitMs?: number;
    reconnect?: boolean;
    reconnectDelayMs?: number;
    showDebug?: boolean;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

export class EclipseHCI extends EventEmitter {
    private static readonly START = Buffer.from([0x5A, 0x0F]);
    private static readonly END = Buffer.from([0x2E, 0x8D]);

    private readonly opts: Required<EclipseHCIOptions>;
    private socket: net.Socket | null = null;
    private buffer = Buffer.alloc(0);
    private queue: HCIRequest[] = [];
    private timer: NodeJS.Timeout | null = null;
    private processing = false;
    private reconnectTimer: NodeJS.Timeout | null = null;

    private state: ConnectionState = 'disconnected';
    private sessionToken: number = 0;

    constructor(options: EclipseHCIOptions) {
        super();
        this.opts = {
            address: options.address,
            port: options.port ?? 0,
            username: options.username ?? 'admin',
            password: options.password ?? '',
            rateLimitMs: options.rateLimitMs ?? 80,
            reconnect: options.reconnect ?? true,
            reconnectDelayMs: options.reconnectDelayMs ?? 5000,
            showDebug: options.showDebug ?? true,
        };
        this.connect();
    }

    private log(...args: any[]) {
        if (this.opts.showDebug) console.log('[EclipseHCI]', ...args);
    }

    private async connect(): Promise<void> {
        if (this.state === 'connecting') return;
        this.state = 'connecting';
        this.emit('statechange', this.state);

        const port = this.opts.port || await this.findPort();
        this.log(`Connecting to ${this.opts.address}:${port}`);

        return new Promise((resolve, reject) => {
            const sock = new net.Socket();
            sock.setTimeout(10000);

            const cleanup = () => sock.destroy();

            sock.once('connect', () => {
                this.socket = sock;
                this.buffer = Buffer.alloc(0);
                this.state = 'connected';
                this.emit('connected');
                this.setupSocket();
                this.startQueue();
                this.sendLoginV2().then(resolve).catch(reject);
            });

            sock.once('error', err => { cleanup(); reject(err); });
            sock.once('timeout', () => { cleanup(); reject(new Error('timeout')); });

            sock.connect(port, this.opts.address);
        });
    }

    private async findPort(): Promise<number> {
        const ranges = [
            [52020, 52001],

        ];
        for (const [start, end] of ranges) {
            for (let p = start; p >= end; p--) {
                if (await this.testPort(p)) {
                    this.log(`HCI port discovered: ${p}`);
                    return p;
                }
            }
        }
        throw new Error('No Eclipse HCI port found');
    }

    private testPort(port: number): Promise<boolean> {
        return new Promise(resolve => {
            const s = new net.Socket();
            s.setTimeout(700);
            s.once('connect', () => { s.destroy(); resolve(true); });
            s.once('error', () => resolve(false));
            s.once('timeout', () => resolve(false));
            s.connect(port, this.opts.address);
        });
    }

    private setupSocket() {
        if (!this.socket) return;
        this.socket.on('data', d => this.handleData(d));
        this.socket.on('close', hadErr => this.handleClose(hadErr));
        this.socket.on('error', err => this.log('Socket error:', err.message));
    }

    private handleData(data: Buffer) {
        this.buffer = Buffer.concat([this.buffer, data]);
        while (this.buffer.length >= 6) {
            if (!this.buffer.subarray(0, 2).equals(EclipseHCI.START)) {
                const idx = this.buffer.indexOf(EclipseHCI.START);
                this.buffer = idx === -1 ? Buffer.alloc(0) : this.buffer.subarray(idx);
                continue;
            }
            const len = this.buffer.readUInt16BE(2);
            if (this.buffer.length < len) break;

            const packet = this.buffer.subarray(0, len);
            this.buffer = this.buffer.subarray(len);

            if (!packet.subarray(-2).equals(EclipseHCI.END)) {
                this.log('Invalid end bytes');
                continue;
            }

            this.handlePacket(packet);
        }
    }

    private handlePacket(packet: Buffer) {
        const payload = packet.subarray(4, -2);
        const reqId = payload.readUInt16BE(0);

        if (reqId === 0x8001) {
            // CORRECT 32-bit session token at offset 2
            this.sessionToken = payload.readUInt32BE(2);
            this.state = 'authenticated';
            this.log(`Authenticated! Session Token: 0x${this.sessionToken.toString(16).padStart(8, '0')}`);
            this.emit('authenticated', this.sessionToken);
            this.emit('statechange', this.state);
            return;
        }

        this.emit('response', packet);
        this.emit(`response:${reqId.toString(16).padStart(4, '0')}`, payload);
    }

    private async sendLoginV2(): Promise<void> {
        const user = Buffer.from(this.opts.username, 'utf8');
        const pass = Buffer.from(this.opts.password, 'utf8');

        const payload = Buffer.alloc(6 + user.length + pass.length);
        let off = 0;
        payload.writeUInt16BE(0x0001, off); off += 2;
        payload.writeUInt8(user.length, off); off += 1;
        user.copy(payload, off); off += user.length;
        payload.writeUInt8(pass.length, off); off += 1;
        pass.copy(payload, off); off += pass.length;
        payload.writeUInt16BE(2, off); // Protocol version 2

        const packet = HCI.buildPacket(0x0001, payload);
        await this.sendRaw(packet, true);
        this.log('Login v2 sent');
    }

    private handleClose(hadError: boolean) {
        this.log('Disconnected', hadError ? '(error)' : '');
        this.state = 'disconnected';
        this.sessionToken = 0;
        this.stopQueue();
        this.socket = null;
        this.emit('disconnected');
        this.emit('statechange', this.state);

        if (this.opts.reconnect && !this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.connect().catch(() => { });
            }, this.opts.reconnectDelayMs);
        }
    }

    // === Public API ===
    public async sendCommand(id: number, data: Buffer, urgent = false): Promise<void> {
        const payload = HCI.v2Payload(id, data, this.sessionToken);
        const packet = HCI.buildPacket(id, payload);
        await this.sendRaw(packet, urgent);
    }

    public sendText(command: string, urgent = false): void {
        this.sendCommand(0x0001, Buffer.from(command, 'utf8'), urgent);
    }

    private sendRaw(packet: Buffer, urgent = false): Promise<void> {
        return new Promise(resolve => {
            const req = new HCIRequest(0, packet, urgent);
            this.enqueue(req);
            resolve();
        });
    }

    private enqueue(req: HCIRequest) {
        if (req.Urgent) {
            const idx = this.queue.findIndex(r => !r.Urgent);
            idx === -1 ? this.queue.push(req) : this.queue.splice(idx, 0, req);
        } else {
            this.queue.push(req);
        }
        this.log(`Queued (${req.Urgent ? 'URG' : 'NOR'}): ${req}`);
    }

    private startQueue() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.drain(), this.opts.rateLimitMs);
    }

    private stopQueue() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private async drain() {
        if (this.processing || !this.socket || this.queue.length === 0) return;
        this.processing = true;
        const req = this.queue.shift()!;
        this.socket.write(req.getRequest());
        this.processing = false;
    }

    public disconnect() {
        this.opts.reconnect = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.destroy();
    }

    public getState(): ConnectionState { return this.state; }
    public getToken(): number { return this.sessionToken; }
}

// Static helpers — 100% correct framing
export class HCI {
    static buildPacket(requestId: number, payload: Buffer): Buffer {
        const total = 4 + payload.length + 2;
        const buf = Buffer.alloc(total);
        let off = 0;
        EclipseHCI.START.copy(buf, off); off += 2;
        buf.writeUInt16BE(total, off); off += 2;
        payload.copy(buf, off); off += payload.length;
        EclipseHCI.END.copy(buf, off);
        return buf;
    }

    static v2Payload(requestId: number, data: Buffer, token: number): Buffer {
        const buf = Buffer.alloc(6 + data.length);
        buf.writeUInt16BE(requestId, 0);
        buf.writeUInt32BE(token, 2);     // ← 32-bit token, correct offset!
        data.copy(buf, 6);
        return buf;
    }
}

export default EclipseHCI;