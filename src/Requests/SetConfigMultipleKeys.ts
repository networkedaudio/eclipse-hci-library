import HCIRequest from '../HCIRequest';
import { LATCH_MODES, getLatchModeName, isValidLatchMode } from '../DataStructures/LatchModes';
import { ENTITY_TYPES, getEntityTypeName, isValidEntityType } from '../DataStructures/EntityTypes';

// Radio modes for KeyAction
export enum RadioMode {
    FREQ = 0,
    TXSEL = 1,
    RXSEL = 2,
    TXM_S = 3,
    RXM_S = 4
}

// Key configuration interface
export interface KeyConfig {
    region: number;                    // Region this key is on (1 byte)
    keyId: number;                     // Key ID (2 bytes)
    page: number;                      // Page this key is on (1 byte)
    entity: number;                    // Entity type (2 bytes) - use ENTITY_TYPES from DataStructures
    entityName?: string;               // Human-readable entity name (auto-populated)
    keyOperation: {                    // Key Operation (4 bytes)
        unpaged: boolean;              // Bit 0: 0=paged, 1=unpaged
        textMode: boolean;             // Bit 1: 0=not displayed, 1=displayed
        dual: boolean;                 // Bit 2: 0=normal, 1=double width
        dial: boolean;                 // Bit 3: 0=dial mode off, 1=dial mode on
        latchMode: number;             // Bits 4-7: Latch mode (use LATCH_MODES constants)
        latchModeName?: string;        // Human-readable latch mode name (auto-populated)
        group: number;                 // Bits 8-11: Interlock group
        deactivating: boolean;         // Bit 12: All interlock group keys may be off
        makeBreak: boolean;            // Bit 13: Make before break
        crossPage: boolean;            // Bit 14: Keys interlocked across pages
        special1: boolean;             // Bit 15: IFB listen mode (0=Return, 1=Destination)
        special2: boolean;             // Bit 16: Set to 0
        regionValue: number;           // Bits 17-19: Region for page key
        pageValue: number;             // Bits 20-23: Page value for page key
        stackedGroup: boolean;         // Bit 24: Stacked group indicator
        // Bits 25-31: Unused
    };
    keyConfig: {                       // Key Config (26 bytes)
        systemNumber: number;          // System number (1 byte)
        // unused spare (1 byte) - handled internally
        specificUse: number;           // Entity-specific data (2 bytes)
        secondaryDcc: number;          // Secondary DCC/DialCode (2 bytes)
        keyAction: {                   // Key Action (2 bytes)
            forceListen: boolean;      // Bit 0: Force listen
            talk: boolean;             // Bit 1: Talk enable
            listen: boolean;           // Bit 2: Listen enable
            holdToTalk: boolean;       // Bit 3: Hold to talk
            initialState: boolean;     // Bit 4: Initial state selected
            assignLocally: boolean;    // Bit 5: Assign locally enable
            assignRemotely: boolean;   // Bit 6: Assign remotely enable
            locallyAssigned: boolean;  // Bit 7: Currently locally assigned
            radioMode: RadioMode;      // Bits 8-10: Radio mode
            // Bits 11-15: Reserved
        };
        guid: string;                  // Unique ECS GUID (16 bytes as hex string)
    };
}

class SetConfigMultipleKeys extends HCIRequest {
    public Slot: number;
    public Port: number;
    public EndpointType?: number;
    public SchemaVersion: 1 | 2;
    public Keys: KeyConfig[];

