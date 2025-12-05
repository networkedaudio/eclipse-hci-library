import HCIRequest from '../HCIRequest';

class RequestEHXControlCardStatus extends HCIRequest {

    constructor(urgent: boolean = false, responseID?: number) {
        // This request has no payload - just the protocol structure
        const payload = Buffer.alloc(0);

        // Call parent constructor with Message ID 21 (0x0015)
        super(0x0015, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestEHXControlCardStatus
        this.ProtocolVersion = 1;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestEHXControlCardStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `No payload (request EHX control card status)`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 0; // No payload for this request
    }

    // Get description
    public getDescription(): string {
        return `EHX Control Card Status Request:\n` +
            `  Purpose: Request status of all EHX control cards from the CSU\n` +
            `  Payload: None (empty)\n` +
            `  Response: Reply EHX Control Card Status message`;
    }

    // Static helper to create a request
    public static create(urgent: boolean = false): RequestEHXControlCardStatus {
        return new RequestEHXControlCardStatus(urgent);
    }
}

export default RequestEHXControlCardStatus;