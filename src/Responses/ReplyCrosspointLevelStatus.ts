import LevelConversion from '../Utilities/LevelConversion';

interface CrosspointLevelData {
    destinationPort: number;  // 1-1024 (user-friendly, 1-indexed)
    sourcePort: number;       // 1-1024 (user-friendly, 1-indexed)
    levelValue: number;       // 0-255 (raw level value from message)
    levelDB: number;          // Converted dB value
}

interface CrosspointLevelStatusData {
    messageType: 'crosspointLevelStatus';
    messageID: number;
    timestamp: string;
    count: number;
    levelData: CrosspointLevelData[];
    rawPayload: string;
}

class ReplyCrosspointLevelStatus {
    public static parse(payload: Buffer): CrosspointLevelStatusData | null {
        // Check minimum payload size
        // Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('Crosspoint level status reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw crosspoint level payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Count (2 bytes)
        const count = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing crosspoint level status with count: ${count}`);

        // Validate we have enough data for all entries
        // Each entry is 6 bytes: Destination Port (2) + Source Port (2) + Level Value (2)
        const expectedDataSize = count * 6;
        if (payload.length < 2 + expectedDataSize) {
            console.error(`Insufficient data: need ${2 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const levelData: CrosspointLevelData[] = [];

        // Parse each crosspoint level entry
        for (let i = 0; i < count; i++) {
            if (offset + 6 > payload.length) {
                console.error(`Insufficient data for level entry ${i + 1}`);
                return null;
            }

            // Read destination port (2 bytes) and convert from 0-indexed to 1-indexed
            const destinationPort = payload.readUInt16BE(offset) + 1;
            offset += 2;

            // Read source port (2 bytes) and convert from 0-indexed to 1-indexed
            const sourcePort = payload.readUInt16BE(offset) + 1;
            offset += 2;

            // Read level value (2 bytes)
            const levelValue = payload.readUInt16BE(offset);
            offset += 2;

            // Convert level to dB using the conversion utility
            const levelDB = LevelConversion.levelToDB(levelValue);

            console.log(`Level entry ${i + 1}: Dest=${destinationPort}, Src=${sourcePort}, Level=${levelValue}, dB=${LevelConversion.formatDB(levelDB)}`);

            levelData.push({
                destinationPort,
                sourcePort,
                levelValue,
                levelDB
            });
        }

        return {
            messageType: 'crosspointLevelStatus',
            messageID: 0x0028,
            timestamp: new Date().toISOString(),
            count,
            levelData,
            rawPayload: payload.toString('hex')
        };
    }

    public static getLevelSummary(data: CrosspointLevelStatusData): string {
        if (data.levelData.length === 0) {
            return 'No crosspoint levels';
        }

        const summary = data.levelData.map((level, index) => {
            const dbStr = LevelConversion.formatDB(level.levelDB);
            return `${index + 1}. Port ${level.sourcePort} → Port ${level.destinationPort}: ${dbStr} (Level ${level.levelValue})`;
        });

        return summary.join('\n');
    }

    public static displayCrosspointLevelStatus(data: CrosspointLevelStatusData): void {
        console.log('=== Crosspoint Level Status Reply ===');
        console.log(`Count: ${data.count}`);
        console.log(`Level Entries: ${data.levelData.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.levelData.length > 0) {
            data.levelData.forEach((level, index) => {
                const dbStr = LevelConversion.formatDB(level.levelDB);
                console.log(`${index + 1}. Port ${level.sourcePort} → Port ${level.destinationPort}:`);
                console.log(`   Level: ${level.levelValue} (${dbStr})`);
                console.log('');
            });
        } else {
            console.log('No crosspoint levels in response');
        }
        console.log('====================================');
    }

    // Helper methods for filtering and analysis
    public static getLevelsForDestination(data: CrosspointLevelStatusData, destinationPort: number): CrosspointLevelData[] {
        return data.levelData.filter(level => level.destinationPort === destinationPort);
    }

    public static getLevelsForSource(data: CrosspointLevelStatusData, sourcePort: number): CrosspointLevelData[] {
        return data.levelData.filter(level => level.sourcePort === sourcePort);
    }

    public static getLevelBetweenPorts(data: CrosspointLevelStatusData, sourcePort: number, destinationPort: number): CrosspointLevelData | null {
        return data.levelData.find(level =>
            level.sourcePort === sourcePort && level.destinationPort === destinationPort
        ) || null;
    }

    public static getAllDestinationPorts(data: CrosspointLevelStatusData): number[] {
        const ports = [...new Set(data.levelData.map(level => level.destinationPort))];
        return ports.sort((a, b) => a - b);
    }

    public static getAllSourcePorts(data: CrosspointLevelStatusData): number[] {
        const ports = [...new Set(data.levelData.map(level => level.sourcePort))];
        return ports.sort((a, b) => a - b);
    }

    public static getLevelStats(data: CrosspointLevelStatusData): {
        minLevel: number;
        maxLevel: number;
        avgLevel: number;
        minDB: number;
        maxDB: number;
        avgDB: number;
    } | null {
        if (data.levelData.length === 0) {
            return null;
        }

        const levels = data.levelData.map(l => l.levelValue);
        const dbValues = data.levelData.map(l => l.levelDB).filter(db => db !== Number.NEGATIVE_INFINITY);

        return {
            minLevel: Math.min(...levels),
            maxLevel: Math.max(...levels),
            avgLevel: levels.reduce((sum, l) => sum + l, 0) / levels.length,
            minDB: dbValues.length > 0 ? Math.min(...dbValues) : Number.NEGATIVE_INFINITY,
            maxDB: dbValues.length > 0 ? Math.max(...dbValues) : Number.NEGATIVE_INFINITY,
            avgDB: dbValues.length > 0 ? dbValues.reduce((sum, db) => sum + db, 0) / dbValues.length : Number.NEGATIVE_INFINITY
        };
    }

    public static getCutConnections(data: CrosspointLevelStatusData): CrosspointLevelData[] {
        return data.levelData.filter(level => level.levelValue === 0);
    }

    public static getActiveConnections(data: CrosspointLevelStatusData): CrosspointLevelData[] {
        return data.levelData.filter(level => level.levelValue > 0);
    }

    public static formatLevelTable(data: CrosspointLevelStatusData): string {
        if (data.levelData.length === 0) {
            return 'No crosspoint level data';
        }

        const header = 'Source → Destination | Level | dB Value';
        const separator = '-'.repeat(header.length);

        const rows = data.levelData.map(level => {
            const connection = `${level.sourcePort.toString().padStart(3)} → ${level.destinationPort.toString().padEnd(3)}`;
            const levelStr = level.levelValue.toString().padStart(5);
            const dbStr = LevelConversion.formatDB(level.levelDB).padStart(8);
            return `${connection.padEnd(18)} | ${levelStr} | ${dbStr}`;
        });

        return [header, separator, ...rows].join('\n');
    }
}

export { ReplyCrosspointLevelStatus, CrosspointLevelStatusData, CrosspointLevelData };