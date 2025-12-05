import HCIRequest from '../HCIRequest';

export enum EditType {
    Conference = 2,  // EN_CONF
    Group = 3        // GROUP
}

class RequestConferenceGroupMembersEdits extends HCIRequest {
    public EditType: EditType;

    constructor(editType: EditType, urgent: boolean = false, responseID?: number) {
        // Validate parameters
        if (editType !== EditType.Conference && editType !== EditType.Group) {
            throw new Error(`Invalid edit type: ${editType}. Must be EditType.Conference (2) or EditType.Group (3)`);
        }

        // Create the payload buffer
        // EditType (2 bytes) + Unused (16 bytes) = 18 bytes total
        const payload = Buffer.allocUnsafe(18);

        // Edit Type (2 bytes)
        payload.writeUInt16BE(editType, 0);

        // Unused (16 bytes) - set to all 0's
        payload.fill(0, 2, 18);

        // Call parent constructor with Message ID 197 (0x00C5)
        super(0x00C5, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestConferenceGroupMembersEdits
        this.ProtocolVersion = 1;

        this.EditType = editType;
    }

    // Helper method to display the request details
    public override toString(): string {
        const typeName = this.EditType === EditType.Conference ? 'Conference' : 'Group';
        return `RequestConferenceGroupMembersEdits - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, Type: ${typeName}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        return 18; // EditType (2) + Unused (16)
    }

    // Get description
    public getDescription(): string {
        const typeName = this.EditType === EditType.Conference ? 'Conference (partyline)' : 'Fixed Group';
        const typeDescription = this.EditType === EditType.Conference
            ? 'Request all locally edited members of conferences (partylines)'
            : 'Request all locally edited members of fixed groups';

        return `Conference/Group Members Edits Request:\n` +
            `  Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')} (${this.RequestID})\n` +
            `  Purpose: ${typeDescription}\n` +
            `  Edit Type: ${this.EditType} (${typeName})\n` +
            `  Information Retrieved:\n` +
            `    - All locally edited member assignments\n` +
            `    - Member configuration changes\n` +
            `    - Local additions and removals\n` +
            `    - Override settings for ${typeName.toLowerCase()} membership\n` +
            `  Response: Reply Conference/Group Members Edits with member details`;
    }

    // Static helper methods for conference requests
    public static forConference(urgent: boolean = false): RequestConferenceGroupMembersEdits {
        return new RequestConferenceGroupMembersEdits(EditType.Conference, urgent);
    }

    // Static helper methods for group requests
    public static forGroup(urgent: boolean = false): RequestConferenceGroupMembersEdits {
        return new RequestConferenceGroupMembersEdits(EditType.Group, urgent);
    }

    // Static helper to request both types
    public static forBothTypes(urgent: boolean = false): RequestConferenceGroupMembersEdits[] {
        return [
            new RequestConferenceGroupMembersEdits(EditType.Conference, urgent),
            new RequestConferenceGroupMembersEdits(EditType.Group, urgent)
        ];
    }

    // Validate that the request is properly configured
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.EditType !== EditType.Conference && this.EditType !== EditType.Group) {
            errors.push(`Invalid edit type: ${this.EditType} (must be 2 for Conference or 3 for Group)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Get edit type identifier string
    public getEditTypeIdentifier(): string {
        return this.EditType === EditType.Conference ? 'Conference' : 'Group';
    }

    // Get expected response information
    public getExpectedResponseInfo(): string {
        const typeName = this.getEditTypeIdentifier();
        return `Expected Response for ${typeName} Members Edits:\n` +
            `  - Message ID: 198 (0x00C6) Reply Conference/Group Members Edits\n` +
            `  - List of all locally edited ${typeName.toLowerCase()} members\n` +
            `  - Member assignment details and configurations\n` +
            `  - Local override settings\n` +
            `  - Addition and removal operations\n` +
            `  - Current membership status`;
    }

    // Get request priority based on edit type
    public getRequestPriority(): 'high' | 'normal' | 'low' {
        // Conferences might be higher priority as they affect real-time communication
        if (this.EditType === EditType.Conference) {
            return 'high';
        } else {
            return 'normal'; // Groups
        }
    }

    // Check if this is a conference request
    public isConferenceRequest(): boolean {
        return this.EditType === EditType.Conference;
    }

    // Check if this is a group request
    public isGroupRequest(): boolean {
        return this.EditType === EditType.Group;
    }

    // Get edit type category description
    public getEditTypeCategory(): string {
        if (this.isConferenceRequest()) {
            return 'Conference/Partyline Management';
        } else if (this.isGroupRequest()) {
            return 'Fixed Group Management';
        } else {
            return 'Unknown Edit Type';
        }
    }

    // Get human-readable summary
    public getSummary(): string {
        const typeName = this.getEditTypeIdentifier();
        const priority = this.getRequestPriority();
        const category = this.getEditTypeCategory();

        return `${typeName} Members Edits Request:\n` +
            `  Edit Type: ${this.EditType} (${typeName})\n` +
            `  Category: ${category}\n` +
            `  Priority: ${priority.toUpperCase()}\n` +
            `  Will retrieve: All locally edited ${typeName.toLowerCase()} member assignments\n` +
            `  Expected data: Member lists, configurations, local overrides`;
    }

    // Get recommended polling interval based on edit type
    public getRecommendedPollingInterval(): number {
        // Return interval in seconds
        if (this.isConferenceRequest()) {
            return 120;  // Poll conference edits every 2 minutes
        } else {
            return 300;  // Poll group edits every 5 minutes
        }
    }

    // Get edit importance level
    public getEditImportance(): 'critical' | 'important' | 'normal' {
        if (this.isConferenceRequest()) {
            return 'important'; // Conferences affect real-time communication
        } else {
            return 'normal';    // Groups are less time-sensitive
        }
    }

    // Get what type of edits this request covers
    public getEditScope(): string {
        const typeName = this.getEditTypeIdentifier().toLowerCase();
        return `All locally edited ${typeName} member assignments including:\n` +
            `  - Member additions to ${typeName}s\n` +
            `  - Member removals from ${typeName}s\n` +
            `  - ${typeName} membership configuration changes\n` +
            `  - Local overrides to baseline ${typeName} settings\n` +
            `  - Runtime ${typeName} membership modifications`;
    }

    // Get context information
    public getContextInfo(): string {
        if (this.isConferenceRequest()) {
            return 'Conference (partyline) edits affect multi-party communication sessions.\n' +
                'These are typically real-time changes to who can participate in conferences.\n' +
                'Local edits override the baseline conference configuration.';
        } else {
            return 'Fixed group edits affect predefined communication groups.\n' +
                'These are changes to fixed group membership assignments.\n' +
                'Local edits override the baseline group configuration.';
        }
    }
}

export default RequestConferenceGroupMembersEdits;
//export { EditType };