    constructor(
        slot: number,
        port: number,
        keys: KeyConfig[],
        schemaVersion: 1 | 2 = 2,
        endpointType?: number,
        urgent: boolean = false,
        responseID?: number
    ) {
        // Validate parameters
        if (slot < 0 || slot > 255) {
            throw new Error(`Slot must be between 0 and 255, got ${slot}`);
        }
        if (port < 0 || port > 255) {
            throw new Error(`Port must be between 0 and 255, got ${port}`);
        }
        if (keys.length === 0 || keys.length > 255) {
            throw new Error(`Keys count must be between 1 and 255, got ${keys.length}`);
        }
        if (schemaVersion === 2 && endpointType !== undefined && (endpointType < 0 || endpointType > 65535)) {
            throw new Error(`EndpointType must be between 0 and 65535, got ${endpointType}`);
        }

        // Validate and enrich each key configuration
        keys.forEach((key, index) => {
            SetConfigMultipleKeys.validateKeyConfig(key, index);
            SetConfigMultipleKeys.enrichKeyConfig(key);
        });

        // Calculate payload size
        let payloadSize = 3; // Slot(1) + Port(1) + Count(1)
        if (schemaVersion === 2) {
            payloadSize += 2; // EndpointType(2)
        }

        // Each key: Region(1) + KeyId(2) + Page(1) + Entity(2) + KeyOperation(4) + KeyConfig(26) = 36 bytes
        payloadSize += keys.length * 36;

        const payload = Buffer.allocUnsafe(payloadSize);
        let offset = 0;

        // Slot (1 byte)
        payload.writeUInt8(slot, offset);
        offset += 1;

        // Port (1 byte)
        payload.writeUInt8(port, offset);
        offset += 1;

        // Endpoint Type (2 bytes) - only for schema 2
        if (schemaVersion === 2) {
            payload.writeUInt16BE(endpointType || 0, offset);
            offset += 2;
        }

        // Count (1 byte)
        payload.writeUInt8(keys.length, offset);
        offset += 1;

        // Write each key configuration
        keys.forEach(key => {
            offset = SetConfigMultipleKeys.writeKeyConfig(payload, offset, key);
        });

        // Call parent constructor with Message ID 205 (0x00CD)
        super(0x00CD, payload, urgent, responseID);

        // Set version to 2 for HCIv2
        this.HCIVersion = 2;
        this.ProtocolVersion = schemaVersion;

        this.Slot = slot;
        this.Port = port;
        this.EndpointType = endpointType;
        this.SchemaVersion = schemaVersion;
        this.Keys = keys;
    }

    private static validateKeyConfig(key: KeyConfig, index: number): void {
        const prefix = `Key ${index + 1}:`;

        if (key.region < 0 || key.region > 255) {
            throw new Error(`${prefix} Region must be between 0 and 255, got ${key.region}`);
        }
        if (key.keyId < 0 || key.keyId > 65535) {
            throw new Error(`${prefix} KeyId must be between 0 and 65535, got ${key.keyId}`);
        }
        if (key.page < 0 || key.page > 255) {
            throw new Error(`${prefix} Page must be between 0 and 255, got ${key.page}`);
        }

        // Validate entity type using DataStructures
        if (!isValidEntityType(key.entity)) {
            throw new Error(`${prefix} Invalid entity type: ${key.entity}. Must be one of: ${Object.values(ENTITY_TYPES).join(', ')}`);
        }

        // Validate key operation fields
        const op = key.keyOperation;

        // Validate latch mode using DataStructures
        if (!isValidLatchMode(op.latchMode)) {
            throw new Error(`${prefix} Invalid latch mode: ${op.latchMode}. Must be one of: ${Object.keys(LATCH_MODES).join(', ')}`);
        }

        if (op.group < 0 || op.group > 15) {
            throw new Error(`${prefix} Group must be between 0 and 15, got ${op.group}`);
        }
        if (op.regionValue < 0 || op.regionValue > 7) {
            throw new Error(`${prefix} RegionValue must be between 0 and 7, got ${op.regionValue}`);
        }
        if (op.pageValue < 0 || op.pageValue > 15) {
            throw new Error(`${prefix} PageValue must be between 0 and 15, got ${op.pageValue}`);
        }

        // Validate key config fields
        const config = key.keyConfig;
        if (config.systemNumber < 0 || config.systemNumber > 255) {
            throw new Error(`${prefix} SystemNumber must be between 0 and 255, got ${config.systemNumber}`);
        }
        if (config.specificUse < 0 || config.specificUse > 65535) {
            throw new Error(`${prefix} SpecificUse must be between 0 and 65535, got ${config.specificUse}`);
        }
        if (config.secondaryDcc < 0 || config.secondaryDcc > 65535) {
            throw new Error(`${prefix} SecondaryDcc must be between 0 and 65535, got ${config.secondaryDcc}`);
        }
        if (!Object.values(RadioMode).includes(config.keyAction.radioMode)) {
            throw new Error(`${prefix} Invalid RadioMode: ${config.keyAction.radioMode}`);
        }

        // Validate GUID format (32 hex characters)
        if (!/^[0-9A-Fa-f]{32}$/.test(key.keyConfig.guid)) {
            throw new Error(`${prefix} GUID must be 32 hex characters, got "${key.keyConfig.guid}"`);
        }
    }

    private static enrichKeyConfig(key: KeyConfig): void {
        // Add human-readable names for entity and latch mode
        key.entityName = getEntityTypeName(key.entity);
        key.keyOperation.latchModeName = getLatchModeName(key.keyOperation.latchMode);
    }

