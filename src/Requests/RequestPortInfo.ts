//@ts-nocheck
import HCIRequest from '../HCIRequest';

class RequestPortInfo extends HCIRequest {
    public SlotNumber: number;

    constructor(slotNumber: number, urgent: boolean = false, responseID?: number) {
        // Validate parameters
        if (slotNumber < 0 || slotNumber > 65535) {
            throw new Error(`Slot number must be between 0 and 65535, got ${slotNumber}`);
        }

        // Create the payload buffer
        // Slot Number (2 bytes)
        const payload = Buffer.allocUnsafe(2);
        let offset = 0;

        // Slot Number (2 bytes)
        payload.writeUInt16BE(slotNumber, offset);

        // Call parent constructor with Message ID 183 (0x00B7)
        super(0x00B7, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestPortInfo
        this.ProtocolVersion = 1;

        this.SlotNumber = slotNumber;
    }

    // Helper method to display the request details
    public toString(): string {
        return `RequestPortInfo - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Slot Number: ${this.SlotNumber}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 2; // Slot Number (2 bytes)
    }

    // Get description
    public getDescription(): string {
        return `Port Information Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Request connected port type and additional port information\n` +
            `  Slot Number: ${this.SlotNumber}\n` +
            `  Information Requested:\n` +
            `    - Port type (panel, interface, trunk, FreeSpeak BP)\n` +
            `    - Firmware information\n` +
            `    - Port settings\n` +
            `  Response: Reply Port Info with detailed port information`;
    }

    // Static helper methods
    public static forSlot(slotNumber: number, urgent: boolean = false): RequestPortInfo {
        return new RequestPortInfo(slotNumber, urgent, 1);
    }

    // Get slot identifier string
    public getSlotIdentifier(): string {
        return `Slot ${this.SlotNumber}`;
    }

    // Validate that the slot number is reasonable
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.SlotNumber < 0 || this.SlotNumber > 65535) {
            errors.push(`Invalid slot number: ${this.SlotNumber} (must be 0-65535)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Helper methods for common slot ranges (assuming typical configurations)
    public static forMainProcessorSlots(urgent: boolean = false): RequestPortInfo[] {
        // Typically slots 0-7 might be main processor cards
        const requests: RequestPortInfo[] = [];
        for (let slot = 0; slot <= 7; slot++) {
            requests.push(new RequestPortInfo(slot, urgent));
        }
        return requests;
    }

    public static forInterfaceSlots(startSlot: number = 8, endSlot: number = 15, urgent: boolean = false): RequestPortInfo[] {
        // Interface cards might be in a different range
        const requests: RequestPortInfo[] = [];
        for (let slot = startSlot; slot <= endSlot; slot++) {
            requests.push(new RequestPortInfo(slot, urgent));
        }
        return requests;
    }

    public static forAllSlots(maxSlot: number = 31, urgent: boolean = false): RequestPortInfo[] {
        // Request info for all slots up to maxSlot
        const requests: RequestPortInfo[] = [];
        for (let slot = 0; slot <= maxSlot; slot++) {
            requests.push(new RequestPortInfo(slot, urgent));
        }
        return requests;
    }

    // Check if this is likely a processor slot (based on common numbering schemes)
    public isLikelyProcessorSlot(): boolean {
        // Typically processor cards are in lower slot numbers
        return this.SlotNumber <= 7;
    }

    // Check if this is likely an interface slot
    public isLikelyInterfaceSlot(): boolean {
        // Interface cards are often in higher slot numbers
        return this.SlotNumber >= 8 && this.SlotNumber <= 31;
    }

    // Get expected port types for this slot (for validation)
    public getExpectedPortTypes(): string[] {
        if (this.isLikelyProcessorSlot()) {
            return ['CPU Master', 'CPU Slave', 'System'];
        } else if (this.isLikelyInterfaceSlot()) {
            return ['Panel', 'Interface', 'Trunk', 'FreeSpeak BP', 'E-MADI', 'E-DANTE', 'E-IPA'];
        } else {
            return ['Unknown', 'Panel', 'Interface', 'Trunk', 'FreeSpeak BP'];
        }
    }
}

export default RequestPortInfo;