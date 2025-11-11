import HCIResponse from '../HCIResponse';

class ProcessResponse {
    private eclipseHCI: any;

    constructor(eclipseHCI: any) {
        this.eclipseHCI = eclipseHCI;
    }

    // Debug method that only outputs when showDebug is true on the EclipseHCI instance
    private writeDebug(message: string, ...args: any[]): void {
        if (this.eclipseHCI && this.eclipseHCI.showDebug) {
            console.log(message, ...args);
        }
    }

    processMessage(message: Buffer): void {
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
                    this.writeDebug('HCIv2 message too short for protocol version byte');
                }
            }
        } else {
            this.writeDebug('Message too short for HCIv2 signature, assuming HCIv1');
        }

        this.writeDebug(`Valid message received (${message.length} bytes):`, message.toString('hex'));
        this.writeDebug(`Message ID: 0x${messageID.toString(16).padStart(4, '0')} (${messageID})`);
        this.writeDebug(`HCI Version: ${hciVersion}`);
        if (protocolVersion !== null) {
            this.writeDebug(`Protocol Version: ${protocolVersion}`);
        }
        this.writeDebug(`Flags byte: 0x${flagsByte.toString(16).padStart(2, '0')} (${flagsByte.toString(2).padStart(8, '0')})`);

        // Display which flags are set
        const setFlags = Object.entries(flags).filter(([key, value]) => value).map(([key, value]) => key);
        if (setFlags.length > 0) {
            this.writeDebug(`Flags set: ${setFlags.join(', ')}`);
        } else {
            this.writeDebug('No flags set');
        }

        // Extract payload (remove end bytes)
        const payloadEnd = message.length - endBytes.length;

        if (payloadEnd <= payloadStart) {
            this.writeDebug('Message contains no payload');
            return;
        }

        const payload = message.subarray(payloadStart, payloadEnd);

        this.writeDebug(`Payload (${payload.length} bytes):`, payload.toString('hex'));

        // Use HCIResponse to handle the message, passing 'this' for event emission
        HCIResponse.handleMessageByID(messageID, flags, payload, hciVersion, protocolVersion, this.eclipseHCI);
    }
}

export default ProcessResponse;