import LevelConversion from '../Utilities/LevelConversion';

interface OutputLevelEntry {
    port: number;          // Port number (1-1024, converted from 0-1023)
    levelValue: number;    // Level value (0-255)
    levelDB: number;       // Converted dB value
}

interface OutputLevelStatusData {
    messageType: 'outputLevelStatus';
    messageID: number;
    timestamp: string;
    isUpdate: boolean;     // true if update flag set (response to action), false if status response
    count: number;
    levels: OutputLevelEntry[];
    rawPayload: string;
}

class ReplyOutputLevelStatus {
    public static parse(payload: Buffer, flags: any): OutputLevelStatusData | null {
        // Check minimum payload size
        // Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('Output level status reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw output level status payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Count (2 bytes)
        const count = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing output level status with count: ${count}`);

        // Determine if this is an update (response to action) or status response
        const isUpdate = flags.U || false;
        console.log(`Response type: ${isUpdate ? 'Action Response (Update flag set)' : 'Status Response (Update flag clear)'}`);

        // Validate we have enough data for all level entries
        // Each entry is 4 bytes: Port number (2) + Level value (2)
        const expectedDataSize = count * 4;
        if (payload.length < 2 + expectedDataSize) {
            console.error(`Insufficient data: need ${2 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const levels: OutputLevelEntry[] = [];

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
            messageType: 'outputLevelStatus',
            messageID: 0x0025,
            timestamp: new Date().toISOString(),
            isUpdate,
            count,
            levels,
            rawPayload: payload.toString('hex')
        };
    }

    public static getLevelSummary(data: OutputLevelStatusData): string {
        if (data.levels.length === 0) {
            return data.isUpdate ? 'No output levels changed' : 'No active output levels (all ports at level 0 or full cut)';
        }

        const typeStr = data.isUpdate ? 'Changed' : 'Active';
        const summary = data.levels.map((level, index) => {
            const dbStr = LevelConversion.formatDB(level.levelDB);
            const cutNote = level.levelValue === 0 ? ' (Full Cut)' : '';
            return `${index + 1}. Port ${level.port}: Level ${level.levelValue} (${dbStr})${cutNote}`;
        });

        return `${typeStr} Output Levels:\n${summary.join('\n')}`;
    }

    public static displayOutputLevelStatus(data: OutputLevelStatusData): void {
        console.log('=== Output Level Status Reply ===');
        console.log(`Response Type: ${data.isUpdate ? 'Action Response (levels changed)' : 'Status Response (current levels)'}`);
        console.log(`Count: ${data.count}`);
        console.log(`Levels: ${data.levels.length}`);
        console.log(`Timestamp: ${data.timestamp}`);

        if (data.isUpdate) {
            console.log('Note: Shows ports altered by action request (including level 0)');
        } else {
            console.log('Note: Shows all active ports (excluding level 0/full cut)');
        }
        console.log('');

        if (data.levels.length > 0) {
            data.levels.forEach((level, index) => {
                const dbStr = LevelConversion.formatDB(level.levelDB);
                const levelBar = ReplyOutputLevelStatus.createLevelBar(level.levelValue);
                const cutIcon = level.levelValue === 0 ? '🔇' : '';
                const rangeIcon = ReplyOutputLevelStatus.getRangeIcon(level.levelDB);

                console.log(`${index + 1}. Port ${level.port.toString().padStart(4)}: Level ${level.levelValue.toString().padStart(3)} (${dbStr.padStart(8)}) ${levelBar} ${rangeIcon}${cutIcon}`);
            });

            console.log('');

            // Summary statistics
            const stats = ReplyOutputLevelStatus.getLevelStats(data);
            console.log('--- Summary ---');
            console.log(`Total Ports: ${data.levels.length}`);
            console.log(`Level Range: ${stats.minLevel} - ${stats.maxLevel}`);
            console.log(`dB Range: ${LevelConversion.formatDB(stats.minDB)} to ${LevelConversion.formatDB(stats.maxDB)}`);
            console.log(`Average Level: ${stats.avgLevel.toFixed(1)}`);
            console.log(`Average dB: ${LevelConversion.formatDB(stats.avgDB)}`);
            console.log(`Unity Gain Ports: ${stats.unityGainPorts}`);
            console.log(`Full Cut Ports: ${stats.fullCutPorts}`);
            console.log(`Out of Range: ${stats.outOfRangePorts}`);
        } else {
            if (data.isUpdate) {
                console.log('No output port levels were changed by the action request');
            } else {
                console.log('All output ports are at level 0 (full cut)');
            }
        }
        console.log('==================================');
    }

