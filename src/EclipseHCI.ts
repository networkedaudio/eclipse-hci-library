
import * as net from 'net';
import { EventEmitter } from 'events';
import HCIRequest from './HCIRequest';
import ProcessResponse from './Responses/ProcessResponse';
import {  streamDeck } from "@elgato/streamdeck";


export class EclipseHCI extends EventEmitter {
    private address: string;
    private connected: boolean;
    private socket: net.Socket | null;
    private port: number | null;
    private buffer: Buffer; // Add buffer for incomplete packets
    private messageQueue: HCIRequest[];
    private queueProcessor: NodeJS.Timeout | null;
    private rateLimitMs: number;
    private isProcessingQueue: boolean;
    public showDebug: boolean = true; // Add debug flag
    private processResponse: ProcessResponse;

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
        this.processResponse = new ProcessResponse(this); // Initialize ProcessResponse with reference to this

        // Attempt to connect automatically on instantiation
        this.connect();
    }

    // Debug method that only outputs when showDebug is true
    private writeDebug(message: string, ...args: any[]): void {
        if (this.showDebug) {
            console.log(message, ...args);
            streamDeck.logger.error(message, ...args);
        }
    }

    private async connect(): Promise<void> {
        // Try ports from 52020 down to 52001
        let cport = 0;
        for (let port = 52020; port >= 52001; port--) {
            cport = port;
            try {
                this.writeDebug(`EHX---Connecting to ${this.address}:${port}`);
                this.tryConnect(port);
                this.port = port;
                this.writeDebug(`EHX---Connected to ${this.address}:${port}`);
                return;
            } catch (error) {
                console.error(`Failed to connect to port ${port}`);
                continue;
            }
        }

        console.error(`EHX---Failed to connect to ${this.address} on any port ${cport}`);
        throw new Error(`Unable to establish connection to ${this.address}:${cport}:${this.port}`);
    }

    private tryConnect(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.writeDebug(`EHX---creating socket ${this.address}\n`);
            const socket = new net.Socket();
            socket.setTimeout(15000); // ms timeout
            this.writeDebug(`EHX---socket created ${this.address}\n`);
            this.writeDebug('====================================================Waiting');

            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error(`EHX----Connection timeout on port ${port}`));
            }, 12000); // mssecond timeout

            this.writeDebug(`EHX---attempt to connect ${this.address},${port}\n`);
            socket.connect(port, this.address, () => {
                clearTimeout(timeout);
                this.socket = socket;
                this.setupSocketHandlers();
                resolve();
                this.writeDebug(`EHX---resolved socket ${this.socket}\n`);
            });

            socket.on('error', (error) => {
                clearTimeout(timeout);
                this.writeDebug(`EHX---socket error ${this.socket}\n`);
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
                this.writeDebug(`EHX---Now receiving messages from ${this.address}:${this.port}`);
                // Start queue processing when connected
                this.startQueueProcessor();
            }
            this.handleMessage(data);
        });

        this.socket.on('close', () => {
            this.connected = false;
            this.socket = null;
            this.stopQueueProcessor();
            this.writeDebug(`Connection closed to ${this.address}:${this.port}`);
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

        this.writeDebug(`Buffer now contains ${this.buffer.length} bytes: ${this.buffer.toString('hex')}`);

        // Process all complete messages in the buffer
        while (this.buffer.length > 0) {
            // Find start of message
            const startIndex = this.buffer.indexOf(startBytes);
            if (startIndex === -1) {
                // No start found, keep buffer in case next data completes a start sequence
                this.writeDebug('No start bytes found, keeping buffer for next data');
                break;
            }

            // If start is not at beginning, remove everything before it
            if (startIndex > 0) {
                this.writeDebug(`Discarding ${startIndex} bytes before start sequence`);
                this.buffer = this.buffer.subarray(startIndex);
            }

            // Check if we have enough bytes for start + length field (2 bytes + 2 bytes = 4 bytes minimum)
            if (this.buffer.length < startBytes.length + 2) {
                this.writeDebug('Not enough bytes for length field, waiting for more data');
                break;
            }

            // Read length field (16 bits, big endian) immediately after start bytes
            const lengthField = this.buffer.readUInt16BE(startBytes.length);
            this.writeDebug(`Length field indicates message should be ${lengthField} bytes`);

            // Check if we have the complete message based on length field
            if (this.buffer.length < lengthField) {
                this.writeDebug(`Buffer has ${this.buffer.length} bytes but need ${lengthField}, waiting for more data`);
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
            this.writeDebug(`Remaining buffer: ${this.buffer.length} bytes`);
        }
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
            this.writeDebug(`Added urgent message (RequestID: ${request.RequestID}) to queue at position ${insertIndex}`);
        } else {
            this.messageQueue.push(request);
            this.writeDebug(`Added normal message (RequestID: ${request.RequestID}) to queue`);
        }

        this.writeDebug(`Queue size: ${this.messageQueue.length}`);
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

        this.writeDebug(`Queue processor started with ${this.rateLimitMs}ms rate limit`);
    }

    private stopQueueProcessor(): void {
        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
            this.queueProcessor = null;
            this.writeDebug('Queue processor stopped');
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
            this.writeDebug(`Sending ${request.Urgent ? 'urgent' : 'normal'} message (RequestID: ${request.RequestID}, ${request.Data.length} bytes)`);
            this.writeDebug(`Message data: ${request.toHexString()}`);

            // Change this line to send the complete HCI message
            this.socket.write(request.getRequest());

        } catch (error) {
            console.error(`Failed to send message: ${error}`);
        }
    }

    private processMessage(message: Buffer): void {
        // Delegate to ProcessResponse class
        this.processResponse.processMessage(message);
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
        this.writeDebug(`Cleared ${clearedCount} messages from queue`);
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
        this.writeDebug(`Disconnected from ${this.address}:${this.port}`);
    }

    getStatus(): string {
        return this.connected ? 'Connected' : 'Disconnected';
    }

    getConnectedPort(): number | null {
        return this.port;
    }
}

export default EclipseHCI;