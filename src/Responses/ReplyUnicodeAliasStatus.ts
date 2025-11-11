interface UnicodeAliasStatusEntry {
    system: number;           // System number (0-255)  
    port: number;            // Port number (1-1024, converted from 0-1023)
    text: string;            // Unicode text (up to 10 characters)
    inhibitLocal: boolean;   // Bit 15: inhibit on local systems
    inhibitRemote: boolean;  // Bit 14: inhibit on remote systems
    isUnicode: boolean;      // Bit 15 of Unicode info: indicates Unicode text
    listenKeysOnly: boolean; // Bit 14 of Unicode info: only for listen keys (E-Dante)
}

interface UnicodeAliasStatusData {
    messageType: 'unicodeAliasStatus';
    messageID: number;
    timestamp: string;
    isResponse: boolean;     // true if U flag set (response to Add), false if response to List
    count: number;
    aliases: UnicodeAliasStatusEntry[];
    rawPayload: string;
}

class ReplyUnicodeAliasStatus {
    public static parse(payload: Buffer, flags: any): UnicodeAliasStatusData | null {
        // Check minimum payload size
        // Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('Unicode alias status reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw unicode alias status payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Count (2 bytes)
        const count = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing unicode alias status with count: ${count}`);

        // Determine if this is a response to Add (U flag set) or List (U flag clear)
        const isResponse = flags.U || false;
        console.log(`Response type: ${isResponse ? 'Add Response (U flag set)' : 'List Response (U flag clear)'}`);

        // Validate we have enough data for all entries
        // Each entry is 28 bytes: Flags (2) + Dialcode (4) + Text (20) + Unicode info (2)
        const expectedDataSize = count * 28;
        if (payload.length < 2 + expectedDataSize) {
            console.error(`Insufficient data: need ${2 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const aliases: UnicodeAliasStatusEntry[] = [];

        // Parse each alias entry
        for (let i = 0; i < count; i++) {
            if (offset + 28 > payload.length) {
                console.error(`Insufficient data for alias entry ${i + 1}`);
                return null;
            }

            // Flags (2 bytes) - bits 14 and 15 for inhibit flags
            const flagsWord = payload.readUInt16BE(offset);
            offset += 2;

            const inhibitRemote = (flagsWord & 0x4000) !== 0; // bit 14
            const inhibitLocal = (flagsWord & 0x8000) !== 0;  // bit 15

            // Dialcode (4 bytes)
            const system = payload.readUInt8(offset);
            const fixed1 = payload.readUInt8(offset + 1); // Should be 0x01
            const fixed2 = payload.readUInt8(offset + 2); // Should be 0x00
            const portRaw = payload.readUInt8(offset + 3); // 0-indexed, convert to 1-indexed
            offset += 4;

            const port = portRaw + 1; // Convert from 0-indexed to 1-indexed

            console.log(`Dialcode: System=${system}, Fixed=[${fixed1}, ${fixed2}], Port=${port} (raw=${portRaw})`);

            // Text (20 bytes) - 10 Unicode characters, 2 bytes each, big-endian
            let text = '';
            for (let j = 0; j < 10; j++) {
                const charCode = payload.readUInt16BE(offset);
                offset += 2;

                // Stop at null terminator
                if (charCode === 0) {
                    break;
                }

                text += String.fromCharCode(charCode);
            }

            // Unicode info (2 bytes)
            const unicodeInfo = payload.readUInt16BE(offset);
            offset += 2;

            const isUnicode = (unicodeInfo & 0x8000) !== 0;      // bit 15
            const listenKeysOnly = (unicodeInfo & 0x4000) !== 0; // bit 14

            console.log(`Alias entry ${i + 1}: System=${system}, Port=${port}, Text="${text}", Unicode=${isUnicode}, ListenOnly=${listenKeysOnly}`);
            console.log(`  Inhibit flags: Local=${inhibitLocal}, Remote=${inhibitRemote}`);

            aliases.push({
                system,
                port,
                text,
                inhibitLocal,
                inhibitRemote,
                isUnicode,
                listenKeysOnly
            });
        }

        return {
            messageType: 'unicodeAliasStatus',
            messageID: 0x00F5,
            timestamp: new Date().toISOString(),
            isResponse,
            count,
            aliases,
            rawPayload: payload.toString('hex')
        };
    }

    public static getAliasSummary(data: UnicodeAliasStatusData): string {
        if (data.aliases.length === 0) {
            return 'No Unicode aliases';
        }

        const summary = data.aliases.map((alias, index) => {
            const inhibitFlags = [];
            if (alias.inhibitLocal) inhibitFlags.push('Local');
            if (alias.inhibitRemote) inhibitFlags.push('Remote');
            const inhibitStr = inhibitFlags.length > 0 ? ` (Inhibit: ${inhibitFlags.join(', ')})` : '';

            const flags = [];
            if (alias.listenKeysOnly) flags.push('Listen Keys Only');
            if (!alias.isUnicode) flags.push('Non-Unicode');
            const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';

            return `${index + 1}. System ${alias.system}, Port ${alias.port}: "${alias.text}"${inhibitStr}${flagStr}`;
        });

        return summary.join('\n');
    }

    public static displayUnicodeAliasStatus(data: UnicodeAliasStatusData): void {
        console.log('=== Unicode Alias Status Reply ===');
        console.log(`Response Type: ${data.isResponse ? 'Add Response' : 'List Response'}`);
        console.log(`Count: ${data.count}`);
        console.log(`Aliases: ${data.aliases.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.aliases.length > 0) {
            data.aliases.forEach((alias, index) => {
                console.log(`${index + 1}. System ${alias.system}, Port ${alias.port}:`);
                console.log(`   Text: "${alias.text}"`);

                const inhibitFlags = [];
                if (alias.inhibitLocal) inhibitFlags.push('Local');
                if (alias.inhibitRemote) inhibitFlags.push('Remote');
                console.log(`   Inhibit: ${inhibitFlags.length > 0 ? inhibitFlags.join(', ') : 'None'}`);

                const flags = [];
                if (alias.isUnicode) flags.push('Unicode');
                if (alias.listenKeysOnly) flags.push('Listen Keys Only');
                console.log(`   Flags: ${flags.length > 0 ? flags.join(', ') : 'None'}`);
                console.log('');
            });
        } else {
            console.log('No aliases in response');
        }
        console.log('==================================');
    }

    // Helper methods for filtering and analysis
    public static getAliasesForSystem(data: UnicodeAliasStatusData, system: number): UnicodeAliasStatusEntry[] {
        return data.aliases.filter(alias => alias.system === system);
    }

    public static getAliasForPort(data: UnicodeAliasStatusData, system: number, port: number): UnicodeAliasStatusEntry | null {
        return data.aliases.find(alias => alias.system === system && alias.port === port) || null;
    }

    public static getInhibitedAliases(data: UnicodeAliasStatusData): {
        local: UnicodeAliasStatusEntry[];
        remote: UnicodeAliasStatusEntry[];
        both: UnicodeAliasStatusEntry[];
    } {
        return {
            local: data.aliases.filter(alias => alias.inhibitLocal && !alias.inhibitRemote),
            remote: data.aliases.filter(alias => alias.inhibitRemote && !alias.inhibitLocal),
            both: data.aliases.filter(alias => alias.inhibitLocal && alias.inhibitRemote)
        };
    }

    public static getListenKeyAliases(data: UnicodeAliasStatusData): UnicodeAliasStatusEntry[] {
        return data.aliases.filter(alias => alias.listenKeysOnly);
    }

    public static getNonUnicodeAliases(data: UnicodeAliasStatusData): UnicodeAliasStatusEntry[] {
        return data.aliases.filter(alias => !alias.isUnicode);
    }

    public static getAllSystems(data: UnicodeAliasStatusData): number[] {
        const systems = [...new Set(data.aliases.map(alias => alias.system))];
        return systems.sort((a, b) => a - b);
    }

    public static getAllPortsForSystem(data: UnicodeAliasStatusData, system: number): number[] {
        const ports = data.aliases
            .filter(alias => alias.system === system)
            .map(alias => alias.port);
        return [...new Set(ports)].sort((a, b) => a - b);
    }

    public static formatAliasTable(data: UnicodeAliasStatusData): string {
        if (data.aliases.length === 0) {
            return 'No Unicode alias data';
        }

        const header = 'System | Port | Text           | Flags';
        const separator = '-'.repeat(header.length);

        const rows = data.aliases.map(alias => {
            const sysStr = alias.system.toString().padStart(6);
            const portStr = alias.port.toString().padStart(4);
            const textStr = `"${alias.text}"`.padEnd(15);

            const flags = [];
            if (alias.inhibitLocal) flags.push('IL');
            if (alias.inhibitRemote) flags.push('IR');
            if (alias.listenKeysOnly) flags.push('LO');
            if (!alias.isUnicode) flags.push('NU');
            const flagStr = flags.join(',').padEnd(8);

            return `${sysStr} | ${portStr} | ${textStr} | ${flagStr}`;
        });

        return [header, separator, ...rows].join('\n');
    }
}

export { ReplyUnicodeAliasStatus, UnicodeAliasStatusData, UnicodeAliasStatusEntry };