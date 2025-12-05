import HCIRequest from '../HCIRequest';

class RequestSystemMessages extends HCIRequest {

    constructor(urgent: boolean = false, responseID?: number) {
        // This request has a 2-byte unused field as payload
        const payload = Buffer.allocUnsafe(2);
        payload.writeUInt16BE(0, 0); // Unused field set to 0

        // Call parent constructor with Message ID 2 (0x0002)
        super(0x0002, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestSystemMessages
        this.ProtocolVersion = 1;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestSystemMessages - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Payload: 2 bytes (unused field)`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 2; // Unused 16-bit word
    }

    // Get description
    public getDescription(): string {
        return `System Messages Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Request system messages/alerts from the CSU\n` +
            `  Payload: 2 bytes (unused field, set to 0)\n` +
            `  Response: Reply System Messages with current system alerts and messages`;
    }

    // Static helper to create a request
    public static create(urgent: boolean = false): RequestSystemMessages {
        return new RequestSystemMessages(urgent);
    }
}

export default RequestSystemMessages;