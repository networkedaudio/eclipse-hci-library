import HCIRequest from '../HCIRequest';

interface CrosspointAction {
    direction: 'add' | 'delete';
    destinationPort: number;    // 10-bit port number (0-1023)
    sourcePort: number;         // 10-bit port number (0-1023)
    enableDisable: 'enable' | 'inhibit';
    priority: number;           // 3-bit priority (0-7), typically 1, 2, or 3
}

class RequestCrosspointActions extends HCIRequest {
    public Actions: CrosspointAction[];

    constructor(actions: CrosspointAction[] = [], urgent: boolean = false, responseID?: number) {
        // Create the payload buffer - this is just the middle part
        const payload = RequestCrosspointActions.createPayload(actions);

        // Call parent constructor with Message ID 17 (0x0011)
        super(0x0011, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 2 for RequestCrosspointActions
        this.ProtocolVersion = 2;

        this.Actions = actions;
    }

    private static createPayload(actions: CrosspointAction[]): Buffer {
        // Count (2 bytes): number of actions
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(actions.length, 0);

        // Action Data - each action is 10 bytes (Action Type + 4 words)
        const actionDataBuffers: Buffer[] = [];

        for (const action of actions) {
            // Validate port numbers
            if (!RequestCrosspointActions.validatePorts(action.sourcePort, action.destinationPort)) {
                throw new Error(`Invalid port numbers: source=${action.sourcePort}, dest=${action.destinationPort}`);
            }

            // Validate priority
            if (action.priority < 0 || action.priority > 7) {
                throw new Error(`Priority must be 0-7, got ${action.priority}`);
            }

            // Action Type (2 bytes): set to 0x0001
            const actionTypeBuffer = Buffer.allocUnsafe(2);
            actionTypeBuffer.writeUInt16BE(0x0001, 0);

            // Action: 4 x 16 bit words (8 bytes total)
            const actionBuffer = Buffer.allocUnsafe(8);

            // Word 0
            let word0 = 0;
            // bit 0: direction (0 = delete, 1 = add)
            if (action.direction === 'add') {
                word0 |= 0x0001;
            }
            // bits 1,2: destination port number bits 8,9
            word0 |= ((action.destinationPort >> 8) & 0x03) << 1;
            // bits 3-9: set to 0 (already 0)
            // bit 10: set to 1
            word0 |= 0x0400;
            // bits 11,12: source port number bits 8,9
            word0 |= ((action.sourcePort - 1 >> 8) & 0x03) << 11;
            // bit 13: set to 1
            word0 |= 0x2000;
            // bit 14: set to 0 (already 0)
            // bit 15: set to 0 (already 0)

            actionBuffer.writeUInt16BE(word0, 0);

            // Word 1
            let word1 = 0;
            // bits 0-7: destination port number bits 0-7
            word1 |= action.destinationPort - 1 & 0xFF;
            // bits 8-15: source port number bits 0-7
            word1 |= (action.sourcePort - 1 & 0xFF) << 8;

            actionBuffer.writeUInt16BE(word1, 2);

            // Word 2: bits 0-15 set to 0
            actionBuffer.writeUInt16BE(0x0000, 4);

            // Word 3
            let word3 = 0;
            // bit 0: set to 0 (already 0)
            // bit 1: set to 1
            word3 |= 0x0002;
            // bit 2: set to 0 (already 0)
            // bits 3-9: set to 1
            word3 |= 0x03F8; // bits 3-9 = 0000001111111000 = 0x03F8
            // bit 10: set to 0 (already 0)
            // bit 11: enable/disable (0 = enable, 1 = inhibit)
            if (action.enableDisable === 'inhibit') {
                word3 |= 0x0800;
            }
            // bit 12: set to 0 (already 0)
            // bits 13-15: crosspoint priority
            word3 |= (action.priority & 0x07) << 13;

            actionBuffer.writeUInt16BE(word3, 6);

            // Combine Action Type + Action data
            actionDataBuffers.push(Buffer.concat([actionTypeBuffer, actionBuffer]));
        }

        // Combine count + all action data
        const actionData = Buffer.concat(actionDataBuffers);
        return Buffer.concat([countBuffer, actionData]);
    }

    // Add a new crosspoint action
    public addAction(action: CrosspointAction): void {
        this.Actions.push(action);
        this.updatePayload();
    }

    // Remove an action by index
    public removeAction(index: number): boolean {
        if (index >= 0 && index < this.Actions.length) {
            this.Actions.splice(index, 1);
            this.updatePayload();
            return true;
        }
        return false;
    }

    // Clear all actions
    public clearActions(): void {
        this.Actions = [];
        this.updatePayload();
    }

    // Helper method to add a crosspoint connection
    public addCrosspoint(sourcePort: number, destinationPort: number, enable: boolean = true, priority: number = 1): void {
        this.addAction({
            direction: 'add',
            sourcePort,
            destinationPort,
            enableDisable: enable ? 'enable' : 'inhibit',
            priority
        });
    }

    // Helper method to remove a crosspoint connection
    public removeCrosspoint(sourcePort: number, destinationPort: number, priority: number = 1): void {
        this.addAction({
            direction: 'delete',
            sourcePort,
            destinationPort,
            enableDisable: 'enable', // direction matters more than enable/disable for delete
            priority
        });
    }

    private updatePayload(): void {
        // Update the Data buffer with new actions
        this.Data = RequestCrosspointActions.createPayload(this.Actions);
    }

    // Helper method to validate port numbers
    private static validatePorts(sourcePort: number, destinationPort: number): boolean {
        return sourcePort > 0 && sourcePort <= 1024 &&
            destinationPort > 0 && destinationPort <= 1024;
    }

    // Get a description of all actions
    public getActionsDescription(): string {
        if (this.Actions.length === 0) {
            return 'No crosspoint actions';
        }

        const descriptions = this.Actions.map((action, index) => {
            return `${index + 1}. ${action.direction.toUpperCase()} crosspoint: Port ${action.sourcePort} → Port ${action.destinationPort} (${action.enableDisable}, priority ${action.priority})`;
        });

        return `Crosspoint Actions (${this.Actions.length}):\n${descriptions.join('\n')}`;
    }

    // Helper method to display the request details
    public toString(): string {
        return `RequestCrosspointActions - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Actions: ${this.Actions.length}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Count (2) + (Action Type (2) + Action Data (8)) * count
        return 2 + (this.Actions.length * 10);
    }

    // Helper methods for priority management
    public static readonly PRIORITY_STANDARD = 1;
    public static readonly PRIORITY_LOCAL_CSU_2 = 2;
    public static readonly PRIORITY_LOCAL_CSU_3 = 3;

    // Get actions by priority
    public getActionsByPriority(priority: number): CrosspointAction[] {
        return this.Actions.filter(action => action.priority === priority);
    }
}

export default RequestCrosspointActions;