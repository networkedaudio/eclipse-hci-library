import HCIRequest from '../HCIRequest';
import LevelConversion from '../Utilities/LevelConversion';

interface InputLevelAction {
    port: number;          // Port number (1-1024, will be converted to 0-1023)
    levelValue: number;    // Level value (0-255)
    levelDB: number;       // Calculated dB value for reference
}

class RequestInputLevelActions extends HCIRequest {
    public Actions: InputLevelAction[];

    constructor(actions: InputLevelAction[] = [], urgent: boolean = false, responseID?: number) {
        // Validate actions
        if (actions.length === 0) {
            throw new Error('Must specify at least one input level action');
        }

        for (const action of actions) {
            this.validateAction(action);
        }

        // Create the payload buffer
        const payload = RequestInputLevelActions.createPayload(actions);

        // Call parent constructor with Message ID 32 (0x0020)
        super(0x0020, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestInputLevelActions
        this.ProtocolVersion = 1;

        this.Actions = [...actions]; // Create a copy of the array
    }

    private validateAction(action: InputLevelAction): void {
        if (action.port < 1 || action.port > 1024) {
            throw new Error(`Port number must be between 1 and 1024, got ${action.port}`);
        }

        if (action.levelValue < 0 || action.levelValue > 255) {
            throw new Error(`Level value must be between 0 and 255, got ${action.levelValue}`);
        }
    }

    private static createPayload(actions: InputLevelAction[]): Buffer {
        // Count (2 bytes): number of actions
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(actions.length, 0);

        // Action data - each action entry
        const actionBuffers: Buffer[] = [];

        for (const action of actions) {
            // Each action is:
            // - Port number (2 bytes): 0-1023 (convert from 1-1024)
            // - Level value (2 bytes): 0-255

            const actionBuffer = Buffer.allocUnsafe(4); // 2 + 2 bytes
            let offset = 0;

            // Port number (2 bytes) - convert from 1-indexed to 0-indexed
            actionBuffer.writeUInt16BE(action.port - 1, offset);
            offset += 2;

            // Level value (2 bytes)
            actionBuffer.writeUInt16BE(action.levelValue, offset);

            actionBuffers.push(actionBuffer);
        }

        // Combine count + all action data
        const actionData = Buffer.concat(actionBuffers);
        return Buffer.concat([countBuffer, actionData]);
    }

    // Add an action to the request
    public addAction(action: InputLevelAction): void {
        this.validateAction(action);
        this.Actions.push(action);
        this.updatePayload();
    }

    // Remove an action by index
    public removeAction(index: number): boolean {
        if (index >= 0 && index < this.Actions.length) {
            this.Actions.splice(index, 1);

            if (this.Actions.length === 0) {
                throw new Error('Must have at least one input level action');
            }

            this.updatePayload();
            return true;
        }
        return false;
    }

    // Clear all actions and set new ones
    public setActions(actions: InputLevelAction[]): void {
        if (actions.length === 0) {
            throw new Error('Must specify at least one input level action');
        }

        for (const action of actions) {
            this.validateAction(action);
        }

        this.Actions = [...actions];
        this.updatePayload();
    }

    private updatePayload(): void {
        // Update the Data buffer with new actions
        this.Data = RequestInputLevelActions.createPayload(this.Actions);
    }

    // Get action count
    public getActionCount(): number {
        return this.Actions.length;
    }

    // Helper method to display the request details
    public toString(): string {
        const actionList = this.Actions.length <= 3
            ? `[${this.Actions.map(a => `P${a.port}:${LevelConversion.formatDB(a.levelDB)}`).join(', ')}]`
            : `[${this.Actions.slice(0, 3).map(a => `P${a.port}:${LevelConversion.formatDB(a.levelDB)}`).join(', ')}, ...and ${this.Actions.length - 3} more]`;

        return `RequestInputLevelActions - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Action Count: ${this.Actions.length}, Actions: ${actionList}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Count (2) + (Action (4) * count)
        return 2 + (this.Actions.length * 4);
    }

    // Get actions description
    public getActionsDescription(): string {
        if (this.Actions.length === 0) {
            return 'No input level actions';
        }

        const descriptions = this.Actions.map((action, index) => {
            const dbStr = LevelConversion.formatDB(action.levelDB);
            return `${index + 1}. Port ${action.port}: Level ${action.levelValue} (${dbStr})`;
        });

        return descriptions.join('\n');
    }

    // Convenience methods for common operations
    public setPortLevel(port: number, levelValue: number): void {
        const levelDB = LevelConversion.levelToDB(levelValue);
        this.addAction({
            port,
            levelValue,
            levelDB
        });
    }

    public setPortLevelDB(port: number, levelDB: number): void {
        const levelValue = LevelConversion.dBToLevel(levelDB);
        this.addAction({
            port,
            levelValue,
            levelDB
        });
    }

    // Static helper methods
    public static singleAction(
        port: number,
        levelValue: number,
        urgent: boolean = false
    ): RequestInputLevelActions {
        const levelDB = LevelConversion.levelToDB(levelValue);
        return new RequestInputLevelActions([{
            port,
            levelValue,
            levelDB
        }], urgent);
    }

    public static singleActionDB(
        port: number,
        levelDB: number,
        urgent: boolean = false
    ): RequestInputLevelActions {
        const levelValue = LevelConversion.dBToLevel(levelDB);
        return new RequestInputLevelActions([{
            port,
            levelValue,
            levelDB
        }], urgent);
    }

    public static forActions(actions: InputLevelAction[], urgent: boolean = false): RequestInputLevelActions {
        return new RequestInputLevelActions(actions, urgent);
    }

    // Static helper to create actions with level values
    public static forPortLevels(portLevels: { port: number; levelValue: number }[], urgent: boolean = false): RequestInputLevelActions {
        const actions = portLevels.map(({ port, levelValue }) => ({
            port,
            levelValue,
            levelDB: LevelConversion.levelToDB(levelValue)
        }));

        return new RequestInputLevelActions(actions, urgent);
    }

    // Static helper to create actions with dB values
    public static forPortLevelsDB(portLevels: { port: number; levelDB: number }[], urgent: boolean = false): RequestInputLevelActions {
        const actions = portLevels.map(({ port, levelDB }) => ({
            port,
            levelValue: LevelConversion.dBToLevel(levelDB),
            levelDB
        }));

        return new RequestInputLevelActions(actions, urgent);
    }

    // Set all specified ports to the same level
    public static setPortsToLevel(ports: number[], levelValue: number, urgent: boolean = false): RequestInputLevelActions {
        const levelDB = LevelConversion.levelToDB(levelValue);
        const actions = ports.map(port => ({
            port,
            levelValue,
            levelDB
        }));

        return new RequestInputLevelActions(actions, urgent);
    }

    // Set all specified ports to the same dB level
    public static setPortsToLevelDB(ports: number[], levelDB: number, urgent: boolean = false): RequestInputLevelActions {
        const levelValue = LevelConversion.dBToLevel(levelDB);
        const actions = ports.map(port => ({
            port,
            levelValue,
            levelDB
        }));

        return new RequestInputLevelActions(actions, urgent);
    }

    // Mute specified ports (set to level 0)
    public static mutePorts(ports: number[], urgent: boolean = false): RequestInputLevelActions {
        return RequestInputLevelActions.setPortsToLevel(ports, 0, urgent);
    }

    // Unmute specified ports (set to unity gain, level 204)
    public static unmutePorts(ports: number[], urgent: boolean = false): RequestInputLevelActions {
        return RequestInputLevelActions.setPortsToLevel(ports, 204, urgent); // Unity gain
    }

    // Get level statistics
    public getLevelStats(): {
        minLevel: number;
        maxLevel: number;
        avgLevel: number;
        minDB: number;
        maxDB: number;
        avgDB: number;
    } | null {
        if (this.Actions.length === 0) {
            return null;
        }

        const levels = this.Actions.map(a => a.levelValue);
        const dbValues = this.Actions.map(a => a.levelDB).filter(db => db !== Number.NEGATIVE_INFINITY);

        return {
            minLevel: Math.min(...levels),
            maxLevel: Math.max(...levels),
            avgLevel: levels.reduce((sum, l) => sum + l, 0) / levels.length,
            minDB: dbValues.length > 0 ? Math.min(...dbValues) : Number.NEGATIVE_INFINITY,
            maxDB: dbValues.length > 0 ? Math.max(...dbValues) : Number.NEGATIVE_INFINITY,
            avgDB: dbValues.length > 0 ? dbValues.reduce((sum, db) => sum + db, 0) / dbValues.length : Number.NEGATIVE_INFINITY
        };
    }

    // Get muted ports (level 0)
    public getMutedPorts(): number[] {
        return this.Actions.filter(action => action.levelValue === 0).map(action => action.port);
    }

    // Get active ports (level > 0)
    public getActivePorts(): number[] {
        return this.Actions.filter(action => action.levelValue > 0).map(action => action.port);
    }

    // Format as a table
    public formatLevelTable(): string {
        if (this.Actions.length === 0) {
            return 'No input level actions';
        }

        const header = 'Port | Level | dB Value';
        const separator = '-'.repeat(header.length);

        const rows = this.Actions.map(action => {
            const portStr = action.port.toString().padStart(4);
            const levelStr = action.levelValue.toString().padStart(5);
            const dbStr = LevelConversion.formatDB(action.levelDB).padStart(8);
            return `${portStr} | ${levelStr} | ${dbStr}`;
        });

        return [header, separator, ...rows].join('\n');
    }
}

export default RequestInputLevelActions;
export { InputLevelAction };