    // Helper methods for filtering and analysis
    public static getLevelForPort(data: OutputLevelStatusData, port: number): OutputLevelEntry | null {
        return data.levels.find(level => level.port === port) || null;
    }

    public static getPortsInRange(data: OutputLevelStatusData, minDB: number, maxDB: number): OutputLevelEntry[] {
        return data.levels.filter(level => level.levelDB >= minDB && level.levelDB <= maxDB);
    }

    public static getPortsAboveLevel(data: OutputLevelStatusData, thresholdDB: number): OutputLevelEntry[] {
        return data.levels.filter(level => level.levelDB >= thresholdDB);
    }

    public static getPortsBelowLevel(data: OutputLevelStatusData, thresholdDB: number): OutputLevelEntry[] {
        return data.levels.filter(level => level.levelDB <= thresholdDB);
    }

    public static getUnityGainPorts(data: OutputLevelStatusData): OutputLevelEntry[] {
        // Unity gain is level 204 (0 dB)
        return data.levels.filter(level => level.levelValue === 204);
    }

    public static getFullCutPorts(data: OutputLevelStatusData): OutputLevelEntry[] {
        // Full cut is level 0
        return data.levels.filter(level => level.levelValue === 0);
    }

    public static getActivePorts(data: OutputLevelStatusData): number[] {
        return data.levels.filter(level => level.levelValue > 0).map(level => level.port).sort((a, b) => a - b);
    }

    public static getOutOfRangePorts(data: OutputLevelStatusData): OutputLevelEntry[] {
        // Output range should be -72dB to +18dB
        return data.levels.filter(level =>
            level.levelValue > 0 && // Exclude full cut (level 0)
            level.levelDB !== Number.NEGATIVE_INFINITY &&
            (level.levelDB < -72 || level.levelDB > 18)
        );
    }

