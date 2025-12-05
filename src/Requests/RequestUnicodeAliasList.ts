import HCIRequest from '../HCIRequest';

class RequestUnicodeAliasList extends HCIRequest {

    constructor(urgent: boolean = false, responseID?: number) {
        // This request has no payload - just the protocol structure
        const payload = Buffer.alloc(0);

        // Call parent constructor with Message ID 246 (0x00F6)
        super(0x00F6, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestUnicodeAliasList
        this.ProtocolVersion = 1;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestUnicodeAliasList - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `No payload (list all aliases)`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 0; // No payload for this request
    }

    // Get description
    public getDescription(): string {
        return `Unicode Alias List Request:\n` +
            `  Purpose: Request list of all Unicode aliases from the matrix\n` +
            `  Payload: None (empty)\n` +
            `  Response: ReplyUnicodeAliasStatus with U flag clear`;
    }

    // Static helper to create a request
    public static create(urgent: boolean = false): RequestUnicodeAliasList {
        return new RequestUnicodeAliasList(urgent);
    }
}

export default RequestUnicodeAliasList;