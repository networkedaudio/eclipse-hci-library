import HCIRequest from '../HCIRequest';
import LevelConversion from '../Utilities/LevelConversion';

interface CrosspointLevelAction {
    destinationPort: number;  // 1-1024 (user-friendly, will be converted to 0-1023 for message)
    sourcePort: number;       // 1-1024 (user-friendly, will be converted to 0-1023 for message)
    levelValue: number;       // 0-287 level value (or use dB conversion)
}

class RequestCrosspointLevelActions extends HCIRequest {
    public Actions: CrosspointLevelAction[];

    constructor(actions: CrosspointLevelAction[] = [], urgent: boolean = false, responseID?: number) {
        // Create the payload buffer - this is just the middle part
        const payload = RequestCrosspointLevelActions.createPayload(actions);

        // Call parent constructor with Message ID 38 (0x0026)
        super(0x0026, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestCrosspointLevelActions
        this.ProtocolVersion = 1;

        this.Actions = actions;
    }

    private static createPayload(actions: CrosspointLevelAction[]): Buffer {
        // Count (2 bytes): number of actions
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(actions.length, 0);

        // Action data - each action is 6 bytes (dest port + source port + level)
        const actionBuffers: Buffer[] = [];

        for (const action of actions) {
            // Validate ports (1-1024 for user, 0-1023 for message)
            if (action.destinationPort < 1 || action.destinationPort > 1024) {
                throw new Error(`Destination port must be between 1 and 1024, got ${action.destinationPort}`);
            }
            if (action.sourcePort < 1 || action.sourcePort > 1024) {
                throw new Error(`Source port must be between 1 and 1024, got ${action.sourcePort}`);
            }

            // Validate level value (0-287, but message format says 0-255, we'll use 0-287 to match conversion table)
            if (!LevelConversion.isValidLevel(action.levelValue)) {
                throw new Error(`Level value must be between 0 and 287, got ${action.levelValue}`);
            }

            const actionBuffer = Buffer.allocUnsafe(6);

            // Destination Port (2 bytes) - convert from 1-indexed to 0-indexed
            actionBuffer.writeUInt16BE(action.destinationPort - 1, 0);

            // Source Port (2 bytes) - convert from 1-indexed to 0-indexed  
            actionBuffer.writeUInt16BE(action.sourcePort - 1, 2);

            // Level Value (2 bytes)
            actionBuffer.writeUInt16BE(action.levelValue, 4);

            actionBuffers.push(actionBuffer);
        }

        // Combine count + all action data
        const actionData = Buffer.concat(actionBuffers);
        return Buffer.concat([countBuffer, actionData]);
    }

    // Add an action to the request
    public addAction(action: CrosspointLevelAction): void {
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

    // Convenience method to add a crosspoint level action using dB
    public addLevelActionDB(destinationPort: number, sourcePort: number, dB: number): void {
        const levelValue = LevelConversion.dBToLevel(dB);
        this.addAction({
            destinationPort,
            sourcePort,
            levelValue
        });
    }

    // Convenience method to add a crosspoint level action using raw level
    public addLevelAction(destinationPort: number, sourcePort: number, levelValue: number): void {
        this.addAction({
            destinationPort,
            sourcePort,
            levelValue
        });
    }

    // Convenience method to cut audio (set to CUT level)
    public addCutAction(destinationPort: number, sourcePort: number): void {
        this.addAction({
            destinationPort,
            sourcePort,
            levelValue: LevelConversion.CUT
        });
    }

    // Convenience method to set unity gain
    public addUnityAction(destinationPort: number, sourcePort: number): void {
        this.addAction({
            destinationPort,
            sourcePort,
            levelValue: LevelConversion.UNITY
        });
    }

    private updatePayload(): void {
        // Update the Data buffer with new actions
        this.Data = RequestCrosspointLevelActions.createPayload(this.Actions);
    }

    // Get action count
    public getActionCount(): number {
        return this.Actions.length;
    }

    // Helper method to display the request details
    public toString(): string {
        const actionList = this.Actions.length <= 5
            ? `[${this.Actions.map(a => `${a.sourcePort}→${a.destinationPort}@${a.levelValue}`).join(', ')}]`
            : `[${this.Actions.slice(0, 5).map(a => `${a.sourcePort}→${a.destinationPort}@${a.levelValue}`).join(', ')}, ...and ${this.Actions.length - 5} more]`;

        return `RequestCrosspointLevelActions - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Action Count: ${this.Actions.length}, Actions: ${actionList}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Count (2) + (Action (6) * count)
        return 2 + (this.Actions.length * 6);
    }

    // Get actions description
    public getActionsDescription(): string {
        if (this.Actions.length === 0) {
            return 'No actions';
        }

        const descriptions = this.Actions.map((action, index) => {
            const dB = LevelConversion.levelToDB(action.levelValue);
            const dbStr = LevelConversion.formatDB(dB);
            return `${index + 1}. Port ${action.sourcePort} → Port ${action.destinationPort} @ ${dbStr} (Level ${action.levelValue})`;
        });

        return descriptions.join('\n');
    }

    // Static helper to create a request for specific level actions
    public static forActions(actions: CrosspointLevelAction[], urgent: boolean = false): RequestCrosspointLevelActions {
        return new RequestCrosspointLevelActions(actions, urgent);
    }

    // Static helper to create a single level action request using dB
    public static singleActionDB(destinationPort: number, sourcePort: number, dB: number, urgent: boolean = false): RequestCrosspointLevelActions {
        const levelValue = LevelConversion.dBToLevel(dB);
        return new RequestCrosspointLevelActions([{
            destinationPort,
            sourcePort,
            levelValue
        }], urgent);
    }

    // Static helper to create a single level action request using raw level
    public static singleAction(destinationPort: number, sourcePort: number, levelValue: number, urgent: boolean = false): RequestCrosspointLevelActions {
        return new RequestCrosspointLevelActions([{
            destinationPort,
            sourcePort,
            levelValue
        }], urgent);
    }
}

export default RequestCrosspointLevelActions;
export { CrosspointLevelAction };