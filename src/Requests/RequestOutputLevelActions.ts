import HCIRequest from '../HCIRequest';
import LevelConversion from '../Utilities/LevelConversion';

interface OutputLevelAction {
    port: number;          // Port number (1-1024, will be converted to 0-1023)
    levelValue: number;    // Level value (0-255)
    levelDB: number;       // Calculated dB value for reference
}

class RequestOutputLevelActions extends HCIRequest {
    public Actions: OutputLevelAction[];

    constructor(actions: OutputLevelAction[] = [], urgent: boolean = false, responseID?: number) {
        // Validate actions
        if (actions.length === 0) {
            throw new Error('Must specify at least one output level action');
        }

        for (const action of actions) {
            RequestOutputLevelActions.validateActionStatic(action);
        }

        // Create the payload buffer
        const payload = RequestOutputLevelActions.createPayload(actions);

        // Call parent constructor with Message ID 35 (0x0023)
        super(0x0023, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestOutputLevelActions
        this.ProtocolVersion = 1;

        this.Actions = [...actions]; // Create a copy of the array
    }

    private validateAction(action: OutputLevelAction): void {
        RequestOutputLevelActions.validateActionStatic(action);
    }

    private static validateActionStatic(action: OutputLevelAction): void {
        if (action.port < 1 || action.port > 1024) {
            throw new Error(`Port number must be between 1 and 1024, got ${action.port}`);
        }

        if (action.levelValue < 0 || action.levelValue > 255) {
            throw new Error(`Level value must be between 0 and 255, got ${action.levelValue}`);
        }
    }

    private static createPayload(actions: OutputLevelAction[]): Buffer {
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
    public addAction(action: OutputLevelAction): void {
        this.validateAction(action);
        this.Actions.push(action);
        this.updatePayload();
    }

    // Remove an action by index
    public removeAction(index: number): boolean {
        if (index >= 0 && index < this.Actions.length) {
            this.Actions.splice(index, 1);

            if (this.Actions.length === 0) {
                throw new Error('Must have at least one output level action');
            }

            this.updatePayload();
            return true;
        }
        return false;
    }

    // Clear all actions and set new ones
    public setActions(actions: OutputLevelAction[]): void {
        if (actions.length === 0) {
            throw new Error('Must specify at least one output level action');
        }

        for (const action of actions) {
            this.validateAction(action);
        }

        this.Actions = [...actions];
        this.updatePayload();
    }

    private updatePayload(): void {
        // Update the Data buffer with new actions
        this.Data = RequestOutputLevelActions.createPayload(this.Actions);
    }

    // Get action count
    public getActionCount(): number {
        return this.Actions.length;
    }

    // Helper method to display the request details
    public override toString(): string {
        const actionList = this.Actions.length <= 3
            ? `[${this.Actions.map(a => `P${a.port}:${LevelConversion.formatDB(a.levelDB)}`).join(', ')}]`
            : `[${this.Actions.slice(0, 3).map(a => `P${a.port}:${LevelConversion.formatDB(a.levelDB)}`).join(', ')}, ...and ${this.Actions.length - 3} more]`;

        return `RequestOutputLevelActions - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
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
            return 'No output level actions';
        }

        const descriptions = this.Actions.map((action, index) => {
            const dbStr = LevelConversion.formatDB(action.levelDB);
            const rangeNote = action.levelValue === 0 ? ' (Full Cut)' : '';
            return `${index + 1}. Port ${action.port}: Level ${action.levelValue} (${dbStr})${rangeNote}`;
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
        // Validate dB range for output levels (-72dB to +18dB)
        if (levelDB !== Number.NEGATIVE_INFINITY && (levelDB < -72 || levelDB > 18)) {
            console.warn(`Output level ${levelDB} dB is outside recommended range (-72dB to +18dB)`);
        }

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
    ): RequestOutputLevelActions {
        const levelDB = LevelConversion.levelToDB(levelValue);
        return new RequestOutputLevelActions([{
            port,
            levelValue,
            levelDB
        }], urgent);
    }

    public static singleActionDB(
        port: number,
        levelDB: number,
        urgent: boolean = false
    ): RequestOutputLevelActions {
        // Validate dB range for output levels
        if (levelDB !== Number.NEGATIVE_INFINITY && (levelDB < -72 || levelDB > 18)) {
            console.warn(`Output level ${levelDB} dB is outside recommended range (-72dB to +18dB)`);
        }

        const levelValue = LevelConversion.dBToLevel(levelDB);
        return new RequestOutputLevelActions([{
            port,
            levelValue,
            levelDB
        }], urgent);
    }

    public static forActions(actions: OutputLevelAction[], urgent: boolean = false): RequestOutputLevelActions {
        return new RequestOutputLevelActions(actions, urgent);
    }

    // Static helper to create actions with level values
    public static forPortLevels(portLevels: { port: number; levelValue: number }[], urgent: boolean = false): RequestOutputLevelActions {
        const actions = portLevels.map(({ port, levelValue }) => ({
            port,
            levelValue,
            levelDB: LevelConversion.levelToDB(levelValue)
        }));

        return new RequestOutputLevelActions(actions, urgent);
    }

    // Static helper to create actions with dB values
    public static forPortLevelsDB(portLevels: { port: number; levelDB: number }[], urgent: boolean = false): RequestOutputLevelActions {
        const actions = portLevels.map(({ port, levelDB }) => {
            // Validate dB range
            if (levelDB !== Number.NEGATIVE_INFINITY && (levelDB < -72 || levelDB > 18)) {
                console.warn(`Output level ${levelDB} dB is outside recommended range (-72dB to +18dB)`);
            }

            return {
                port,
                levelValue: LevelConversion.dBToLevel(levelDB),
                levelDB
            };
        });

        return new RequestOutputLevelActions(actions, urgent);
    }

    // Set all specified ports to the same level
    public static setPortsToLevel(ports: number[], levelValue: number, urgent: boolean = false): RequestOutputLevelActions {
        const levelDB = LevelConversion.levelToDB(levelValue);
        const actions = ports.map(port => ({
            port,
            levelValue,
            levelDB
        }));

        return new RequestOutputLevelActions(actions, urgent);
    }

    // Set all specified ports to the same dB level
    public static setPortsToLevelDB(ports: number[], levelDB: number, urgent: boolean = false): RequestOutputLevelActions {
        // Validate dB range
        if (levelDB !== Number.NEGATIVE_INFINITY && (levelDB < -72 || levelDB > 18)) {
            console.warn(`Output level ${levelDB} dB is outside recommended range (-72dB to +18dB)`);
        }

        const levelValue = LevelConversion.dBToLevel(levelDB);
        const actions = ports.map(port => ({
            port,
            levelValue,
            levelDB
        }));

        return new RequestOutputLevelActions(actions, urgent);
    }

    // Mute specified ports (set to level 0 - full cut)
    public static mutePorts(ports: number[], urgent: boolean = false): RequestOutputLevelActions {
        return RequestOutputLevelActions.setPortsToLevel(ports, 0, urgent);
    }

    // Unmute specified ports (set to unity gain, level 204)
    public static unmutePorts(ports: number[], urgent: boolean = false): RequestOutputLevelActions {
        return RequestOutputLevelActions.setPortsToLevel(ports, 204, urgent); // Unity gain
    }

    // Set output ports to maximum level (level 255, approximately +18dB)
    public static setPortsToMax(ports: number[], urgent: boolean = false): RequestOutputLevelActions {
        return RequestOutputLevelActions.setPortsToLevel(ports, 255, urgent);
    }

    // Set output ports to minimum audible level (avoid level 0 which is full cut)
    public static setPortsToMin(ports: number[], urgent: boolean = false): RequestOutputLevelActions {
        return RequestOutputLevelActions.setPortsToLevel(ports, 1, urgent); // Minimum audible level
    }

    // Get level statistics
    public getLevelStats(): {
        minLevel: number;
        maxLevel: number;
        avgLevel: number;
        minDB: number;
        maxDB: number;
        avgDB: number;
        fullCutPorts: number;
    } | null {
        if (this.Actions.length === 0) {
            return null;
        }

        const levels = this.Actions.map(a => a.levelValue);
        const dbValues = this.Actions.map(a => a.levelDB).filter(db => db !== Number.NEGATIVE_INFINITY);
        const fullCutPorts = this.Actions.filter(a => a.levelValue === 0).length;

        return {
            minLevel: Math.min(...levels),
            maxLevel: Math.max(...levels),
            avgLevel: levels.reduce((sum, l) => sum + l, 0) / levels.length,
            minDB: dbValues.length > 0 ? Math.min(...dbValues) : Number.NEGATIVE_INFINITY,
            maxDB: dbValues.length > 0 ? Math.max(...dbValues) : Number.NEGATIVE_INFINITY,
            avgDB: dbValues.length > 0 ? dbValues.reduce((sum, db) => sum + db, 0) / dbValues.length : Number.NEGATIVE_INFINITY,
            fullCutPorts
        };
    }

    // Get muted ports (level 0 - full cut)
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
            return 'No output level actions';
        }

        const header = 'Port | Level | dB Value | Range Check';
        const separator = '-'.repeat(50);

        const rows = this.Actions.map(action => {
            const portStr = action.port.toString().padStart(4);
            const levelStr = action.levelValue.toString().padStart(5);
            const dbStr = LevelConversion.formatDB(action.levelDB).padStart(8);

            let rangeCheck = 'OK';
            if (action.levelValue === 0) {
                rangeCheck = 'FULL CUT';
            } else if (action.levelDB !== Number.NEGATIVE_INFINITY) {
                if (action.levelDB < -72) {
                    rangeCheck = 'TOO LOW';
                } else if (action.levelDB > 18) {
                    rangeCheck = 'TOO HIGH';
                } else if (action.levelDB > 12) {
                    rangeCheck = 'HIGH';
                } else if (action.levelDB < -60) {
                    rangeCheck = 'LOW';
                }
            }

            return `${portStr} | ${levelStr} | ${dbStr} | ${rangeCheck}`;
        });

        return [header, separator, ...rows].join('\n');
    }

}

export default RequestOutputLevelActions;
export { OutputLevelAction };