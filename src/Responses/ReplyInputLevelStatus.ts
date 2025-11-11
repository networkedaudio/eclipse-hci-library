import LevelConversion from '../Utilities/LevelConversion';

interface InputLevelEntry {
    port: number;          // Port number (1-1024, converted from 0-1023)
    levelValue: number;    // Level value (0-255)
    levelDB: number;       // Converted dB value
}

interface InputLevelStatusData {
    messageType: 'inputLevelStatus';
    messageID: number;
    timestamp: string;
    count: number;
    levels: InputLevelEntry[];
    rawPayload: string;
}

class ReplyInputLevelStatus {
    public static parse(payload: Buffer): InputLevelStatusData | null {
        // Check minimum payload size
        // Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('Input level status reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw input level status payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Count (2 bytes)
        const count = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing input level status with count: ${count}`);

        // Validate we have enough data for all level entries
        // Each entry is 4 bytes: Port number (2) + Level value (2)
        const expectedDataSize = count * 4;
        if (payload.length < 2 + expectedDataSize) {
            console.error(`Insufficient data: need ${2 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const levels: InputLevelEntry[] = [];

        // Parse each level entry
        for (let i = 0; i < count; i++) {
            if (offset + 4 > payload.length) {
                console.error(`Insufficient data for level entry ${i + 1}`);
                return null;
            }

            // Port number (2 bytes) - convert from 0-indexed to 1-indexed
            const portRaw = payload.readUInt16BE(offset);
            offset += 2;

            // Level value (2 bytes)
            const levelValue = payload.readUInt16BE(offset);
            offset += 2;

            const port = portRaw + 1; // Convert from 0-indexed to 1-indexed
            const levelDB = LevelConversion.levelToDB(levelValue);

            console.log(`Level entry ${i + 1}: Port=${port} (raw=${portRaw}), Level=${levelValue}, dB=${LevelConversion.formatDB(levelDB)}`);

            levels.push({
                port,
                levelValue,
                levelDB
            });
        }

        return {
            messageType: 'inputLevelStatus',
            messageID: 0x0022,
            timestamp: new Date().toISOString(),
            count,
            levels,
            rawPayload: payload.toString('hex')
        };
    }

    public static getLevelSummary(data: InputLevelStatusData): string {
        if (data.levels.length === 0) {
            return 'No input levels (all ports at level 0)';
        }

        const summary = data.levels.map((level, index) => {
            const dbStr = LevelConversion.formatDB(level.levelDB);
            return `${index + 1}. Port ${level.port}: Level ${level.levelValue} (${dbStr})`;
        });

        return summary.join('\n');
    }

    public static displayInputLevelStatus(data: InputLevelStatusData): void {
        console.log('=== Input Level Status Reply ===');
        console.log(`Count: ${data.count}`);
        console.log(`Active Levels: ${data.levels.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('Note: Only non-zero levels are included in this reply');
        console.log('');

        if (data.levels.length > 0) {
            data.levels.forEach((level, index) => {
                const dbStr = LevelConversion.formatDB(level.levelDB);
                const levelBar = ReplyInputLevelStatus.createLevelBar(level.levelValue);
                console.log(`${index + 1}. Port ${level.port.toString().padStart(4)}: Level ${level.levelValue.toString().padStart(3)} (${dbStr.padStart(8)}) ${levelBar}`);
            });

            console.log('');

            // Summary statistics
            const stats = ReplyInputLevelStatus.getLevelStats(data);
            console.log('--- Summary ---');
            console.log(`Total Active Ports: ${data.levels.length}`);
            console.log(`Level Range: ${stats.minLevel} - ${stats.maxLevel}`);
            console.log(`dB Range: ${LevelConversion.formatDB(stats.minDB)} to ${LevelConversion.formatDB(stats.maxDB)}`);
            console.log(`Average Level: ${stats.avgLevel.toFixed(1)}`);
            console.log(`Average dB: ${LevelConversion.formatDB(stats.avgDB)}`);
            console.log(`Unity Gain Ports: ${stats.unityGainPorts}`);
            console.log(`Muted Ports: All ports not listed (level 0)`);
        } else {
            console.log('All input ports are at level 0 (muted)');
        }
        console.log('================================');
    }

    // Helper methods for filtering and analysis
    public static getLevelForPort(data: InputLevelStatusData, port: number): InputLevelEntry | null {
        return data.levels.find(level => level.port === port) || null;
    }

    public static getPortsInRange(data: InputLevelStatusData, minDB: number, maxDB: number): InputLevelEntry[] {
        return data.levels.filter(level => level.levelDB >= minDB && level.levelDB <= maxDB);
    }

    public static getPortsAboveLevel(data: InputLevelStatusData, thresholdDB: number): InputLevelEntry[] {
        return data.levels.filter(level => level.levelDB >= thresholdDB);
    }

    public static getPortsBelowLevel(data: InputLevelStatusData, thresholdDB: number): InputLevelEntry[] {
        return data.levels.filter(level => level.levelDB <= thresholdDB);
    }

    public static getUnityGainPorts(data: InputLevelStatusData): InputLevelEntry[] {
        // Unity gain is level 204 (0 dB)
        return data.levels.filter(level => level.levelValue === 204);
    }

    public static getActivePorts(data: InputLevelStatusData): number[] {
        return data.levels.map(level => level.port).sort((a, b) => a - b);
    }

    public static getLevelStats(data: InputLevelStatusData): {
        minLevel: number;
        maxLevel: number;
        avgLevel: number;
        minDB: number;
        maxDB: number;
        avgDB: number;
        unityGainPorts: number;
        totalActivePorts: number;
    } {
        if (data.levels.length === 0) {
            return {
                minLevel: 0,
                maxLevel: 0,
                avgLevel: 0,
                minDB: Number.NEGATIVE_INFINITY,
                maxDB: Number.NEGATIVE_INFINITY,
                avgDB: Number.NEGATIVE_INFINITY,
                unityGainPorts: 0,
                totalActivePorts: 0
            };
        }

        const levels = data.levels.map(l => l.levelValue);
        const dbValues = data.levels.map(l => l.levelDB).filter(db => db !== Number.NEGATIVE_INFINITY);
        const unityGainPorts = data.levels.filter(l => l.levelValue === 204).length;

        return {
            minLevel: Math.min(...levels),
            maxLevel: Math.max(...levels),
            avgLevel: levels.reduce((sum, l) => sum + l, 0) / levels.length,
            minDB: dbValues.length > 0 ? Math.min(...dbValues) : Number.NEGATIVE_INFINITY,
            maxDB: dbValues.length > 0 ? Math.max(...dbValues) : Number.NEGATIVE_INFINITY,
            avgDB: dbValues.length > 0 ? dbValues.reduce((sum, db) => sum + db, 0) / dbValues.length : Number.NEGATIVE_INFINITY,
            unityGainPorts,
            totalActivePorts: data.levels.length
        };
    }

    public static formatLevelTable(data: InputLevelStatusData): string {
        if (data.levels.length === 0) {
            return 'No active input levels (all ports at level 0)';
        }

        const header = 'Port | Level | dB Value | Visual';
        const separator = '-'.repeat(50);

        const rows = data.levels.map(level => {
            const portStr = level.port.toString().padStart(4);
            const levelStr = level.levelValue.toString().padStart(5);
            const dbStr = LevelConversion.formatDB(level.levelDB).padStart(8);
            const visual = ReplyInputLevelStatus.createLevelBar(level.levelValue);
            return `${portStr} | ${levelStr} | ${dbStr} | ${visual}`;
        });

        return [header, separator, ...rows].join('\n');
    }

    // Create a visual level bar
    private static createLevelBar(levelValue: number): string {
        const maxBars = 20;
        const percentage = levelValue / 255;
        const bars = Math.round(percentage * maxBars);
        const filled = '█'.repeat(bars);
        const empty = '░'.repeat(maxBars - bars);
        return `${filled}${empty}`;
    }

    // Get ports grouped by level ranges
    public static getPortsByLevelRange(data: InputLevelStatusData): {
        muted: number[];        // Level 0 (these won't be in the response, but for completeness)
        low: InputLevelEntry[]; // -60 dB to -20 dB
        mid: InputLevelEntry[]; // -20 dB to -6 dB  
        high: InputLevelEntry[]; // -6 dB to 0 dB
        unity: InputLevelEntry[]; // 0 dB (level 204)
        boosted: InputLevelEntry[]; // Above 0 dB
    } {
        return {
            muted: [], // These ports aren't included in the response
            low: data.levels.filter(l => l.levelDB >= -60 && l.levelDB < -20),
            mid: data.levels.filter(l => l.levelDB >= -20 && l.levelDB < -6),
            high: data.levels.filter(l => l.levelDB >= -6 && l.levelDB < 0),
            unity: data.levels.filter(l => l.levelValue === 204), // Exactly 0 dB
            boosted: data.levels.filter(l => l.levelDB > 0)
        };
    }

    // Find ports that might need attention (very low or very high levels)
    public static getProblematicPorts(data: InputLevelStatusData): {
        veryLow: InputLevelEntry[];  // Below -40 dB
        veryHigh: InputLevelEntry[]; // Above +6 dB
    } {
        return {
            veryLow: data.levels.filter(l => l.levelDB < -40),
            veryHigh: data.levels.filter(l => l.levelDB > 6)
        };
    }

    // Compare with a previous state (for change detection)
    public static compareLevels(current: InputLevelStatusData, previous: InputLevelStatusData): {
        added: InputLevelEntry[];
        removed: number[];
        changed: { port: number; oldLevel: number; newLevel: number; oldDB: number; newDB: number }[];
        unchanged: InputLevelEntry[];
    } {
        const currentPorts = new Map(current.levels.map(l => [l.port, l]));
        const previousPorts = new Map(previous.levels.map(l => [l.port, l]));

        const added: InputLevelEntry[] = [];
        const changed: { port: number; oldLevel: number; newLevel: number; oldDB: number; newDB: number }[] = [];
        const unchanged: InputLevelEntry[] = [];

        // Check current levels
        for (const [port, currentLevel] of currentPorts) {
            const previousLevel = previousPorts.get(port);
            if (!previousLevel) {
                added.push(currentLevel);
            } else if (previousLevel.levelValue !== currentLevel.levelValue) {
                changed.push({
                    port,
                    oldLevel: previousLevel.levelValue,
                    newLevel: currentLevel.levelValue,
                    oldDB: previousLevel.levelDB,
                    newDB: currentLevel.levelDB
                });
            } else {
                unchanged.push(currentLevel);
            }
        }

        // Check for removed ports (went to level 0)
        const removed = Array.from(previousPorts.keys()).filter(port => !currentPorts.has(port));

        return { added, removed, changed, unchanged };
    }
}

export { ReplyInputLevelStatus, InputLevelStatusData, InputLevelEntry };