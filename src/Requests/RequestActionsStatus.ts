import HCIRequest from '../HCIRequest';

class RequestActionsStatus extends HCIRequest {
    public ActionType: number;

    // Action type bit flags
    public static readonly ACTION_CROSSPOINT = 0x0001;      // bit 0
    public static readonly ACTION_RESERVED_1 = 0x0002;      // bit 1
    public static readonly ACTION_GPIO_SFO = 0x0004;        // bit 2
    public static readonly ACTION_RESERVED_3 = 0x0008;      // bit 3
    public static readonly ACTION_RESERVED_4 = 0x0010;      // bit 4
    public static readonly ACTION_CONFERENCE = 0x0020;      // bit 5
    // bits 6-15 are reserved

    constructor(actionType: number = 0, urgent: boolean = false, responseID?: number) {
        // Create the payload buffer - this is just the middle part
        const payload = RequestActionsStatus.createPayload(actionType);
        
        // Call parent constructor with Message ID 15 (0x000F)
        super(0x000F, payload, urgent, responseID);
        
        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.Version = 2;
        this.ActionType = actionType;
    }

    private static createPayload(actionType: number): Buffer {
        // This is just the payload part that goes after the HCI headers and before the terminator
        // Protocol Tag (4 bytes): 0xABBACEDE
        const protocolTag = Buffer.from([0xAB, 0xBA, 0xCE, 0xDE]);
        
        // Protocol Schema (1 byte): set to 1
        const protocolSchema = Buffer.from([0x01]);
        
        // Action type (2 bytes): 16-bit word
        const actionTypeBuffer = Buffer.allocUnsafe(2);
        actionTypeBuffer.writeUInt16BE(actionType, 0);
        
        // Return just the payload data
        return Buffer.concat([protocolTag, protocolSchema, actionTypeBuffer]);
    }

    // Helper methods to set/check action types
    public setCrosspointAction(): void {
        this.ActionType |= RequestActionsStatus.ACTION_CROSSPOINT;
        this.updatePayload();
    }

    public setGpioSfoAction(): void {
        this.ActionType |= RequestActionsStatus.ACTION_GPIO_SFO;
        this.updatePayload();
    }

    public setConferenceAction(): void {
        this.ActionType |= RequestActionsStatus.ACTION_CONFERENCE;
        this.updatePayload();
    }

    public clearCrosspointAction(): void {
        this.ActionType &= ~RequestActionsStatus.ACTION_CROSSPOINT;
        this.updatePayload();
    }

    public clearGpioSfoAction(): void {
        this.ActionType &= ~RequestActionsStatus.ACTION_GPIO_SFO;
        this.updatePayload();
    }

    public clearConferenceAction(): void {
        this.ActionType &= ~RequestActionsStatus.ACTION_CONFERENCE;
        this.updatePayload();
    }

    public isCrosspointActionSet(): boolean {
        return (this.ActionType & RequestActionsStatus.ACTION_CROSSPOINT) !== 0;
    }

    public isGpioSfoActionSet(): boolean {
        return (this.ActionType & RequestActionsStatus.ACTION_GPIO_SFO) !== 0;
    }

    public isConferenceActionSet(): boolean {
        return (this.ActionType & RequestActionsStatus.ACTION_CONFERENCE) !== 0;
    }

    private updatePayload(): void {
        // Update the Data buffer with new action type
        this.Data = RequestActionsStatus.createPayload(this.ActionType);
    }

    // Helper method to get a description of active actions
    public getActionDescription(): string {
        const actions: string[] = [];
        
        if (this.isCrosspointActionSet()) {
            actions.push('Crosspoint');
        }
        if (this.isGpioSfoActionSet()) {
            actions.push('GPIO/SFO');
        }
        if (this.isConferenceActionSet()) {
            actions.push('Conference');
        }
        
        if (actions.length === 0) {
            return 'No actions set';
        }
        
        return `Actions: ${actions.join(', ')}`;
    }

    // Helper method to display the request details
    public toString(): string {
        return `RequestActionsStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
               `Action Type: 0x${this.ActionType.toString(16).padStart(4, '0')} (${this.ActionType.toString(2).padStart(16, '0')}), ` +
               `${this.getActionDescription()}`;
    }
}

export default RequestActionsStatus;