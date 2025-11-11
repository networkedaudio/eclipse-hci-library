import HCIRequest from '../HCIRequest';

interface UnicodeAliasEntry {
    system: number;        // System number (0-255)
    port: number;          // Port number (1-1024, will be converted to 0-1023)
    text: string;          // Unicode text (up to 10 characters)
    inhibitLocal: boolean; // Bit 15: inhibit on local systems
    inhibitRemote: boolean; // Bit 14: inhibit on remote systems
}

class RequestUnicodeAliasAdd extends HCIRequest {
    public Aliases: UnicodeAliasEntry[];

    constructor(aliases: UnicodeAliasEntry[] = [], urgent: boolean = false, responseID?: number) {
        // Validate aliases
        if (aliases.length === 0) {
            throw new Error('Must specify at least one alias entry');
        }

        for (const alias of aliases) {
            this.validateAlias(alias);
        }

        // Create the payload buffer
        const payload = RequestUnicodeAliasAdd.createPayload(aliases);

        // Call parent constructor with Message ID 244 (0x00F4)
        super(0x00F4, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestUnicodeAliasAdd
        this.ProtocolVersion = 1;

        this.Aliases = [...aliases]; // Create a copy of the array
    }

    private validateAlias(alias: UnicodeAliasEntry): void {
        if (alias.system < 0 || alias.system > 255) {
            throw new Error(`System number must be between 0 and 255, got ${alias.system}`);
        }

        if (alias.port < 1 || alias.port > 1024) {
            throw new Error(`Port number must be between 1 and 1024, got ${alias.port}`);
        }

        if (alias.text.length > 10) {
            throw new Error(`Text must be 10 characters or less, got ${alias.text.length} characters`);
        }
    }

    private static createPayload(aliases: UnicodeAliasEntry[]): Buffer {
        // Count (2 bytes): number of aliases
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(aliases.length, 0);

        // Alias data - each alias entry
        const aliasBuffers: Buffer[] = [];

        for (const alias of aliases) {
            // Each entry is:
            // - Flags (2 bytes): bits 14-15 for inhibit flags
            // - Dialcode (4 bytes): system + port info
            // - Text (20 bytes): 10 Unicode characters (2 bytes each)
            // - Unicode info (2 bytes): bit 15 set for Unicode

            const entryBuffer = Buffer.allocUnsafe(28); // 2 + 4 + 20 + 2
            let offset = 0;

            // Flags (2 bytes) - bits 14 and 15 for inhibit flags
            let flags = 0;
            if (alias.inhibitRemote) {
                flags |= 0x4000; // bit 14
            }
            if (alias.inhibitLocal) {
                flags |= 0x8000; // bit 15
            }
            entryBuffer.writeUInt16BE(flags, offset);
            offset += 2;

            // Dialcode (4 bytes) - based on the C# example format
            // Byte 0: System number
            // Byte 1: 0x01 (fixed)
            // Byte 2: 0x00 (fixed)
            // Byte 3: Port number (0-indexed)
            entryBuffer.writeUInt8(alias.system, offset);
            entryBuffer.writeUInt8(0x01, offset + 1);
            entryBuffer.writeUInt8(0x00, offset + 2);
            entryBuffer.writeUInt8(alias.port - 1, offset + 3); // Convert to 0-indexed
            offset += 4;

            // Text (20 bytes) - 10 Unicode characters, 2 bytes each, big-endian
            const paddedText = alias.text.padEnd(10, '\0'); // Pad to 10 chars with null
            for (let i = 0; i < 10; i++) {
                const charCode = paddedText.charCodeAt(i);
                entryBuffer.writeUInt16BE(charCode, offset);
                offset += 2;
            }

            // Unicode info (2 bytes) - bit 15 set to indicate Unicode
            entryBuffer.writeUInt16BE(0x8000, offset); // bit 15 = 1 for Unicode

            aliasBuffers.push(entryBuffer);
        }

        // Combine count + all alias data
        const aliasData = Buffer.concat(aliasBuffers);
        return Buffer.concat([countBuffer, aliasData]);
    }

    // Add an alias to the request
    public addAlias(alias: UnicodeAliasEntry): void {
        this.validateAlias(alias);
        this.Aliases.push(alias);
        this.updatePayload();
    }

    // Remove an alias by index
    public removeAlias(index: number): boolean {
        if (index >= 0 && index < this.Aliases.length) {
            this.Aliases.splice(index, 1);

            if (this.Aliases.length === 0) {
                throw new Error('Must have at least one alias entry');
            }

            this.updatePayload();
            return true;
        }
        return false;
    }

    // Clear all aliases and set new ones
    public setAliases(aliases: UnicodeAliasEntry[]): void {
        if (aliases.length === 0) {
            throw new Error('Must specify at least one alias entry');
        }

        for (const alias of aliases) {
            this.validateAlias(alias);
        }

        this.Aliases = [...aliases];
        this.updatePayload();
    }

    private updatePayload(): void {
        // Update the Data buffer with new aliases
        this.Data = RequestUnicodeAliasAdd.createPayload(this.Aliases);
    }

    // Get alias count
    public getAliasCount(): number {
        return this.Aliases.length;
    }

    // Helper method to display the request details
    public toString(): string {
        const aliasList = this.Aliases.length <= 3
            ? `[${this.Aliases.map(a => `S${a.system}P${a.port}:"${a.text}"`).join(', ')}]`
            : `[${this.Aliases.slice(0, 3).map(a => `S${a.system}P${a.port}:"${a.text}"`).join(', ')}, ...and ${this.Aliases.length - 3} more]`;

        return `RequestUnicodeAliasAdd - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Alias Count: ${this.Aliases.length}, Aliases: ${aliasList}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Count (2) + (Entry (28) * count)
        return 2 + (this.Aliases.length * 28);
    }

    // Get aliases description
    public getAliasesDescription(): string {
        if (this.Aliases.length === 0) {
            return 'No aliases';
        }

        const descriptions = this.Aliases.map((alias, index) => {
            const inhibitFlags = [];
            if (alias.inhibitLocal) inhibitFlags.push('Local');
            if (alias.inhibitRemote) inhibitFlags.push('Remote');
            const inhibitStr = inhibitFlags.length > 0 ? ` (Inhibit: ${inhibitFlags.join(', ')})` : '';

            return `${index + 1}. System ${alias.system}, Port ${alias.port}: "${alias.text}"${inhibitStr}`;
        });

        return descriptions.join('\n');
    }

    // Static helper to create a single alias request
    public static singleAlias(
        system: number,
        port: number,
        text: string,
        inhibitLocal: boolean = false,
        inhibitRemote: boolean = false,
        urgent: boolean = false
    ): RequestUnicodeAliasAdd {
        return new RequestUnicodeAliasAdd([{
            system,
            port,
            text,
            inhibitLocal,
            inhibitRemote
        }], urgent);
    }

    // Static helper to create from alias entries
    public static forAliases(aliases: UnicodeAliasEntry[], urgent: boolean = false): RequestUnicodeAliasAdd {
        return new RequestUnicodeAliasAdd(aliases, urgent);
    }

    // Helper to get text length in Unicode characters
    public static getUnicodeLength(text: string): number {
        return text.length; // JavaScript strings are already Unicode
    }

    // Helper to truncate text to fit Unicode limit
    public static truncateText(text: string, maxLength: number = 10): string {
        return text.length <= maxLength ? text : text.substring(0, maxLength);
    }
}

export default RequestUnicodeAliasAdd;
export { UnicodeAliasEntry };