import HCIRequest from '../HCIRequest';

class RequestInputLevelStatus extends HCIRequest {

    constructor(urgent: boolean = false, responseID?: number) {
        // This request has no payload - just the protocol structure
        const payload = Buffer.alloc(0);

        // Call parent constructor with Message ID 33 (0x0021)
        super(0x0021, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestInputLevelStatus
        this.ProtocolVersion = 1;
    }

    // Helper method to display the request details
    public toString(): string {
        return `RequestInputLevelStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `No payload (request all input level status)`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 0; // No payload for this request
    }

    // Get description
    public getDescription(): string {
        return `Input Level Status Request:\n` +
            `  Message ID: 0x${this.MessageID.toString(16).padStart(4, '0')} (${this.MessageID})\n` +
            `  Purpose: Request current settings of all audio input levels from the CSU\n` +
            `  Payload: None (empty)\n` +
            `  Response: Reply Input Level Status message with all current input levels`;
    }

    // Static helper to create a request
    public static create(urgent: boolean = false): RequestInputLevelStatus {
        return new RequestInputLevelStatus(urgent);
    }
}

export default RequestInputLevelStatus;