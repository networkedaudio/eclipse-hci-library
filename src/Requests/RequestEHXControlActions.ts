import HCIRequest from '../HCIRequest';

interface EHXControlAction {
    direction: 'add' | 'delete';    // Direction bit: 0 = delete, 1 = add
    pinNumber: number;              // Pin number (0-31)
    cardNumber: number;             // Card number (0-31)
    mapType: 'enable' | 'inhibit';  // Map type: 0 = enable, 1 = inhibit
}

class RequestEHXControlActions extends HCIRequest {
    public Actions: EHXControlAction[];

    constructor(actions: EHXControlAction[] = [], urgent: boolean = false, responseID?: number) {
        // Validate actions before calling super
        if (actions.length === 0) {
            throw new Error('Must specify at least one EHX control action');
        }

        for (const action of actions) {
            RequestEHXControlActions.validateActionStatic(action);
        }

        // Create the payload buffer
        const payload = RequestEHXControlActions.createPayload(actions);

        // Call parent constructor with Message ID 17 (0x0011)
        super(0x0011, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestEHXControlActions
        this.ProtocolVersion = 1;

        this.Actions = [...actions]; // Create a copy of the array
    }

    private validateAction(action: EHXControlAction): void {
        RequestEHXControlActions.validateActionStatic(action);
    }

    private static validateActionStatic(action: EHXControlAction): void {
        if (action.pinNumber < 0 || action.pinNumber > 31) {
            throw new Error(`Pin number must be between 0 and 31, got ${action.pinNumber}`);
        }

        if (action.cardNumber < 0 || action.cardNumber > 31) {
            throw new Error(`Card number must be between 0 and 31, got ${action.cardNumber}`);
        }

        if (action.direction !== 'add' && action.direction !== 'delete') {
            throw new Error(`Direction must be 'add' or 'delete', got '${action.direction}'`);
        }

        if (action.mapType !== 'enable' && action.mapType !== 'inhibit') {
            throw new Error(`Map type must be 'enable' or 'inhibit', got '${action.mapType}'`);
        }
    }

    private static createPayload(actions: EHXControlAction[]): Buffer {
        // Count (2 bytes): number of actions
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(actions.length, 0);

        // Action data - each action entry
        const actionBuffers: Buffer[] = [];

        for (const action of actions) {
            // Each action is:
            // - Action Type (2 bytes): 0x0004
            // - Action (8 bytes): 4 x 16-bit words

            const actionBuffer = Buffer.allocUnsafe(10); // 2 + 8 bytes
            let offset = 0;

            // Action Type (2 bytes) - set to 0x0004
            actionBuffer.writeUInt16BE(0x0004, offset);
            offset += 2;

            // Word 0 (2 bytes) - direction and fixed bit pattern
            let word0 = 0;
            word0 |= (action.direction === 'add' ? 1 : 0) << 0;  // bit 0: direction
            // bits 1-3: set to 0 (already 0)
            word0 |= 1 << 4;   // bit 4: set to 1
            // bits 5-9: set to 0 (already 0)
            word0 |= 1 << 10;  // bit 10: set to 1
            // bits 11-12: set to 0 (already 0)
            word0 |= 1 << 13;  // bit 13: set to 1
            // bits 14-15: set to 0 (already 0)

            actionBuffer.writeUInt16BE(word0, offset);
            offset += 2;

            // Word 1 (2 bytes) - pin number and card number
            let word1 = 0;
            word1 |= (action.pinNumber & 0x1F) << 0;     // bits 0-4: pin number (0-31)
            // bits 5-7: set to 0 (already 0)
            word1 |= (action.cardNumber & 0x1F) << 8;    // bits 8-12: card number (0-31)
            // bits 13-15: set to 0 (already 0)

            actionBuffer.writeUInt16BE(word1, offset);
            offset += 2;

            // Word 2 (2 bytes) - set to 0
            actionBuffer.writeUInt16BE(0x0000, offset);
            offset += 2;

            // Word 3 (2 bytes) - fixed bit pattern and map type
            let word3 = 0;
            // bit 0: set to 0 (already 0)
            word3 |= 1 << 1;   // bit 1: set to 1
            // bit 2: set to 0 (already 0)
            word3 |= 0x7F << 3; // bits 3-9: set to 1 (0x7F = 0111_1111)
            // bit 10: set to 0 (already 0)
            word3 |= (action.mapType === 'inhibit' ? 1 : 0) << 11; // bit 11: map type
            // bit 12: set to 0 (already 0)
            word3 |= 0x3 << 13; // bits 13-14: set to 1 (0x3 = 11)
            // bit 15: set to 0 (already 0)

            actionBuffer.writeUInt16BE(word3, offset);

            actionBuffers.push(actionBuffer);
        }

        // Combine count + all action data
        const actionData = Buffer.concat(actionBuffers);
        return Buffer.concat([countBuffer, actionData]);
    }

    // Add an action to the request
    public addAction(action: EHXControlAction): void {
        this.validateAction(action);
        this.Actions.push(action);
        this.updatePayload();
    }

    // Remove an action by index
    public removeAction(index: number): boolean {
        if (index >= 0 && index < this.Actions.length) {
            this.Actions.splice(index, 1);

            if (this.Actions.length === 0) {
                throw new Error('Must have at least one EHX control action');
            }

            this.updatePayload();
            return true;
        }
        return false;
    }

    // Clear all actions and set new ones
    public setActions(actions: EHXControlAction[]): void {
        if (actions.length === 0) {
            throw new Error('Must specify at least one EHX control action');
        }

        for (const action of actions) {
            this.validateAction(action);
        }

        this.Actions = [...actions];
        this.updatePayload();
    }

    private updatePayload(): void {
        // Update the Data buffer with new actions
        this.Data = RequestEHXControlActions.createPayload(this.Actions);
    }

    // Get action count
    public getActionCount(): number {
        return this.Actions.length;
    }

    // Helper method to display the request details
    public override toString(): string {
        const actionList = this.Actions.length <= 3
            ? `[${this.Actions.map(a => `${a.direction}:C${a.cardNumber}P${a.pinNumber}:${a.mapType}`).join(', ')}]`
            : `[${this.Actions.slice(0, 3).map(a => `${a.direction}:C${a.cardNumber}P${a.pinNumber}:${a.mapType}`).join(', ')}, ...and ${this.Actions.length - 3} more]`;

        return `RequestEHXControlActions - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Action Count: ${this.Actions.length}, Actions: ${actionList}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Count (2) + (Action (10) * count)
        return 2 + (this.Actions.length * 10);
    }

    // Get actions description
    public getActionsDescription(): string {
        if (this.Actions.length === 0) {
            return 'No EHX control actions';
        }

        const descriptions = this.Actions.map((action, index) => {
            return `${index + 1}. ${action.direction.toUpperCase()} Card ${action.cardNumber}, Pin ${action.pinNumber} (${action.mapType})`;
        });

        return descriptions.join('\n');
    }

    // Convenience methods for common operations
    public addEHXControl(cardNumber: number, pinNumber: number, mapType: 'enable' | 'inhibit' = 'enable'): void {
        this.addAction({
            direction: 'add',
            cardNumber,
            pinNumber,
            mapType
        });
    }

    public deleteEHXControl(cardNumber: number, pinNumber: number, mapType: 'enable' | 'inhibit' = 'enable'): void {
        this.addAction({
            direction: 'delete',
            cardNumber,
            pinNumber,
            mapType
        });
    }

    // Static helper methods
    public static singleAction(
        direction: 'add' | 'delete',
        cardNumber: number,
        pinNumber: number,
        mapType: 'enable' | 'inhibit' = 'enable',
        urgent: boolean = false
    ): RequestEHXControlActions {
        return new RequestEHXControlActions([{
            direction,
            cardNumber,
            pinNumber,
            mapType
        }], urgent);
    }

    public static forActions(actions: EHXControlAction[], urgent: boolean = false): RequestEHXControlActions {
        return new RequestEHXControlActions(actions, urgent);
    }

    // Static helpers for common use cases
    public static addControl(cardNumber: number, pinNumber: number, mapType: 'enable' | 'inhibit' = 'enable', urgent: boolean = false): RequestEHXControlActions {
        return RequestEHXControlActions.singleAction('add', cardNumber, pinNumber, mapType, urgent);
    }

    public static deleteControl(cardNumber: number, pinNumber: number, mapType: 'enable' | 'inhibit' = 'enable', urgent: boolean = false): RequestEHXControlActions {
        return RequestEHXControlActions.singleAction('delete', cardNumber, pinNumber, mapType, urgent);
    }

    // Get detailed bit breakdown for debugging
    public getActionBitBreakdown(index: number): string {
        if (index < 0 || index >= this.Actions.length) {
            throw new Error(`Invalid action index: ${index}`);
        }

        const action = this.Actions[index];

        // Calculate the words as they would appear in the payload
        let word0 = 0;
        word0 |= (action.direction === 'add' ? 1 : 0) << 0;
        word0 |= 1 << 4;
        word0 |= 1 << 10;
        word0 |= 1 << 13;

        let word1 = 0;
        word1 |= (action.pinNumber & 0x1F) << 0;
        word1 |= (action.cardNumber & 0x1F) << 8;

        const word2 = 0x0000;

        let word3 = 0;
        word3 |= 1 << 1;
        word3 |= 0x7F << 3;
        word3 |= (action.mapType === 'inhibit' ? 1 : 0) << 11;
        word3 |= 0x3 << 13;

        return `Action ${index + 1} bit breakdown:\n` +
            `  Word 0: 0x${word0.toString(16).padStart(4, '0')} (${word0.toString(2).padStart(16, '0')})\n` +
            `  Word 1: 0x${word1.toString(16).padStart(4, '0')} (${word1.toString(2).padStart(16, '0')})\n` +
            `  Word 2: 0x${word2.toString(16).padStart(4, '0')} (${word2.toString(2).padStart(16, '0')})\n` +
            `  Word 3: 0x${word3.toString(16).padStart(4, '0')} (${word3.toString(2).padStart(16, '0')})`;
    }
}

export default RequestEHXControlActions;
export { EHXControlAction };