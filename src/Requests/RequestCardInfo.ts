import HCIRequest from '../HCIRequest';

class RequestCardInfo extends HCIRequest {
    public Slot: number;

    constructor(slot: number, urgent: boolean = false, responseID?: number) {
        // Validate parameters
        if (slot < 0 || slot > 255) {
            throw new Error(`Slot must be between 0 and 255, got ${slot}`);
        }

        // Create the payload buffer
        // Slot (1 byte) = 1 byte total
        const payload = Buffer.allocUnsafe(1);

        // Slot (1 byte)
        payload.writeUInt8(slot, 0);

        // Call parent constructor with Message ID 195 (0x00C3)
        super(0x00C3, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestCardInfo
        this.ProtocolVersion = 1;

        this.Slot = slot;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestCardInfo - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, Slot: ${this.Slot}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 1; // Slot (1 byte)
    }

    // Get description
    public getDescription(): string {
        return `Card Info Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Retrieve card information and health status for specified slot\n` +
            `  Slot: ${this.Slot} (Card slot number)\n` +
            `  Information Retrieved:\n` +
            `    - Card type and model information\n` +
            `    - Hardware revision and firmware version\n` +
            `    - Operational status and health metrics\n` +
            `    - Port configuration and availability\n` +
            `    - Error status and diagnostic information\n` +
            `  Response: Reply Card Info with complete card details`;
    }

    // Static helper methods
    public static forSlot(slot: number, urgent: boolean = false): RequestCardInfo {
        return new RequestCardInfo(slot, urgent);
    }

    public static forMultipleSlots(slots: number[], urgent: boolean = false): RequestCardInfo[] {
        return slots.map(slot => new RequestCardInfo(slot, urgent));
    }

    public static forSlotRange(startSlot: number, endSlot: number, urgent: boolean = false): RequestCardInfo[] {
        const requests: RequestCardInfo[] = [];
        for (let slot = startSlot; slot <= endSlot; slot++) {
            requests.push(new RequestCardInfo(slot, urgent));
        }
        return requests;
    }

    public static forAllSlots(maxSlots: number = 32, urgent: boolean = false): RequestCardInfo[] {
        const requests: RequestCardInfo[] = [];
        for (let slot = 1; slot <= maxSlots; slot++) {
            requests.push(new RequestCardInfo(slot, urgent));
        }
        return requests;
    }

    // Validate that the slot is reasonable
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.Slot < 0 || this.Slot > 255) {
            errors.push(`Invalid slot number: ${this.Slot} (must be 0-255)`);
        }

        // Slot 0 might be valid for some systems (CPU slot), but flag as potentially unusual
        if (this.Slot === 0) {
            errors.push(`Warning: Slot 0 requested (may be CPU/system slot)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Get card slot identifier string
    public getSlotIdentifier(): string {
        return `Slot ${this.Slot}`;
    }

    // Get expected response information
    public getExpectedResponseInfo(): string {
        return `Expected Response for ${this.getSlotIdentifier()}:\n` +
            `  - Message ID: 196 (0x00C4) Reply Card Info\n` +
            `  - Card type and hardware information\n` +
            `  - Firmware version and revision details\n` +
            `  - Operational status and health metrics\n` +
            `  - Port configuration and capabilities\n` +
            `  - Error status and diagnostic codes\n` +
            `  - Performance statistics and metrics`;
    }

    // Get request priority based on slot importance
    public getRequestPriority(): 'high' | 'normal' | 'low' {
        // Higher priority for lower slot numbers (often more critical cards)
        if (this.Slot <= 2) {
            return 'high';  // CPU/system cards
        } else if (this.Slot <= 8) {
            return 'normal'; // Primary I/O cards
        } else {
            return 'low';    // Expansion cards
        }
    }

    // Check if this slot is likely a system/CPU slot
    public isLikelySystemSlot(): boolean {
        // System/CPU slots are typically in the first few positions
        return this.Slot <= 2;
    }

    // Check if this slot is likely an I/O card slot
    public isLikelyIOSlot(): boolean {
        // I/O cards are typically in mid-range slots
        return this.Slot >= 3 && this.Slot <= 16;
    }

    // Check if this slot is likely an expansion slot
    public isLikelyExpansionSlot(): boolean {
        // Expansion slots are typically in higher numbered positions
        return this.Slot > 16;
    }

    // Get slot category description
    public getSlotCategory(): string {
        if (this.isLikelySystemSlot()) {
            return 'System/CPU Slot';
        } else if (this.isLikelyIOSlot()) {
            return 'I/O Card Slot';
        } else if (this.isLikelyExpansionSlot()) {
            return 'Expansion Slot';
        } else {
            return 'Unknown Slot Category';
        }
    }

    // Get human-readable summary
    public getSummary(): string {
        const priority = this.getRequestPriority();
        const category = this.getSlotCategory();

        return `Card Info Request:\n` +
            `  Slot: ${this.Slot} (${category})\n` +
            `  Priority: ${priority.toUpperCase()}\n` +
            `  Will retrieve: Card type, health status, port configuration\n` +
            `  Expected data: Hardware info, firmware version, operational status`;
    }

    // Get recommended polling interval based on slot type
    public getRecommendedPollingInterval(): number {
        // Return interval in seconds
        if (this.isLikelySystemSlot()) {
            return 30;   // Poll system cards more frequently
        } else if (this.isLikelyIOSlot()) {
            return 60;   // Poll I/O cards regularly
        } else {
            return 300;  // Poll expansion cards less frequently
        }
    }

    // Get health check importance level
    public getHealthCheckImportance(): 'critical' | 'important' | 'normal' {
        if (this.isLikelySystemSlot()) {
            return 'critical';
        } else if (this.isLikelyIOSlot()) {
            return 'important';
        } else {
            return 'normal';
        }
    }
}

export default RequestCardInfo;