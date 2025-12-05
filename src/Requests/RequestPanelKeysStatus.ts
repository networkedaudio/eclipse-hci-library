import HCIRequest from '../HCIRequest';

class RequestPanelKeysStatus extends HCIRequest {
    public Slot: number;
    public PortOffset: number;

    constructor(slot: number, portOffset: number, urgent: boolean = false, responseID?: number) {
        // Validate parameters
        if (slot < 0 || slot > 255) {
            throw new Error(`Slot must be between 0 and 255, got ${slot}`);
        }

        if (portOffset < 0 || portOffset > 255) {
            throw new Error(`Port offset must be between 0 and 255, got ${portOffset}`);
        }

        // Create the payload buffer
        const payload = Buffer.allocUnsafe(2);
        let offset = 0;

        // Slot (1 byte)
        payload.writeUInt8(slot, offset);
        offset += 1;

        // Port offset (1 byte)
        payload.writeUInt8(portOffset, offset);

        // Call parent constructor with Message ID 177 (0x00B1)
        super(0x00B1, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestPanelKeysStatus
        this.ProtocolVersion = 1;

        this.Slot = slot;
        this.PortOffset = portOffset;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestPanelKeysStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Slot: ${this.Slot}, Port Offset: ${this.PortOffset}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 2; // Slot (1) + Port offset (1)
    }

    // Get description
    public getDescription(): string {
        return `Panel Keys Status Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Request latch status of keys on a specific panel or role\n` +
            `  Slot: ${this.Slot} (Card slot number)\n` +
            `  Port Offset: ${this.PortOffset} (Port offset from first port of the card)\n` +
            `  Response: Reply Panel Keys Status with key latch states`;
    }

    // Static helper methods
    public static forPanel(slot: number, portOffset: number, urgent: boolean = false): RequestPanelKeysStatus {
        return new RequestPanelKeysStatus(slot, portOffset, urgent);
    }

    public static forSlot(slot: number, urgent: boolean = false): RequestPanelKeysStatus {
        // Request first port (offset 0) for the slot
        return new RequestPanelKeysStatus(slot, 0, urgent);
    }

    // Get the full port number (assuming standard numbering)
    public getCalculatedPortNumber(): number {
        // This would depend on the specific slot numbering scheme
        // For now, return a basic calculation - may need adjustment based on actual system
        return (this.Slot * 16) + this.PortOffset + 1; // Example calculation
    }

    // Get panel identifier string
    public getPanelIdentifier(): string {
        return `Slot ${this.Slot}, Port Offset ${this.PortOffset}`;
    }

    // Validate that the slot and port offset are reasonable
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.Slot < 0 || this.Slot > 255) {
            errors.push(`Invalid slot number: ${this.Slot} (must be 0-255)`);
        }

        if (this.PortOffset < 0 || this.PortOffset > 255) {
            errors.push(`Invalid port offset: ${this.PortOffset} (must be 0-255)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

export default RequestPanelKeysStatus;