    private static writeKeyConfig(payload: Buffer, offset: number, key: KeyConfig): number {
        // Region (1 byte)
        payload.writeUInt8(key.region, offset);
        offset += 1;

        // Key ID (2 bytes)
        payload.writeUInt16BE(key.keyId, offset);
        offset += 2;

        // Page (1 byte)
        payload.writeUInt8(key.page, offset);
        offset += 1;

        // Entity (2 bytes)
        payload.writeUInt16BE(key.entity, offset);
        offset += 2;

        // Key Operation (4 bytes)
        const op = key.keyOperation;
        let keyOperation = 0;

        if (op.unpaged) keyOperation |= (1 << 0);
        if (op.textMode) keyOperation |= (1 << 1);
        if (op.dual) keyOperation |= (1 << 2);
        if (op.dial) keyOperation |= (1 << 3);
        keyOperation |= (op.latchMode & 0x0F) << 4;
        keyOperation |= (op.group & 0x0F) << 8;
        if (op.deactivating) keyOperation |= (1 << 12);
        if (op.makeBreak) keyOperation |= (1 << 13);
        if (op.crossPage) keyOperation |= (1 << 14);
        if (op.special1) keyOperation |= (1 << 15);
        if (op.special2) keyOperation |= (1 << 16);
        keyOperation |= (op.regionValue & 0x07) << 17;
        keyOperation |= (op.pageValue & 0x0F) << 20;
        if (op.stackedGroup) keyOperation |= (1 << 24);

        payload.writeUInt32BE(keyOperation, offset);
        offset += 4;

        // Key Config (26 bytes)
        const config = key.keyConfig;

        // System Number (1 byte)
        payload.writeUInt8(config.systemNumber, offset);
        offset += 1;

        // Unused Spare (1 byte) - set to 0
        payload.writeUInt8(0, offset);
        offset += 1;

        // Specific Use (2 bytes)
        payload.writeUInt16BE(config.specificUse, offset);
        offset += 2;

        // Secondary DCC (2 bytes)
        payload.writeUInt16BE(config.secondaryDcc, offset);
        offset += 2;

        // Key Action (2 bytes)
        const action = config.keyAction;
        let keyAction = 0;

        if (action.forceListen) keyAction |= (1 << 0);
        if (action.talk) keyAction |= (1 << 1);
        if (action.listen) keyAction |= (1 << 2);
        if (action.holdToTalk) keyAction |= (1 << 3);
        if (action.initialState) keyAction |= (1 << 4);
        if (action.assignLocally) keyAction |= (1 << 5);
        if (action.assignRemotely) keyAction |= (1 << 6);
        if (action.locallyAssigned) keyAction |= (1 << 7);
        keyAction |= (action.radioMode & 0x07) << 8;

        payload.writeUInt16BE(keyAction, offset);
        offset += 2;

        // GUID (16 bytes)
        const guidBuffer = Buffer.from(config.guid, 'hex');
        if (guidBuffer.length !== 16) {
            throw new Error(`GUID must be exactly 16 bytes (32 hex chars), got ${guidBuffer.length} bytes`);
        }
        guidBuffer.copy(payload, offset);
        offset += 16;

        return offset;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `SetConfigMultipleKeys - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Slot: ${this.Slot}, Port: ${this.Port}, Keys: ${this.Keys.length}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        let size = 3; // Slot + Port + Count
        if (this.SchemaVersion === 2) size += 2; // EndpointType
        size += this.Keys.length * 36; // 36 bytes per key
        return size;
    }

    // Get description
    public getDescription(): string {
        const schemaInfo = this.SchemaVersion === 2 ? `, EndpointType: ${this.EndpointType || 0}` : '';

        return `Set Config for Multiple Keys Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: Configure multiple keys with advanced properties\n` +
            `  Target: Slot ${this.Slot}, Port ${this.Port}${schemaInfo}\n` +
            `  Schema Version: ${this.SchemaVersion}\n` +
            `  Key Count: ${this.Keys.length}\n` +
            `  Configuration Includes:\n` +
            `    - Latch modes and activation types\n` +
            `    - Interlock groups and behavior\n` +
            `    - Talk/Listen permissions\n` +
            `    - Page switching and region mapping\n` +
            `    - Entity assignments and GUIDs\n` +
            `    - Advanced key operations and display modes`;
    }



    // Convenience methods for common entity types





    // Validate that all configurations are proper
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.Slot < 0 || this.Slot > 255) {
            errors.push(`Invalid slot number: ${this.Slot} (must be 0-255)`);
        }

        if (this.Port < 0 || this.Port > 255) {
            errors.push(`Invalid port number: ${this.Port} (must be 0-255)`);
        }

        if (this.Keys.length === 0) {
            errors.push('No keys provided for configuration');
        } else if (this.Keys.length > 255) {
            errors.push(`Too many keys: ${this.Keys.length} (maximum 255)`);
        }

        if (this.SchemaVersion === 2 && this.EndpointType !== undefined) {
            if (this.EndpointType < 0 || this.EndpointType > 65535) {
                errors.push(`Invalid endpoint type: ${this.EndpointType} (must be 0-65535)`);
            }
        }

        // Validate each key
        this.Keys.forEach((key, index) => {
            try {
                SetConfigMultipleKeys.validateKeyConfig(key, index);
            } catch (error) {
                errors.push((error as Error).message);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Get panel identifier string
    public getPanelIdentifier(): string {
        return `Slot ${this.Slot}, Port ${this.Port}`;
    }

    // Get key configuration summary with DataStructure names
    public getKeyConfigSummary(): string {
        if (this.Keys.length === 0) {
            return 'No keys configured';
        }

        const regions = [...new Set(this.Keys.map(k => k.region))].sort();
        const pages = [...new Set(this.Keys.map(k => k.page))].sort();
        const entityNames = [...new Set(this.Keys.map(k => k.entityName))];
        const latchModeNames = [...new Set(this.Keys.map(k => k.keyOperation.latchModeName))];

        return `Key Configuration Summary:\n` +
            `  Total Keys: ${this.Keys.length}\n` +
            `  Regions: ${regions.join(', ')}\n` +
            `  Pages: ${pages.join(', ')}\n` +
            `  Entity Types: ${entityNames.join(', ')}\n` +
            `  Latch Modes: ${latchModeNames.join(', ')}\n` +
            `  Schema Version: ${this.SchemaVersion}`;
    }

    // Get detailed key breakdown
    public getDetailedKeyBreakdown(): string {
        if (this.Keys.length === 0) {
            return 'No keys configured';
        }

        let breakdown = `Detailed Key Configuration (${this.Keys.length} keys):\n`;

        this.Keys.forEach((key, index) => {
            breakdown += `  ${index + 1}. R${key.region}K${key.keyId}P${key.page}:\n`;
            breakdown += `     Entity: ${key.entityName} (${key.entity})\n`;
            breakdown += `     Latch Mode: ${key.keyOperation.latchModeName} (${key.keyOperation.latchMode})\n`;
            breakdown += `     System: ${key.keyConfig.systemNumber}, Specific: ${key.keyConfig.specificUse}\n`;

            const permissions = [];
            if (key.keyConfig.keyAction.talk) permissions.push('Talk');
            if (key.keyConfig.keyAction.listen) permissions.push('Listen');
            if (key.keyConfig.keyAction.forceListen) permissions.push('Force Listen');
            if (key.keyConfig.keyAction.holdToTalk) permissions.push('Hold to Talk');

            breakdown += `     Permissions: ${permissions.join(', ') || 'None'}\n`;

            if (key.keyOperation.group > 0) {
                breakdown += `     Interlock Group: ${key.keyOperation.group}\n`;
            }

            if (key.keyOperation.regionValue > 0 || key.keyOperation.pageValue > 0) {
                breakdown += `     Page Switch: R${key.keyOperation.regionValue}P${key.keyOperation.pageValue}\n`;
            }
        });

        return breakdown;
    }

    // Get human-readable summary
    public getSummary(): string {
        return `Set Multiple Keys Configuration:\n` +
            `  Target: ${this.getPanelIdentifier()}\n` +
            `  Keys: ${this.Keys.length} configurations\n` +
            `  Schema: v${this.SchemaVersion}\n` +
            `  Endpoint Type: ${this.EndpointType || 'N/A'}\n` +
            `  Will configure: Key properties, latch modes, permissions, assignments`;
    }

    // Get configuration complexity assessment
    public getComplexityAssessment(): 'simple' | 'moderate' | 'complex' {
        let complexity = 0;

        // Count different regions and pages
        const regions = new Set(this.Keys.map(k => k.region)).size;
        const pages = new Set(this.Keys.map(k => k.page)).size;

        complexity += regions > 1 ? 1 : 0;
        complexity += pages > 1 ? 1 : 0;
        complexity += this.Keys.length > 10 ? 1 : 0;

        // Check for advanced features
        const hasAdvancedFeatures = this.Keys.some(k =>
            k.keyOperation.group > 0 ||
            k.keyOperation.deactivating ||
            k.keyOperation.crossPage ||
            k.keyOperation.stackedGroup ||
            k.keyOperation.special1 ||
            k.keyOperation.dual
        );

        if (hasAdvancedFeatures) complexity += 2;

        if (complexity <= 1) return 'simple';
        if (complexity <= 3) return 'moderate';
        return 'complex';
    }
}

export default SetConfigMultipleKeys;