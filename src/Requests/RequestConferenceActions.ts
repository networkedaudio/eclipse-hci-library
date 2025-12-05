import HCIRequest from '../HCIRequest';

interface ConferenceAction {
    direction: 'add' | 'delete';
    portNumber: number;     // 10-bit port number (0-1023)
    mode: 'listen' | 'talk';
    conferenceNumber: number; // 10-bit conference number (0-1023)
}

class RequestConferenceActions extends HCIRequest {
    public Actions: ConferenceAction[];

    constructor(actions: ConferenceAction[] = [], urgent: boolean = false, responseID?: number) {
        // Create the payload buffer - this is just the middle part
        const payload = RequestConferenceActions.createPayload(actions);

        // Call parent constructor with Message ID 17 (0x0011)
        super(0x0011, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;
        this.Actions = actions;
    }

    private static createPayload(actions: ConferenceAction[]): Buffer {
        // Protocol Tag (4 bytes): 0xABBACEDE
        const protocolTag = Buffer.from([0xAB, 0xBA, 0xCE, 0xDE]);

        // Protocol Schema (1 byte): set to 1
        const protocolSchema = Buffer.from([0x01]);

        // Count (2 bytes): number of actions
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(actions.length, 0);

        // Action Data - each action is 10 bytes (Action Type + 4 words)
        const actionDataBuffers: Buffer[] = [];

        for (const action of actions) {
            // Action Type (2 bytes): set to 0x0020
            const actionTypeBuffer = Buffer.allocUnsafe(2);
            actionTypeBuffer.writeUInt16BE(0x0020, 0);

            // Action: 4 x 16 bit words (8 bytes total)
            const actionBuffer = Buffer.allocUnsafe(8);

            // Word 0
            let word0 = 0;
            // bit 0: direction (0 = delete, 1 = add)
            if (action.direction === 'add') {
                word0 |= 0x0001;
            }
            // bits 1,2: port number bits 8 & 9
            word0 |= ((action.portNumber >> 8) & 0x03) << 1;
            // bit 3: mode (0 = listen, 1 = talk)
            if (action.mode === 'talk') {
                word0 |= 0x0008;
            }
            // bits 4-9: set to 0 (already 0)
            // bit 10: set to 1
            word0 |= 0x0400;
            // bits 11-12: conference number bits 8 & 9
            word0 |= ((action.conferenceNumber >> 8) & 0x03) << 11;
            // bits 13-15: set to 0 (already 0)

            actionBuffer.writeUInt16BE(word0, 0);

            // Word 1
            let word1 = 0;
            // bits 0-7: port number bits 0-7
            word1 |= action.portNumber & 0xFF;
            // bits 8-13: conference number bits 0-5
            word1 |= ((action.conferenceNumber & 0x3F) << 8);
            // bits 14,15: set to 0 (already 0)

            actionBuffer.writeUInt16BE(word1, 2);

            // Words 2 & 3: set to 0
            actionBuffer.writeUInt16BE(0, 4);
            actionBuffer.writeUInt16BE(0, 6);

            // Combine Action Type + Action data
            actionDataBuffers.push(Buffer.concat([actionTypeBuffer, actionBuffer]));
        }

        // Combine all parts
        const actionData = Buffer.concat(actionDataBuffers);
        return Buffer.concat([protocolTag, protocolSchema, countBuffer, actionData]);
    }

    // Add a new conference action
    public addAction(action: ConferenceAction): void {
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

    // Helper method to add a conference member
    public addConferenceMember(portNumber: number, conferenceNumber: number, mode: 'listen' | 'talk' = 'talk'): void {
        this.addAction({
            direction: 'add',
            portNumber,
            mode,
            conferenceNumber
        });
    }

    // Helper method to remove a conference member
    public removeConferenceMember(portNumber: number, conferenceNumber: number, mode: 'listen' | 'talk' = 'talk'): void {
        this.addAction({
            direction: 'delete',
            portNumber,
            mode,
            conferenceNumber
        });
    }

    private updatePayload(): void {
        // Update the Data buffer with new actions
        this.Data = RequestConferenceActions.createPayload(this.Actions);
    }

    // Helper method to validate port and conference numbers
    private static validateNumbers(portNumber: number, conferenceNumber: number): boolean {
        return portNumber >= 0 && portNumber <= 1023 &&
            conferenceNumber >= 0 && conferenceNumber <= 1023;
    }

    // Get a description of all actions
    public getActionsDescription(): string {
        if (this.Actions.length === 0) {
            return 'No conference actions';
        }

        const descriptions = this.Actions.map((action, index) => {
            return `${index + 1}. ${action.direction.toUpperCase()} Port ${action.portNumber} ${action.mode} on Conference ${action.conferenceNumber}`;
        });

        return `Conference Actions (${this.Actions.length}):\n${descriptions.join('\n')}`;
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestConferenceActions - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Actions: ${this.Actions.length}, ${this.getActionsDescription()}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Protocol Tag (4) + Protocol Schema (1) + Count (2) + (Action Type (2) + Action Data (8)) * count
        return 4 + 1 + 2 + (this.Actions.length * 10);
    }
}

export default RequestConferenceActions;