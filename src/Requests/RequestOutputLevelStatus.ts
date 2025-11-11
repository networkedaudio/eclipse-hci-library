import HCIRequest from '../HCIRequest';

class RequestOutputLevelStatus extends HCIRequest {

    constructor(urgent: boolean = false, responseID?: number) {
        // This request has no payload - just the protocol structure
        const payload = Buffer.alloc(0);

        // Call parent constructor with Message ID 36 (0x0024)
        super(0x0024, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestOutputLevelStatus
        this.ProtocolVersion = 1;
    }

    // Helper method to display the request details
    public toString(): string {
        return `RequestOutputLevelStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `No payload (request all output level status)`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 0; // No payload for this request
    }

    // Get description
    public getDescription(): string {
        return `Output Level Status Request:\n` +
            `  Purpose: Request current settings of all audio output levels from the CSU\n` +
            `  Payload: None (empty)\n` +
            `  Response: Reply Output Level Status message with all non-zero output levels\n` +
            `  Note: Only non-zero values will be included in the reply`;
    }

    // Static helper to create a request
    public static create(urgent: boolean = false): RequestOutputLevelStatus {
        return new RequestOutputLevelStatus(urgent);
    }
}

export default RequestOutputLevelStatus;