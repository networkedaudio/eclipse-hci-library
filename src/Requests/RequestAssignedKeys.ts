import HCIRequest from '../HCIRequest';

class RequestAssignedKeys extends HCIRequest {
    public Slot: number;
    public Port: number;

    constructor(slot: number, port: number, schemaVersion: 1 | 2 = 1, urgent: boolean = false, responseID?: number) {
        // Validate parameters
        if (slot < 0 || slot > 255) {
            throw new Error(`Slot must be between 0 and 255, got ${slot}`);
        }

        if (port < 0 || port > 255) {
            throw new Error(`Port must be between 0 and 255, got ${port}`);
        }

        if (schemaVersion !== 1 && schemaVersion !== 2) {
            throw new Error(`Schema version must be 1 or 2, got ${schemaVersion}`);
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

        // Call parent constructor with Message ID 231 (0x00E7)
        super(0x00E7, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to requested schema version
        this.ProtocolVersion = schemaVersion;

        this.Slot = slot;
        this.Port = port;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestAssignedKeys - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Slot: ${this.Slot}, Port: ${this.Port}, Schema: ${this.ProtocolVersion}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 2; // Slot (1) + Port (1)
    }

    // Get description
    public getDescription(): string {
        return `Assigned Keys Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Request all assigned key configurations for selected panel\n` +
            `  Slot: ${this.Slot} (Card slot number)\n` +
            `  Port: ${this.Port} (Port offset from first port of the card)\n` +
            `  Schema Version: ${this.ProtocolVersion}\n` +
            `  Assigned Keys Include:\n` +
            `    - Map configuration downloaded baseline\n` +
            `    - HCI API assignments (overlaid)\n` +
            `    - Online assignments (overlaid)\n` +
            `    - Panel-based assignments (overlaid)\n` +
            `    - Net result of all assignment sources\n` +
            `  Response: Reply Assigned Keys with complete key configuration\n` +
            `  Schema 1: Basic key information\n` +
            `  Schema 2: Extended key information with additional details`;
    }

    // Static helper methods
    public static forPanel(slot: number, port: number, schemaVersion: 1 | 2 = 1, urgent: boolean = false): RequestAssignedKeys {
        return new RequestAssignedKeys(slot, port, schemaVersion, urgent);
    }

    public static forPanelWithSchema1(slot: number, port: number, urgent: boolean = false): RequestAssignedKeys {
        return new RequestAssignedKeys(slot, port, 1, urgent);
    }

    public static forPanelWithSchema2(slot: number, port: number, urgent: boolean = false): RequestAssignedKeys {
        return new RequestAssignedKeys(slot, port, 2, urgent);
    }

    public static forSlot(slot: number, schemaVersion: 1 | 2 = 1, urgent: boolean = false): RequestAssignedKeys {
        // Request assigned keys for first port (offset 0) of the slot
        return new RequestAssignedKeys(slot, 0, schemaVersion, urgent);
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

        if (this.ProtocolVersion !== 1 && this.ProtocolVersion !== 2) {
            errors.push(`Invalid schema version: ${this.ProtocolVersion} (must be 1 or 2)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Helper methods for common use cases
    public static forMultiplePanels(panels: { slot: number; port: number; schemaVersion?: 1 | 2 }[], urgent: boolean = false): RequestAssignedKeys[] {
        return panels.map(panel => new RequestAssignedKeys(
            panel.slot,
            panel.port,
            panel.schemaVersion || 1,
            urgent
        ));
    }

    public static forAllPortsInSlot(slot: number, maxPorts: number = 16, schemaVersion: 1 | 2 = 1, urgent: boolean = false): RequestAssignedKeys[] {
        const requests: RequestAssignedKeys[] = [];
        for (let port = 0; port < maxPorts; port++) {
            requests.push(new RequestAssignedKeys(slot, port, schemaVersion, urgent));
        }
        return requests;
    }

    public static forSlotRange(startSlot: number, endSlot: number, port: number = 0, schemaVersion: 1 | 2 = 1, urgent: boolean = false): RequestAssignedKeys[] {
        const requests: RequestAssignedKeys[] = [];
        for (let slot = startSlot; slot <= endSlot; slot++) {
            requests.push(new RequestAssignedKeys(slot, port, schemaVersion, urgent));
        }
        return requests;
    }

    // Get assignment type description (for documentation purposes)
    public getAssignmentSources(): string[] {
        return [
            'Map configuration downloaded baseline',
            'HCI API assignments',
            'Online assignments',
            'Panel-based assignments',
            'Net result of all sources'
        ];
    }

    // Get expected response information based on schema version
    public getExpectedResponseInfo(): string {
        const baseInfo = `Expected Response for ${this.getPanelIdentifier()}:\n` +
            `  - Message ID: 232 (0x00E8) Reply Assigned Keys\n` +
            `  - Schema Version: ${this.ProtocolVersion}\n` +
            `  - Complete key assignment details for all assigned keys\n` +
            `  - Net result of all assignment sources\n`;

        if (this.ProtocolVersion === 1) {
            return baseInfo +
                `  - Schema 1 provides: Basic key information\n` +
                `    * Key identifiers and basic configuration\n` +
                `    * Assignment status and entity types\n` +
                `    * Key operational parameters`;
        } else {
            return baseInfo +
                `  - Schema 2 provides: Extended key information\n` +
                `    * All Schema 1 information plus:\n` +
                `    * Additional assignment metadata\n` +
                `    * Extended configuration parameters\n` +
                `    * Assignment source tracking\n` +
                `    * Historical assignment information`;
        }
    }

    // Check if this request targets a likely panel port
    public isLikelyPanelPort(): boolean {
        // This is a heuristic - actual determination would require port info
        // Panel ports are typically in lower slot numbers and specific port ranges
        return this.Slot >= 8 && this.Slot <= 31 && this.Port >= 0 && this.Port <= 15;
    }

    // Get request priority based on panel importance
    public getRequestPriority(): 'high' | 'normal' | 'low' {
        // Higher priority for lower slot/port numbers (often more critical panels)
        if (this.Slot <= 7 || (this.Slot <= 15 && this.Port === 0)) {
            return 'high';
        } else if (this.Slot <= 23) {
            return 'normal';
        } else {
            return 'low';
        }
    }

    // Get schema version description
    public getSchemaDescription(): string {
        if (this.ProtocolVersion === 1) {
            return 'Schema 1: Basic assigned key information with standard configuration parameters';
        } else {
            return 'Schema 2: Extended assigned key information with additional metadata and source tracking';
        }
    }

    // Get human-readable summary
    public getSummary(): string {
        const priority = this.getRequestPriority();
        const assignmentSources = this.getAssignmentSources();

        return `Assigned Keys Request:\n` +
            `  Panel: ${this.getPanelIdentifier()}\n` +
            `  Schema: ${this.ProtocolVersion} (${this.getSchemaDescription()})\n` +
            `  Priority: ${priority.toUpperCase()}\n` +
            `  Will retrieve: Net result of ${assignmentSources.length} assignment sources\n` +
            `  Assignment sources: ${assignmentSources.join(', ')}`;
    }

    // Compare with locally assigned keys request
    public getComparisonWithLocalKeys(): string {
        return `Comparison with Locally Assigned Keys:\n` +
            `  RequestLocallyAssignedKeys (0x00B9):\n` +
            `    - Shows only locally assigned keys (non-map assignments)\n` +
            `    - EHX online, HCI API, panel fast assign, scroll groups\n` +
            `    - Excludes map configuration baseline\n` +
            `  RequestAssignedKeys (0x00E7):\n` +
            `    - Shows ALL assigned keys (complete configuration)\n` +
            `    - Map baseline + all local assignments overlaid\n` +
            `    - Net result of all assignment sources\n` +
            `    - Complete operational key configuration`;
    }

    // Get recommended usage
    public getRecommendedUsage(): string {
        return `Recommended Usage:\n` +
            `  Use Schema 1 for:\n` +
            `    - Basic key configuration queries\n` +
            `    - Performance-sensitive applications\n` +
            `    - Simple key state monitoring\n` +
            `  Use Schema 2 for:\n` +
            `    - Detailed configuration analysis\n` +
            `    - Assignment source tracking\n` +
            `    - Configuration management tools\n` +
            `    - Troubleshooting assignment conflicts`;
    }
}

export default RequestAssignedKeys;