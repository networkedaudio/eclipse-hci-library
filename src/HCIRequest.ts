class HCIRequest {
    public RequestID: number;
    public ResponseID: number | null;
    public Version: number = 2;
    public ProtocolVersion: number = 1;
    public Data: Buffer;
    public Urgent: boolean;
    public Timestamp: number;

    constructor(requestID: number, data: Buffer, urgent: boolean = false, responseID?: number) {
        this.RequestID = requestID;
        this.ResponseID = responseID || null;
        this.Data = data;
        this.Urgent = urgent;
        this.Timestamp = Date.now(); // For ordering within same priority
    }

    // Helper method to get total message size
    getMessageSize(): number {
        return this.Data.length;
    }

    // Helper method to convert to hex string for debugging
    toHexString(): string {
        return this.Data.toString('hex').replace(/../g, '0x$& ').trim();
    }

    // Create complete HCI message package
    getRequest(flags: number = 0x00): Buffer {
        const startBytes = Buffer.from([0x5A, 0x0F]);
        const endBytes = Buffer.from([0x2E, 0x8D]);

        // Set the G bit (bit 3 = 0x08)
        const finalFlags = flags | 0x08; // Set G bit to true

        let messageBuffer: Buffer;

        if (this.Version === 2) {
            // HCIv2 message structure:
            // Start (2) + Length (2) + MessageID (2) + Flags (1) + Preamble (4) + Protocol (1) + Data + End (2)
            const preamble = Buffer.from([0xAB, 0xBA, 0xCE, 0xDE]);
            const protocol = Buffer.from([this.ProtocolVersion]); // Use ProtocolVersion property

            const headerSize = startBytes.length + 2 + 2 + 1 + preamble.length + protocol.length;
            const totalLength = headerSize + this.Data.length + endBytes.length;

            messageBuffer = Buffer.allocUnsafe(totalLength);
            let offset = 0;

            // Start bytes
            startBytes.copy(messageBuffer, offset);
            offset += startBytes.length;

            // Length field (total message length including start and end bytes)
            messageBuffer.writeUInt16BE(totalLength, offset);
            offset += 2;

            // Message ID (RequestID)
            messageBuffer.writeUInt16BE(this.RequestID, offset);
            offset += 2;

            // Flags byte with G bit set
            messageBuffer.writeUInt8(finalFlags, offset);
            offset += 1;

            // HCIv2 preamble
            preamble.copy(messageBuffer, offset);
            offset += preamble.length;

            // Protocol version
            protocol.copy(messageBuffer, offset);
            offset += protocol.length;

            // Data payload
            this.Data.copy(messageBuffer, offset);
            offset += this.Data.length;

            // End bytes
            endBytes.copy(messageBuffer, offset);

        } else {
            // HCIv1 message structure:
            // Start (2) + Length (2) + MessageID (2) + Flags (1) + Data + End (2)
            const headerSize = startBytes.length + 2 + 2 + 1;
            const totalLength = headerSize + this.Data.length + endBytes.length;

            messageBuffer = Buffer.allocUnsafe(totalLength);
            let offset = 0;

            // Start bytes
            startBytes.copy(messageBuffer, offset);
            offset += startBytes.length;

            // Length field (total message length including start and end bytes)
            messageBuffer.writeUInt16BE(totalLength, offset);
            offset += 2;

            // Message ID (RequestID)
            messageBuffer.writeUInt16BE(this.RequestID, offset);
            offset += 2;

            // Flags byte with G bit set
            messageBuffer.writeUInt8(finalFlags, offset);
            offset += 1;

            // Data payload
            this.Data.copy(messageBuffer, offset);
            offset += this.Data.length;

            // End bytes
            endBytes.copy(messageBuffer, offset);
        }

        return messageBuffer;
    }
}

export default HCIRequest;