import HCIRequest from '../HCIRequest';

class RequestLocallyAssignedKeys extends HCIRequest {
    public Slot: number;
    public Port: number;

    constructor(slot: number, port: number, urgent: boolean = false, responseID?: number) {
        // Validate parameters
        if (slot < 0 || slot > 255) {
            throw new Error(`Slot must be between 0 and 255, got ${slot}`);
        }

        if (port < 0 || port > 255) {
            throw new Error(`Port must be between 0 and 255, got ${port}`);
        }

        // Create the payload buffer
        // Slot (1) + Port (1) = 2 bytes
        const payload = Buffer.allocUnsafe(2);
        let offset = 0;

        // Slot (1 byte)
        payload.writeUInt8(slot, offset);
        offset += 1;

        // Port (1 byte)
        payload.writeUInt8(port, offset);

        // Call parent constructor with Message ID 185 (0x00B9)
        super(0x00B9, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestLocallyAssignedKeys
        this.ProtocolVersion = 1;

        this.Slot = slot;
        this.Port = port;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestLocallyAssignedKeys - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Slot: ${this.Slot}, Port: ${this.Port}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 2; // Slot (1) + Port (1)
    }

    // Get description
    public getDescription(): string {
        return `Locally Assigned Keys Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Request all locally assigned key configurations for selected panel\n` +
            `  Slot: ${this.Slot} (Card slot number)\n` +
            `  Port: ${this.Port} (Port offset from first port of the card)\n` +
            `  Locally Assigned Keys Include:\n` +
            `    - EHX online key assignments\n` +
            `    - HCI API assignments\n` +
            `    - Panel fast key assignments\n` +
            `    - Scroll group key assignments\n` +
            `    - Other non-map configuration assignments\n` +
            `  Response: Reply Locally Assigned Keys with key configuration details`;
    }

    // Static helper methods
    public static forPanel(slot: number, port: number, urgent: boolean = false): RequestLocallyAssignedKeys {
        return new RequestLocallyAssignedKeys(slot, port, urgent);
    }

    public static forSlot(slot: number, urgent: boolean = false): RequestLocallyAssignedKeys {
        // Request locally assigned keys for first port (offset 0) of the slot
        return new RequestLocallyAssignedKeys(slot, 0, urgent);
    }

    // Get panel identifier string
    public getPanelIdentifier(): string {
        return `Slot ${this.Slot}, Port ${this.Port}`;
    }

    // Get the full port number (assuming standard numbering)
    public getCalculatedPortNumber(): number {
        // This would depend on the specific slot numbering scheme
        // For now, return a basic calculation - may need adjustment based on actual system
        return (this.Slot * 16) + this.Port + 1; // Example calculation
    }

    // Validate that the slot and port are reasonable
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.Slot < 0 || this.Slot > 255) {
            errors.push(`Invalid slot number: ${this.Slot} (must be 0-255)`);
        }

        if (this.Port < 0 || this.Port > 255) {
            errors.push(`Invalid port number: ${this.Port} (must be 0-255)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Helper methods for common use cases
    public static forMultiplePanels(panels: { slot: number; port: number }[], urgent: boolean = false): RequestLocallyAssignedKeys[] {
        return panels.map(panel => new RequestLocallyAssignedKeys(panel.slot, panel.port, urgent));
    }




}

export default RequestLocallyAssignedKeys;