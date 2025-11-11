import * as net from 'net';
import { EventEmitter } from 'events';
import HCIRequest from './HCIRequest';
import ProcessHCI from './ProcessHCI';

class EclipseHCI extends EventEmitter {
    private address: string;
    private connected: boolean;
    private socket: net.Socket | null;
    private port: number | null;
    private buffer: Buffer; // Add buffer for incomplete packets
    private messageQueue: HCIRequest[];
    private queueProcessor: NodeJS.Timeout | null;
    private rateLimitMs: number;
    private isProcessingQueue: boolean;

    constructor(address: string, rateLimitMs: number = 100) {
        super(); // Call EventEmitter constructor
        this.address = address;
        this.connected = false;
        this.socket = null;
        this.port = null;
        this.buffer = Buffer.alloc(0); // Initialize empty buffer
        this.messageQueue = [];
        this.queueProcessor = null;
        this.rateLimitMs = rateLimitMs;
        this.isProcessingQueue = false;
        
        // Attempt to connect automatically on instantiation
        this.connect();
    }

    private async connect(): Promise<void> {
        // Try ports from 52020 down to 52001
        for (let port = 52020; port >= 52001; port--) {
            try {
                await this.tryConnect(port);
                this.port = port;
                console.log(`Connected to ${this.address}:${port}`);
                return;
            } catch (error) {
                console.log(`Failed to connect to port ${port}`);
                continue;
            }
        }
        
        console.error(`Failed to connect to ${this.address} on any port (52020-52001)`);
        throw new Error(`Unable to establish connection to ${this.address}`);
    }

