interface CardInfo {
    slotNumber: number;         // Derived from array position
    condition: CardCondition;   // Card condition (0-2)
    conditionName: string;      // Human-readable condition
    cardType: number;         // Card type (0-127)
    cardTypeName: string;       // Human-readable card type
    isSlot0: boolean;          // Whether this is slot 0 of the rack
    isPresent: boolean;        // Convenience property (condition !== 2)
    isGood: boolean;           // Convenience property (condition === 1)
    isFaulty: boolean;         // Convenience property (condition === 2 but was present)
}

type CardCondition = 0 | 1 | 2;  // Unknown | Good | Faulty/Absent
type CardType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 11 | 14 | 16 | 17 | 18 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79 | 80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 | 92 | 93 | 94 | 95 | 96 | 97 | 98 | 99 | 100 | 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109 | 110 | 111 | 112 | 113 | 114 | 115 | 116 | 117 | 118 | 119 | 120 | 121 | 122 | 123 | 124 | 125 | 126 | 127;

interface SystemCardStatusData {
    messageType: 'systemCardStatus';
    messageID: number;
    timestamp: string;
    isUpdate: boolean;          // true if automatic update, false if response to request
    count: number;
    cards: CardInfo[];
    rawPayload: string;
}

class ReplySystemCardStatus {
    private static readonly CARD_CONDITIONS: Record<CardCondition, string> = {
        0: 'Unknown',
        1: 'Good',
        2: 'Faulty/Absent'
    };

    private static readonly CARD_TYPES: Record<number, string> = {
        0: 'Unknown',
        1: 'CPU Master',
        2: 'CPU Slave',
        3: 'MVX',
        4: 'E-MADI',
        5: 'E-DANTE',
        6: 'E-IPA',
        11: 'Reserved',
        14: 'Reserved',
        16: 'Reserved',
        17: 'Reserved',
        18: 'Reserved',
        23: 'PCM30',
        26: 'E-FIB',
        27: 'EQUE/IVC32/LMC64'
        // 24-127 are reserved (will show as "Reserved Type X")
    };

