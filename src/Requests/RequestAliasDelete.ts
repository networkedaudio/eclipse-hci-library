import HCIRequest from '../HCIRequest';

interface AliasDeleteEntry {
    system: number;        // Target System Number (0-255, bits 24-31)
    entityType: number;    // Entity type (0-255, bits 16-23)
    instance: number;      // Entity instance (0-65535, bits 0-15) - port number (1-indexed for user, converted to 0-indexed)
}

class RequestAliasDelete extends HCIRequest {
    public Aliases: AliasDeleteEntry[];

    constructor(aliases: AliasDeleteEntry[] = [], urgent: boolean = false, responseID?: number) {
        // Validate aliases
        if (aliases.length === 0) {
            throw new Error('Must specify at least one alias to delete');
        }

        for (const alias of aliases) {
            RequestAliasDelete.validateAliasStatic(alias);
        }

        // Create the payload buffer
        const payload = RequestAliasDelete.createPayload(aliases);

        // Call parent constructor with Message ID 133 (0x0085)
        super(0x0085, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestAliasDelete
        this.ProtocolVersion = 1;

        this.Aliases = [...aliases]; // Create a copy of the array
    }

    private validateAlias(alias: AliasDeleteEntry): void {
        RequestAliasDelete.validateAliasStatic(alias);
    }

    private static validateAliasStatic(alias: AliasDeleteEntry): void {
        if (alias.system < 0 || alias.system > 255) {
            throw new Error(`System number must be between 0 and 255, got ${alias.system}`);
        }

        if (alias.entityType < 0 || alias.entityType > 255) {
            throw new Error(`Entity type must be between 0 and 255, got ${alias.entityType}`);
        }

        if (alias.instance < 0 || alias.instance > 65535) {
            throw new Error(`Instance must be between 0 and 65535, got ${alias.instance}`);
        }
    }

    private static createPayload(aliases: AliasDeleteEntry[]): Buffer {
        // Count (2 bytes): number of aliases to delete
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(aliases.length, 0);

        // Alias data - each alias entry is 4 bytes (Dialcode)
        const aliasBuffers: Buffer[] = [];

        for (const alias of aliases) {
            // Dialcode (4 bytes) structure:
            // Bits 0-15:   Entity instance (instance)
            // Bits 16-23:  Entity type 
            // Bits 24-31:  Target System Number

            const dialcode = (alias.system << 24) |      // Bits 24-31: System
                (alias.entityType << 16) |    // Bits 16-23: Entity type
                (alias.instance & 0xFFFF);    // Bits 0-15:  Instance

            const aliasBuffer = Buffer.allocUnsafe(4);
            aliasBuffer.writeUInt32BE(dialcode, 0);
            aliasBuffers.push(aliasBuffer);
        }

        // Combine count + all alias data
        const aliasData = Buffer.concat(aliasBuffers);
        return Buffer.concat([countBuffer, aliasData]);
    }

    // Add an alias to delete
    public addAlias(alias: AliasDeleteEntry): void {
        this.validateAlias(alias);
        this.Aliases.push(alias);
        this.updatePayload();
    }

    // Remove an alias from the delete list by index
    public removeAlias(index: number): boolean {
        if (index >= 0 && index < this.Aliases.length) {
            this.Aliases.splice(index, 1);

            if (this.Aliases.length === 0) {
                throw new Error('Must have at least one alias to delete');
            }

            this.updatePayload();
            return true;
        }
        return false;
    }

    // Clear all aliases and set new ones
    public setAliases(aliases: AliasDeleteEntry[]): void {
        if (aliases.length === 0) {
            throw new Error('Must specify at least one alias to delete');
        }

        for (const alias of aliases) {
            this.validateAlias(alias);
        }

        this.Aliases = [...aliases];
        this.updatePayload();
    }

    private updatePayload(): void {
        // Update the Data buffer with new aliases
        this.Data = RequestAliasDelete.createPayload(this.Aliases);
    }

    // Get alias count
    public getAliasCount(): number {
        return this.Aliases.length;
    }

    // Helper method to display the request details
    public override toString(): string {
        const aliasList = this.Aliases.length <= 3
            ? `[${this.Aliases.map(a => `S${a.system}T${a.entityType}I${a.instance}`).join(', ')}]`
            : `[${this.Aliases.slice(0, 3).map(a => `S${a.system}T${a.entityType}I${a.instance}`).join(', ')}, ...and ${this.Aliases.length - 3} more]`;

        return `RequestAliasDelete - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Delete Count: ${this.Aliases.length}, Aliases: ${aliasList}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Count (2) + (Dialcode (4) * count)
        return 2 + (this.Aliases.length * 4);
    }

    // Get aliases description
    public getAliasesDescription(): string {
        if (this.Aliases.length === 0) {
            return 'No aliases to delete';
        }

        const descriptions = this.Aliases.map((alias, index) => {
            const dialcodeHex = ((alias.system << 24) | (alias.entityType << 16) | alias.instance).toString(16).padStart(8, '0');
            return `${index + 1}. System ${alias.system}, Entity Type ${alias.entityType}, Instance ${alias.instance} (Dialcode: 0x${dialcodeHex})`;
        });

        return descriptions.join('\n');
    }

    // Static helper to create a single alias delete request
    public static singleAlias(
        system: number,
        entityType: number,
        instance: number,
        urgent: boolean = false
    ): RequestAliasDelete {
        return new RequestAliasDelete([{
            system,
            entityType,
            instance
        }], urgent);
    }

    // Static helper to create from alias entries
    public static forAliases(aliases: AliasDeleteEntry[], urgent: boolean = false): RequestAliasDelete {
        return new RequestAliasDelete(aliases, urgent);
    }

    // Helper to create delete request for port aliases (common use case)
    public static forPort(system: number, port: number, urgent: boolean = false): RequestAliasDelete {
        // Assuming entity type 1 for ports (common case)
        // Port is 1-indexed for user, but instance field uses 0-indexed
        return RequestAliasDelete.singleAlias(system, 1, port - 1, urgent);
    }

    // Helper to create delete requests for multiple ports
    public static forPorts(system: number, ports: number[], urgent: boolean = false): RequestAliasDelete {
        const aliases = ports.map(port => ({
            system,
            entityType: 1, // Assuming entity type 1 for ports
            instance: port - 1 // Convert to 0-indexed
        }));

        return new RequestAliasDelete(aliases, urgent);
    }

    // Get dialcode as hex string for debugging
    public getDialcodeHex(index: number): string {
        if (index < 0 || index >= this.Aliases.length) {
            throw new Error(`Invalid alias index: ${index}`);
        }

        const alias = this.Aliases[index];
        const dialcode = (alias.system << 24) | (alias.entityType << 16) | alias.instance;
        return `0x${dialcode.toString(16).padStart(8, '0').toUpperCase()}`;
    }

    // Get all dialcodes as hex strings
    public getAllDialcodesHex(): string[] {
        return this.Aliases.map((_, index) => this.getDialcodeHex(index));
    }
}

export default RequestAliasDelete;
export { AliasDeleteEntry };