    private tryConnect(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error(`Connection timeout on port ${port}`));
            }, 3000); // 3 second timeout

            socket.connect(port, this.address, () => {
                clearTimeout(timeout);
                this.socket = socket;
                this.setupSocketHandlers();
                resolve();
            });

            socket.on('error', (error) => {
                clearTimeout(timeout);
                socket.destroy();
                reject(error);
            });
        });
    }

    private setupSocketHandlers(): void {
        if (!this.socket) return;

        this.socket.on('data', (data) => {
            // Change state to connected when receiving messages
            if (!this.connected) {
                this.connected = true;
                console.log(`Now receiving messages from ${this.address}:${this.port}`);
                // Start queue processing when connected
                this.startQueueProcessor();
            }
            this.handleMessage(data);
        });

        this.socket.on('close', () => {
            this.connected = false;
            this.socket = null;
            this.stopQueueProcessor();
            console.log(`Connection closed to ${this.address}:${this.port}`);
        });

        this.socket.on('error', (error) => {
            console.error(`Socket error: ${error.message}`);
            this.connected = false;
            this.socket = null;
            this.stopQueueProcessor();
        });
    }

    private handleMessage(data: Buffer): void {
        // Append new data to existing buffer
        this.buffer = Buffer.concat([this.buffer, data]);
        
        const startBytes = Buffer.from([0x5A, 0x0F]);
        const endBytes = Buffer.from([0x2E, 0x8D]);
        
        console.log(`Buffer now contains ${this.buffer.length} bytes: ${this.buffer.toString('hex')}`);
        
        // Process all complete messages in the buffer
        while (this.buffer.length > 0) {
            // Find start of message
            const startIndex = this.buffer.indexOf(startBytes);
            if (startIndex === -1) {
                // No start found, keep buffer in case next data completes a start sequence
                console.log('No start bytes found, keeping buffer for next data');
                break;
            }
            
            // If start is not at beginning, remove everything before it
            if (startIndex > 0) {
                console.log(`Discarding ${startIndex} bytes before start sequence`);
                this.buffer = this.buffer.subarray(startIndex);
            }
            
            // Check if we have enough bytes for start + length field (2 bytes + 2 bytes = 4 bytes minimum)
            if (this.buffer.length < startBytes.length + 2) {
                console.log('Not enough bytes for length field, waiting for more data');
                break;
            }
            
            // Read length field (16 bits, big endian) immediately after start bytes
            const lengthField = this.buffer.readUInt16BE(startBytes.length);
            console.log(`Length field indicates message should be ${lengthField} bytes`);
            
            // Check if we have the complete message based on length field
            if (this.buffer.length < lengthField) {
                console.log(`Buffer has ${this.buffer.length} bytes but need ${lengthField}, waiting for more data`);
                break;
            }
            
            // Extract message based on length field
            const completeMessage = this.buffer.subarray(0, lengthField);
            
            // Verify end bytes are at expected position
            const expectedEndStart = lengthField - endBytes.length;
            const actualEndBytes = completeMessage.subarray(expectedEndStart);
            
            if (!actualEndBytes.equals(endBytes)) {
                console.error(`Message length validation failed. Expected end bytes ${endBytes.toString('hex')} at position ${expectedEndStart}, but found ${actualEndBytes.toString('hex')}`);
                // Skip this message and try to find the next valid start
                this.buffer = this.buffer.subarray(startBytes.length);
                continue;
            }
            
            // Process the validated complete message
            this.processMessage(completeMessage);
            
            // Remove processed message from buffer
            this.buffer = this.buffer.subarray(lengthField);
            console.log(`Remaining buffer: ${this.buffer.length} bytes`);
        }
    }

    private processMessage(message: Buffer): void {
        const startBytes = Buffer.from([0x5A, 0x0F]);
        const endBytes = Buffer.from([0x2E, 0x8D]);
        
        // Read length field
        const lengthField = message.readUInt16BE(startBytes.length);
        
        // Validate that length field matches actual message length
        if (lengthField !== message.length) {
            console.error(`Length field mismatch: field says ${lengthField} bytes, actual message is ${message.length} bytes. Discarding message.`);
            console.error(`Discarded message: ${message.toString('hex')}`);
            return;
        }
        
        // Check if we have enough bytes for message ID and flags (start + length + messageID + flags = 2 + 2 + 2 + 1 = 7 bytes minimum)
        if (message.length < startBytes.length + 2 + 2 + 1) {
            console.error('Message too short to contain message ID and flags');
            return;
        }
        
        // Read message ID (16 bits, big endian) after length field
        const messageID = message.readUInt16BE(startBytes.length + 2);
        
        // Read flags byte after message ID
        const flagsByte = message.readUInt8(startBytes.length + 2 + 2);
        
        // Decode flags (bits 0-7: E, M, U, G, S, N, Reserved, Reserved)
        const flags = {
            E: (flagsByte & 0x01) !== 0,          // Bit 0
            M: (flagsByte & 0x02) !== 0,          // Bit 1
            U: (flagsByte & 0x04) !== 0,          // Bit 2
            G: (flagsByte & 0x08) !== 0,          // Bit 3
            S: (flagsByte & 0x10) !== 0,          // Bit 4
            N: (flagsByte & 0x20) !== 0,          // Bit 5
            Reserved1: (flagsByte & 0x40) !== 0,  // Bit 6
            Reserved2: (flagsByte & 0x80) !== 0   // Bit 7
        };
        
        // Check for HCI version if message is long enough
        let hciVersion = 'HCIv1'; // Default to v1
        let protocolVersion: number | null = null;
        let payloadStart = startBytes.length + 2 + 2 + 1; // start + length + messageID + flags
        
        // Check if we have enough bytes for HCI version signature (need 4 more bytes)
        if (message.length >= payloadStart + 4) {
            const versionBytes = message.subarray(payloadStart, payloadStart + 4);
            const expectedV2Signature = Buffer.from([0xAB, 0xBA, 0xCE, 0xDE]);
            
            if (versionBytes.equals(expectedV2Signature)) {
                hciVersion = 'HCIv2';
                payloadStart += 4; // Skip the version signature
                
                // Check if we have enough bytes for protocol version (need 1 more byte)
                if (message.length >= payloadStart + 1) {
                    protocolVersion = message.readUInt8(payloadStart);
                    payloadStart += 1; // Skip the protocol version for payload extraction
                } else {
                    console.log('HCIv2 message too short for protocol version byte');
                }
            }
        } else {
            console.log('Message too short for HCIv2 signature, assuming HCIv1');
        }
        
        console.log(`Valid message received (${message.length} bytes):`, message.toString('hex'));
        console.log(`Message ID: 0x${messageID.toString(16).padStart(4, '0')} (${messageID})`);
        console.log(`HCI Version: ${hciVersion}`);
        if (protocolVersion !== null) {
            console.log(`Protocol Version: ${protocolVersion}`);
        }
        console.log(`Flags byte: 0x${flagsByte.toString(16).padStart(2, '0')} (${flagsByte.toString(2).padStart(8, '0')})`);
        
        // Display which flags are set
        const setFlags = Object.entries(flags).filter(([key, value]) => value).map(([key, value]) => key);
        if (setFlags.length > 0) {
            console.log(`Flags set: ${setFlags.join(', ')}`);
        } else {
            console.log('No flags set');
        }
        
        // Extract payload (remove end bytes)
        const payloadEnd = message.length - endBytes.length;
        
        if (payloadEnd <= payloadStart) {
            console.log('Message contains no payload');
            return;
        }
        
        const payload = message.subarray(payloadStart, payloadEnd);
        
        console.log(`Payload (${payload.length} bytes):`, payload.toString('hex'));

        
        // Use ProcessHCI to handle the message, passing 'this' for event emission
        ProcessHCI.handleMessageByID(messageID, flags, payload, hciVersion, protocolVersion, this);
    }

    // Queue management methods
    public addToQueue(request: HCIRequest): void {
        if (request.Urgent) {
            // Find the position to insert urgent message (after other urgent messages)
            let insertIndex = 0;
            for (let i = 0; i < this.messageQueue.length; i++) {
                if (this.messageQueue[i].Urgent) {
                    insertIndex = i + 1;
                } else {
                    break;
                }
            }
            this.messageQueue.splice(insertIndex, 0, request);
            console.log(`Added urgent message (RequestID: ${request.RequestID}) to queue at position ${insertIndex}`);
        } else {
            this.messageQueue.push(request);
            console.log(`Added normal message (RequestID: ${request.RequestID}) to queue`);
        }
        
        console.log(`Queue size: ${this.messageQueue.length}`);
    }

    public createAndQueueMessage(requestID: number, data: Buffer, urgent: boolean = false, responseID?: number): void {
        const request = new HCIRequest(requestID, data, urgent, responseID);
        this.addToQueue(request);
    }

    private startQueueProcessor(): void {
        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
        }
        
        this.queueProcessor = setInterval(() => {
            this.processQueue();
        }, this.rateLimitMs);
        
        console.log(`Queue processor started with ${this.rateLimitMs}ms rate limit`);
    }

    private stopQueueProcessor(): void {
        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
            this.queueProcessor = null;
            console.log('Queue processor stopped');
        }
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || !this.connected || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        
        try {
            const request = this.messageQueue.shift();
            if (request) {
                await this.sendHCIRequest(request);
            }
        } catch (error) {
            console.error('Error processing queue:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    private async sendHCIRequest(request: HCIRequest): Promise<void> {
        if (!this.socket || !this.connected) {
            console.error('Cannot send message: not connected');
            return;
        }

        try {
            console.log(`Sending ${request.Urgent ? 'urgent' : 'normal'} message (RequestID: ${request.RequestID}, ${request.Data.length} bytes)`);
            console.log(`Message data: ${request.toHexString()}`);
            
            this.socket.write(request.Data);
            
        } catch (error) {
            console.error(`Failed to send message: ${error}`);
        }
    }

    // Public method to get queue status
    public getQueueStatus(): { total: number; urgent: number; normal: number } {
        const urgent = this.messageQueue.filter(req => req.Urgent).length;
        const total = this.messageQueue.length;
        return {
            total,
            urgent,
            normal: total - urgent
        };
    }

    // Public method to clear the queue
    public clearQueue(): void {
        const clearedCount = this.messageQueue.length;
        this.messageQueue = [];
        console.log(`Cleared ${clearedCount} messages from queue`);
    }

    sendMessage(message: string, urgent: boolean = false): boolean {
        if (this.connected) {
            const data = Buffer.from(message);
            this.createAndQueueMessage(0x0001, data, urgent);
            return true;
        }
        return false;
    }

    disconnect(): void {
        this.stopQueueProcessor();
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.connected = false;
        console.log(`Disconnected from ${this.address}:${this.port}`);
    }

    getStatus(): string {
        return this.connected ? 'Connected' : 'Disconnected';
    }

    getConnectedPort(): number | null {
        return this.port;
    }
}

export default EclipseHCI;