    public static parse(payload: Buffer, flags: any): SystemCardStatusData | null {
        // Check minimum payload size
        // Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('System card status reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw system card status payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Count (2 bytes)
        const count = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing system card status with count: ${count}`);

        // Determine if this is an update (card state change) or response to request
        const isUpdate = flags.U || false;
        console.log(`Response type: ${isUpdate ? 'Automatic Update (card state changes)' : 'Status Response (all cards)'}`);

        // Validate we have enough data for all card entries
        // Each entry is 2 bytes: Status (2)
        const expectedDataSize = count * 2;
        if (payload.length < 2 + expectedDataSize) {
            console.error(`Insufficient data: need ${2 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const cards: CardInfo[] = [];

        // Parse each card entry
        for (let i = 0; i < count; i++) {
            if (offset + 2 > payload.length) {
                console.error(`Insufficient data for card entry ${i + 1}`);
                return null;
            }

            // Status (2 bytes)
            const status = payload.readUInt16BE(offset);
            offset += 2;

            // Extract fields from status word
            const condition = (status & 0xFF) as CardCondition;        // bits 0-7: condition
            const cardType = (status >> 8) & 0x7F;                     // bits 8-14: card type (7 bits)
            const isSlot0 = (status & 0x8000) !== 0;                   // bit 15: slot 0 flag

            // Slot number is derived from array position
            const slotNumber = i;

            // Get human-readable names
            const conditionName = this.CARD_CONDITIONS[condition] || `Unknown Condition ${condition}`;
            const cardTypeName = this.getCardTypeName(cardType);

            // Determine status flags
            const isPresent = condition !== 2;      // Not faulty/absent
            const isGood = condition === 1;         // Good condition
            const isFaulty = condition === 2;       // Faulty/absent

            console.log(`Card entry ${i + 1}: Slot=${slotNumber}, Type=${cardType} (${cardTypeName}), Condition=${condition} (${conditionName}), Slot0=${isSlot0}, Status=0x${status.toString(16).padStart(4, '0')}`);

            cards.push({
                slotNumber,
                condition,
                conditionName,
                cardType,
                cardTypeName,
                isSlot0,
                isPresent,
                isGood,
                isFaulty
            });
        }

        return {
            messageType: 'systemCardStatus',
            messageID: 0x0004,
            timestamp: new Date().toISOString(),
            isUpdate,
            count,
            cards,
            rawPayload: payload.toString('hex')
        };
    }

    private static getCardTypeName(cardType: number): string {
        if (this.CARD_TYPES[cardType]) {
            return this.CARD_TYPES[cardType];
        }

        // Handle reserved ranges
        if ((cardType >= 16 && cardType <= 18) ||
            (cardType >= 24 && cardType <= 127) ||
            cardType === 11 || cardType === 14) {
            return `Reserved Type ${cardType}`;
        }

        return `Unknown Type ${cardType}`;
    }

    public static getCardSummary(data: SystemCardStatusData): string {
        if (data.cards.length === 0) {
            return data.isUpdate ? 'No card state changes' : 'No cards found in system';
        }

        const typeStr = data.isUpdate ? 'Changed Cards' : 'System Cards';
        const summary = data.cards.map((card, index) => {
            const statusIcon = card.isGood ? '🟢' : card.isFaulty ? '🔴' : '⚫';
            const slot0Icon = card.isSlot0 ? ' [S0]' : '';
            return `${index + 1}. Slot ${card.slotNumber}: ${card.cardTypeName} - ${card.conditionName} ${statusIcon}${slot0Icon}`;
        });

        return `${typeStr}:\n${summary.join('\n')}`;
    }

    public static displaySystemCardStatus(data: SystemCardStatusData): void {
        console.log('=== System Card Status Reply ===');
        console.log(`Response Type: ${data.isUpdate ? 'Automatic Update (card changes)' : 'Complete Status Response'}`);
        console.log(`Count: ${data.count}`);
        console.log(`Cards: ${data.cards.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.cards.length > 0) {
            data.cards.forEach((card, index) => {
                const statusIcon = card.isGood ? '🟢 GOOD' : card.isFaulty ? '🔴 FAULTY/ABSENT' : '⚫ UNKNOWN';
                const slot0Badge = card.isSlot0 ? ' [SLOT 0]' : '';

                console.log(`${index + 1}. Slot ${card.slotNumber.toString().padStart(2)}: ${card.cardTypeName}`);
                console.log(`    Status: ${statusIcon}${slot0Badge}`);
                console.log('');
            });

            // Summary statistics
            const stats = ReplySystemCardStatus.getCardStats(data);
            console.log('--- Summary ---');
            console.log(`Total Card Slots: ${data.cards.length}`);
            console.log(`Good: ${stats.good} | Faulty/Absent: ${stats.faulty} | Unknown: ${stats.unknown}`);
            console.log(`Present: ${stats.present} | Slot 0 Cards: ${stats.slot0Cards}`);
            console.log(`Card Types: ${Object.keys(stats.byType).length} different types`);

            // Show critical cards
            const criticalCards = ReplySystemCardStatus.getCriticalCards(data);
            if (criticalCards.length > 0) {
                console.log(`Critical Cards: ${criticalCards.length} (CPU Master/Slave)`);
            }

            // Show type breakdown
            console.log('\nCard Type Breakdown:');
            Object.entries(stats.byType).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
            });
        } else {
            if (data.isUpdate) {
                console.log('No card state changes detected');
            } else {
                console.log('No cards found in the system');
            }
        }
        console.log('===============================');
    }

    // Helper methods for filtering and analysis
    public static getGoodCards(data: SystemCardStatusData): CardInfo[] {
        return data.cards.filter(card => card.isGood);
    }

    public static getFaultyCards(data: SystemCardStatusData): CardInfo[] {
        return data.cards.filter(card => card.isFaulty);
    }

    public static getUnknownCards(data: SystemCardStatusData): CardInfo[] {
        return data.cards.filter(card => card.condition === 0);
    }

    public static getPresentCards(data: SystemCardStatusData): CardInfo[] {
        return data.cards.filter(card => card.isPresent);
    }

    public static getSlot0Cards(data: SystemCardStatusData): CardInfo[] {
        return data.cards.filter(card => card.isSlot0);
    }

    public static getCardsByType(data: SystemCardStatusData, cardType: number): CardInfo[] {
        return data.cards.filter(card => card.cardType === cardType);
    }

    public static getCPUCards(data: SystemCardStatusData): CardInfo[] {
        // CPU Master (1) and CPU Slave (2)
        return data.cards.filter(card => card.cardType === 1 || card.cardType === 2);
    }

    public static getCriticalCards(data: SystemCardStatusData): CardInfo[] {
        // CPU Master and CPU Slave are critical for system operation
        return this.getCPUCards(data);
    }

    public static getAudioCards(data: SystemCardStatusData): CardInfo[] {
        // Audio interface cards: E-MADI (4), E-DANTE (5), E-IPA (6), PCM30 (23), E-FIB (26)
        return data.cards.filter(card => [4, 5, 6, 23, 26].includes(card.cardType));
    }

    public static getProcessingCards(data: SystemCardStatusData): CardInfo[] {
        // Processing cards: MVX (3), EQUE/IVC32/LMC64 (27)
        return data.cards.filter(card => [3, 27].includes(card.cardType));
    }

    public static getCardInSlot(data: SystemCardStatusData, slotNumber: number): CardInfo | null {
        return data.cards.find(card => card.slotNumber === slotNumber) || null;
    }

    public static getCardStats(data: SystemCardStatusData): {
        total: number;
        good: number;
        faulty: number;
        unknown: number;
        present: number;
        slot0Cards: number;
        byType: Record<string, number>;
        byCondition: Record<string, number>;
    } {
        const byType: Record<string, number> = {};
        const byCondition: Record<string, number> = {};

        let good = 0, faulty = 0, unknown = 0, present = 0, slot0Cards = 0;

        data.cards.forEach(card => {
            // Count by type
            byType[card.cardTypeName] = (byType[card.cardTypeName] || 0) + 1;

            // Count by condition
            byCondition[card.conditionName] = (byCondition[card.conditionName] || 0) + 1;

            // Count specific conditions
            switch (card.condition) {
                case 1: good++; break;
                case 2: faulty++; break;
                case 0: unknown++; break;
            }

            if (card.isPresent) present++;
            if (card.isSlot0) slot0Cards++;
        });

        return {
            total: data.cards.length,
            good,
            faulty,
            unknown,
            present,
            slot0Cards,
            byType,
            byCondition
        };
    }

    public static formatCardTable(data: SystemCardStatusData): string {
        if (data.cards.length === 0) {
            return data.isUpdate ? 'No card state changes' : 'No cards in system';
        }

        const header = 'Slot | Card Type               | Condition      | Slot0 | Status';
        const separator = '-'.repeat(70);

        const rows = data.cards.map(card => {
            const slotStr = card.slotNumber.toString().padStart(4);
            const typeStr = card.cardTypeName.padEnd(23);
            const conditionStr = card.conditionName.padEnd(14);
            const slot0Str = card.isSlot0 ? 'Yes' : 'No';
            const statusStr = card.isGood ? 'ONLINE' : card.isFaulty ? 'OFFLINE' : 'UNKNOWN';

            return `${slotStr} | ${typeStr} | ${conditionStr} | ${slot0Str.padEnd(5)} | ${statusStr}`;
        });

        const typeHeader = data.isUpdate ? 'Card State Changes:' : 'System Card Status:';
        return `${typeHeader}\n${header}\n${separator}\n${rows.join('\n')}`;
    }

    // Get system health based on card status
    public static getSystemHealth(data: SystemCardStatusData): {
        healthScore: number;        // 0-100 percentage
        criticalIssues: string[];
        warnings: string[];
        recommendations: string[];
    } {
        const stats = this.getCardStats(data);
        const criticalCards = this.getCriticalCards(data);
        const faultyCritical = criticalCards.filter(card => card.isFaulty);

        const criticalIssues: string[] = [];
        const warnings: string[] = [];
        const recommendations: string[] = [];

        // Calculate health score
        let healthScore = 100;

        if (faultyCritical.length > 0) {
            healthScore = 0; // System cannot function without CPU cards
            criticalIssues.push(`${faultyCritical.length} critical CPU card(s) faulty/absent`);
            recommendations.push('Immediately check and replace faulty CPU cards');
        } else {
            // Base score on overall card health
            healthScore = Math.round((stats.good / stats.total) * 100);

            if (stats.faulty > 0) {
                warnings.push(`${stats.faulty} card(s) faulty or absent`);
                recommendations.push('Check and replace faulty cards to restore full functionality');
            }

            if (stats.unknown > 0) {
                warnings.push(`${stats.unknown} card(s) in unknown state`);
                recommendations.push('Monitor cards with unknown state - may need initialization');
            }
        }

        // Check for missing audio cards
        const audioCards = this.getAudioCards(data);
        const goodAudioCards = audioCards.filter(card => card.isGood);
        if (audioCards.length > 0 && goodAudioCards.length === 0) {
            criticalIssues.push('No functional audio interface cards detected');
            recommendations.push('Check audio interface cards - system may have no audio capability');
        }

        return { healthScore, criticalIssues, warnings, recommendations };
    }

    // Compare with previous status (for monitoring changes)
    public static compareStatus(current: SystemCardStatusData, previous: SystemCardStatusData): {
        newGood: CardInfo[];
        newFaulty: CardInfo[];
        recovered: CardInfo[];
        stateChanged: { card: CardInfo; oldCondition: CardCondition; newCondition: CardCondition }[];
    } {
        const currentCards = new Map(current.cards.map(c => [c.slotNumber, c]));
        const previousCards = new Map(previous.cards.map(c => [c.slotNumber, c]));

        const newGood: CardInfo[] = [];
        const newFaulty: CardInfo[] = [];
        const recovered: CardInfo[] = [];
        const stateChanged: { card: CardInfo; oldCondition: CardCondition; newCondition: CardCondition }[] = [];

        for (const [slotNumber, currentCard] of currentCards) {
            const previousCard = previousCards.get(slotNumber);

            if (previousCard && previousCard.condition !== currentCard.condition) {
                // State changed
                stateChanged.push({
                    card: currentCard,
                    oldCondition: previousCard.condition,
                    newCondition: currentCard.condition
                });

                if (!previousCard.isGood && currentCard.isGood) {
                    recovered.push(currentCard);
                } else if (previousCard.isGood && !currentCard.isGood) {
                    newFaulty.push(currentCard);
                }
            } else if (!previousCard && currentCard.isGood) {
                // New good card appeared
                newGood.push(currentCard);
            }
        }

        return { newGood, newFaulty, recovered, stateChanged };
    }
}

export { ReplySystemCardStatus, SystemCardStatusData, CardInfo, CardCondition, CardType };