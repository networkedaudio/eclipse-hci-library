import HCIRequest from '../HCIRequest';

enum ResetType {
    RED = 0x01,    // Bit 0 = 1
    BLACK = 0x02,  // Bit 1 = 1
    BOTH = 0x03    // Bits 0 and 1 = 1
}

class RequestCPUReset extends HCIRequest {
    public ResetType: number;

    constructor(resetType: ResetType = ResetType.RED, urgent: boolean = false, responseID?: number) {


        // Create the payload buffer - just the reset type byte
        const payload = Buffer.allocUnsafe(1);
        payload.writeUInt8(resetType, 0);

        // Call parent constructor with Message ID 41 (0x0029)
        super(0x0029, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestCPUReset
        this.ProtocolVersion = 1;

        this.ResetType = resetType;
    }

    // Get reset type description
    public getResetTypeDescription(): string {
        const types: string[] = [];

        if (this.ResetType & ResetType.RED) {
            types.push('Red CPU');
        }

        if (this.ResetType & ResetType.BLACK) {
            types.push('Black CPU');
        }

        return types.length > 0 ? types.join(' + ') : 'No CPUs selected';
    }



    // Get payload size in bytes
    public getPayloadSize(): number {
        return 1; // Just the reset type byte
    }

    // Static helper methods for common reset types
    public static redCPUReset(urgent: boolean = false): RequestCPUReset {
        return new RequestCPUReset(ResetType.RED, urgent);
    }

    public static blackCPUReset(urgent: boolean = false): RequestCPUReset {
        return new RequestCPUReset(ResetType.BLACK, urgent);
    }

}

export default RequestCPUReset;
export { ResetType };