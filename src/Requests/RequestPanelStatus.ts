import HCIRequest from '../HCIRequest';

class RequestPanelStatus extends HCIRequest {

    constructor(urgent: boolean = false, responseID?: number) {
        // This request has no payload - just the protocol structure
        const payload = Buffer.alloc(0);

        // Call parent constructor with Message ID 5 (0x0005)
        super(0x0005, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestPanelStatus
        this.ProtocolVersion = 1;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestPanelStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `No payload (request panel/endpoint status)`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 0; // No payload for this request
    }

    // Get description
    public getDescription(): string {
        return `Panel Status Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Request current state (online/offline) of all panels/endpoints from the CSU\n` +
            `  Payload: None (empty)\n` +
            `  Response: Reply Panel Status message with panel availability information`;
    }

    // Static helper to create a request
    public static create(urgent: boolean = false): RequestPanelStatus {
        return new RequestPanelStatus(urgent);
    }
}

export default RequestPanelStatus;