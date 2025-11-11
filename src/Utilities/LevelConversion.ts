class LevelConversion {
    // Level reference table for common dB values
    private static readonly LEVEL_REFERENCE_TABLE = [
        { dB: -90, level: 0, hex: 0x0000 },
        { dB: -72, level: 18, hex: 0x0012 },
        { dB: -66, level: 35, hex: 0x0023 },
        { dB: -60, level: 52, hex: 0x0034 },
        { dB: -54, level: 69, hex: 0x0045 },
        { dB: -48, level: 86, hex: 0x0056 },
        { dB: -42, level: 103, hex: 0x0067 },
        { dB: -36, level: 119, hex: 0x0077 },
        { dB: -30, level: 136, hex: 0x0088 },
        { dB: -24, level: 153, hex: 0x0099 },
        { dB: -18, level: 170, hex: 0x00AA },
        { dB: -12, level: 179, hex: 0x00B3 },
        { dB: -9, level: 187, hex: 0x00BB },
        { dB: -6, level: 196, hex: 0x00C4 },
        { dB: -3, level: 204, hex: 0x00CC },
        { dB: 0, level: 212, hex: 0x00D4 },
        { dB: 3, level: 221, hex: 0x00DD },
        { dB: 6, level: 229, hex: 0x00E5 },
        { dB: 9, level: 238, hex: 0x00EE },
        { dB: 12, level: 246, hex: 0x00F6 },
        { dB: 15, level: 255, hex: 0x00FF },
        { dB: 18, level: 263, hex: 0x0107 },
        { dB: 21, level: 272, hex: 0x0110 },
        { dB: 24, level: 280, hex: 0x0118 },
        { dB: 27, level: 287, hex: 0x011F }
    ];

    /**
     * Convert dB value to level value using the formula: gain (dB) = (level value - 204) * 0.355
     * Rearranged: level value = (gain (dB) / 0.355) + 204
     */
    public static dBToLevel(dB: number): number {
        // Handle special cases
        if (dB === Number.NEGATIVE_INFINITY || dB < -72) {
            return 0;
        }

        // Check if we have an exact match in the reference table
        const exactMatch = this.LEVEL_REFERENCE_TABLE.find(entry => entry.dB === dB);
        if (exactMatch) {
            return exactMatch.level;
        }

        // Calculate using the formula: level = (dB / 0.355) + 204
        const calculatedLevel = Math.round((dB / 0.355) + 204);

        // Clamp to valid range (0-287 based on table, but spec says 0-255 for message)
        // We'll use 0-287 to match the reference table
        return Math.max(0, Math.min(287, calculatedLevel));
    }

    /**
     * Convert level value to dB using the formula: gain (dB) = (level value - 204) * 0.355
     */
    public static levelToDB(level: number): number {
        // Handle special cases
        if (level === 0) {
            return Number.NEGATIVE_INFINITY;
        }

        // Check if we have an exact match in the reference table
        const exactMatch = this.LEVEL_REFERENCE_TABLE.find(entry => entry.level === level);
        if (exactMatch) {
            return exactMatch.dB;
        }

        // Calculate using the formula: dB = (level - 204) * 0.355
        return (level - 204) * 0.355;
    }

    /**
     * Get the closest reference table entry for a given dB value
     */
    public static getClosestReference(dB: number): { dB: number; level: number; hex: number } | null {
        if (this.LEVEL_REFERENCE_TABLE.length === 0) {
            return null;
        }

        let closest = this.LEVEL_REFERENCE_TABLE[0];
        let minDiff = Math.abs(dB - closest.dB);

        for (const entry of this.LEVEL_REFERENCE_TABLE) {
            const diff = Math.abs(dB - entry.dB);
            if (diff < minDiff) {
                minDiff = diff;
                closest = entry;
            }
        }

        return closest;
    }

    /**
     * Validate that a level value is within acceptable range
     */
    public static isValidLevel(level: number): boolean {
        return Number.isInteger(level) && level >= 0 && level <= 287;
    }

    /**
     * Validate that a dB value can be converted to a valid level
     */
    public static isValidDB(dB: number): boolean {
        if (dB === Number.NEGATIVE_INFINITY) {
            return true; // Maps to level 0
        }

        const level = this.dBToLevel(dB);
        return this.isValidLevel(level);
    }

    /**
     * Get all reference table entries for debugging/display
     */
    public static getReferenceTable(): ReadonlyArray<{ dB: number; level: number; hex: number }> {
        return this.LEVEL_REFERENCE_TABLE;
    }

    /**
     * Format level value as hex string
     */
    public static levelToHex(level: number): string {
        if (!this.isValidLevel(level)) {
            throw new Error(`Invalid level value: ${level}`);
        }
        return `0x${level.toString(16).padStart(4, '0').toUpperCase()}`;
    }

    /**
     * Format dB value for display
     */
    public static formatDB(dB: number): string {
        if (dB === Number.NEGATIVE_INFINITY) {
            return 'CUT';
        }
        const sign = dB >= 0 ? '+' : '';
        return `${sign}${dB.toFixed(1)} dB`;
    }

    /**
     * Get a summary of the conversion
     */
    public static getConversionSummary(input: number, isDB: boolean): string {
        if (isDB) {
            const level = this.dBToLevel(input);
            return `${this.formatDB(input)} → Level ${level} (${this.levelToHex(level)})`;
        } else {
            const dB = this.levelToDB(input);
            return `Level ${input} (${this.levelToHex(input)}) → ${this.formatDB(dB)}`;
        }
    }
}

export default LevelConversion;