    public static getLevelStats(data: OutputLevelStatusData): {
        minLevel: number;
        maxLevel: number;
        avgLevel: number;
        minDB: number;
        maxDB: number;
        avgDB: number;
        unityGainPorts: number;
        fullCutPorts: number;
        outOfRangePorts: number;
        totalPorts: number;
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
                fullCutPorts: 0,
                outOfRangePorts: 0,
                totalPorts: 0
            };
        }

        const levels = data.levels.map(l => l.levelValue);
        const dbValues = data.levels.map(l => l.levelDB).filter(db => db !== Number.NEGATIVE_INFINITY);
        const unityGainPorts = data.levels.filter(l => l.levelValue === 204).length;
        const fullCutPorts = data.levels.filter(l => l.levelValue === 0).length;
        const outOfRangePorts = ReplyOutputLevelStatus.getOutOfRangePorts(data).length;

        return {
            minLevel: Math.min(...levels),
            maxLevel: Math.max(...levels),
            avgLevel: levels.reduce((sum, l) => sum + l, 0) / levels.length,
            minDB: dbValues.length > 0 ? Math.min(...dbValues) : Number.NEGATIVE_INFINITY,
            maxDB: dbValues.length > 0 ? Math.max(...dbValues) : Number.NEGATIVE_INFINITY,
            avgDB: dbValues.length > 0 ? dbValues.reduce((sum, db) => sum + db, 0) / dbValues.length : Number.NEGATIVE_INFINITY,
            unityGainPorts,
            fullCutPorts,
            outOfRangePorts,
            totalPorts: data.levels.length
        };
    }

    public static formatLevelTable(data: OutputLevelStatusData): string {
        if (data.levels.length === 0) {
            return data.isUpdate ? 'No output levels changed' : 'No active output levels (all ports at level 0)';
        }

        const header = 'Port | Level | dB Value | Range | Status';
        const separator = '-'.repeat(60);

        const rows = data.levels.map(level => {
            const portStr = level.port.toString().padStart(4);
            const levelStr = level.levelValue.toString().padStart(5);
            const dbStr = LevelConversion.formatDB(level.levelDB).padStart(8);
            const rangeStr = ReplyOutputLevelStatus.getRangeStatus(level.levelDB).padStart(5);
            const statusStr = level.levelValue === 0 ? 'FULL CUT' : 'ACTIVE';

            return `${portStr} | ${levelStr} | ${dbStr} | ${rangeStr} | ${statusStr}`;
        });

        const typeHeader = data.isUpdate ? 'Changed Output Levels:' : 'Active Output Levels:';
        return `${typeHeader}\n${header}\n${separator}\n${rows.join('\n')}`;
    }

    // Create a visual level bar
    private static createLevelBar(levelValue: number): string {
        if (levelValue === 0) {
            return '🔇────────────────────'; // Full cut indicator
        }

        const maxBars = 20;
        const percentage = levelValue / 255;
        const bars = Math.round(percentage * maxBars);
        const filled = '█'.repeat(bars);
        const empty = '░'.repeat(maxBars - bars);
        return `${filled}${empty}`;
    }

    // Get range status icon
    private static getRangeIcon(levelDB: number): string {
        if (levelDB === Number.NEGATIVE_INFINITY) return '';
        if (levelDB < -72) return '⚠️ '; // Too low
        if (levelDB > 18) return '🔥'; // Too high
        if (levelDB > 12) return '⚡'; // High but acceptable
        if (levelDB < -60) return '🔻'; // Low but acceptable
        return '✅'; // Good range
    }

    // Get range status string
    private static getRangeStatus(levelDB: number): string {
        if (levelDB === Number.NEGATIVE_INFINITY) return 'CUT';
        if (levelDB < -72) return 'LOW!';
        if (levelDB > 18) return 'HIGH!';
        if (levelDB > 12) return 'HIGH';
        if (levelDB < -60) return 'LOW';
        return 'OK';
    }

    // Get ports grouped by level ranges (output-specific ranges)
    public static getPortsByLevelRange(data: OutputLevelStatusData): {
        fullCut: OutputLevelEntry[];      // Level 0 (full cut)
        veryLow: OutputLevelEntry[];      // -72 dB to -40 dB
        low: OutputLevelEntry[];          // -40 dB to -20 dB
        mid: OutputLevelEntry[];          // -20 dB to -6 dB  
        high: OutputLevelEntry[];         // -6 dB to 0 dB
        unity: OutputLevelEntry[];        // 0 dB (level 204)
        boosted: OutputLevelEntry[];      // 0 dB to +12 dB
        veryHigh: OutputLevelEntry[];     // +12 dB to +18 dB
        outOfRange: OutputLevelEntry[];   // Outside -72 dB to +18 dB
    } {
        return {
            fullCut: data.levels.filter(l => l.levelValue === 0),
            veryLow: data.levels.filter(l => l.levelValue > 0 && l.levelDB >= -72 && l.levelDB < -40),
            low: data.levels.filter(l => l.levelDB >= -40 && l.levelDB < -20),
            mid: data.levels.filter(l => l.levelDB >= -20 && l.levelDB < -6),
            high: data.levels.filter(l => l.levelDB >= -6 && l.levelDB < 0),
            unity: data.levels.filter(l => l.levelValue === 204), // Exactly 0 dB
            boosted: data.levels.filter(l => l.levelDB > 0 && l.levelDB <= 12),
            veryHigh: data.levels.filter(l => l.levelDB > 12 && l.levelDB <= 18),
            outOfRange: ReplyOutputLevelStatus.getOutOfRangePorts(data)
        };
    }

    // Compare with a previous state (for change detection)
    public static compareLevels(current: OutputLevelStatusData, previous: OutputLevelStatusData): {
        added: OutputLevelEntry[];
        removed: number[];
        changed: { port: number; oldLevel: number; newLevel: number; oldDB: number; newDB: number }[];
        unchanged: OutputLevelEntry[];
    } {
        const currentPorts = new Map(current.levels.map(l => [l.port, l]));
        const previousPorts = new Map(previous.levels.map(l => [l.port, l]));

        const added: OutputLevelEntry[] = [];
        const changed: { port: number; oldLevel: number; newLevel: number; oldDB: number; newDB: number }[] = [];
        const unchanged: OutputLevelEntry[] = [];

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

        // Check for removed ports (went to level 0 or full cut)
        const removed = Array.from(previousPorts.keys()).filter(port => !currentPorts.has(port));

        return { added, removed, changed, unchanged };
    }
}

export { ReplyOutputLevelStatus, OutputLevelStatusData, OutputLevelEntry };