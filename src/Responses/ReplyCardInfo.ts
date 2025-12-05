import { getCardTypeName, getCardTypeDescription, getCardTypeCategory } from '../DataStructures/CardTypes';
import { getSlotTypeName, getSlotTypeDescription } from '../DataStructures/SlotTypes';
import { getCardHealthName, getCardHealthDescription, getCardHealthIcon, getCardHealthSeverity, isCardHealthy } from '../DataStructures/CardHealth';

interface CardInfo {
    slotType: number;                  // Slot type
    slotTypeName: string;              // Human-readable slot type
    expectedCardType: number;          // Expected card type
    expectedCardTypeName: string;      // Human-readable expected card type
    currentCardType: number;           // Current card type
    currentCardTypeName: string;       // Human-readable current card type
    health: number;                    // Card health status
    healthName: string;                // Human-readable health status
    healthDescription: string;         // Detailed health description
    healthIcon: string;                // Health status icon
    healthSeverity: string;            // Health severity level
    rearConnectorUnit: boolean;        // Rear connector card flag
    rackNumber: number;                // Rack number (starting from 1)
    slotNumber: number;                // Slot number
    firstPort: number;                 // First port on card
    lastPort: number;                  // Last port on card
    channels: number;                  // Number of channels (typically ports)
    dtmfBoardPresent: number;          // DTMF board presence bitmap (MVX only)
    appVersionStr: string;             // Application version string
    bootVersionStr: string;            // Boot version string
    fpgaVersionStr: string;            // FPGA version string
}

interface CardInfoData {
    messageType: 'cardInfo';
    messageID: number;
    timestamp: string;
    count: number;                     // Number of card infos returned
    cards: CardInfo[];                 // Array of card information
    rawPayload: string;
}



class ReplyCardInfo {
    public static parse(payload: Buffer): CardInfoData | null {
        // Check minimum payload size
        // Count (1) = 1 byte minimum
        if (payload.length < 1) {
            console.error('Card info reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw card info payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Count (1 byte)
        const count = payload.readUInt8(offset);
        offset += 1;

        console.log(`Parsing card info: Count=${count}`);

        // Calculate expected size per card entry
        // SlotType(1) + ExpectedCardType(1) + CurrentCardType(1) + Health(1) + RearConnector(1) + 
        // RackNumber(1) + SlotNumber(1) + FirstPort(2) + LastPort(2) + Channels(1) + DtmfBoard(2) +
        // AppVersion(64) + BootVersion(64) + FpgaVersion(64) = 206 bytes per card
        const bytesPerCard = 206;
        const expectedDataSize = count * bytesPerCard;

        if (payload.length < 1 + expectedDataSize) {
            console.error(`Insufficient data: need ${1 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const cards: CardInfo[] = [];

        // Parse each card entry
        for (let i = 0; i < count; i++) {
            if (offset + bytesPerCard > payload.length) {
                console.error(`Insufficient data for card entry ${i + 1}`);
                return null;
            }

            // Slot Type (1 byte)
            const slotType = payload.readUInt8(offset);
            offset += 1;

            // Expected Card Type (1 byte)
            const expectedCardType = payload.readUInt8(offset);
            offset += 1;

            // Current Card Type (1 byte)
            const currentCardType = payload.readUInt8(offset);
            offset += 1;

            // Health (1 byte)
            const health = payload.readUInt8(offset);
            offset += 1;

            // Rear Connector Unit (1 byte - bit 0 is the flag, bits 1-7 unused)
            const rearConnectorByte = payload.readUInt8(offset);
            const rearConnectorUnit = (rearConnectorByte & 0x01) !== 0;
            offset += 1;

            // Rack Number (1 byte)
            const rackNumber = payload.readUInt8(offset);
            offset += 1;

            // Slot Number (1 byte)
            const slotNumber = payload.readUInt8(offset);
            offset += 1;

            // First Port (2 bytes)
            const firstPort = payload.readUInt16BE(offset);
            offset += 2;

            // Last Port (2 bytes)
            const lastPort = payload.readUInt16BE(offset);
            offset += 2;

            // Channels (1 byte)
            const channels = payload.readUInt8(offset);
            offset += 1;

            // DTMF Board Present (2 bytes)
            const dtmfBoardPresent = payload.readUInt16BE(offset);
            offset += 2;

            // App Version String (64 bytes)
            const appVersionBytes = payload.subarray(offset, offset + 64);
            const appVersionStr = appVersionBytes.toString('utf8').replace(/\0+$/, ''); // Remove null terminators
            offset += 64;

            // Boot Version String (64 bytes)
            const bootVersionBytes = payload.subarray(offset, offset + 64);
            const bootVersionStr = bootVersionBytes.toString('utf8').replace(/\0+$/, ''); // Remove null terminators
            offset += 64;

            // FPGA Version String (64 bytes)
            const fpgaVersionBytes = payload.subarray(offset, offset + 64);
            const fpgaVersionStr = fpgaVersionBytes.toString('utf8').replace(/\0+$/, ''); // Remove null terminators
            offset += 64;

            console.log(`Card ${i + 1}: Slot=${slotNumber}, Type=${currentCardType}, Health=${health}, Ports=${firstPort}-${lastPort}`);

            cards.push({
                slotType,
                slotTypeName: getSlotTypeName(slotType),
                expectedCardType,
                expectedCardTypeName: getCardTypeName(expectedCardType),
                currentCardType,
                currentCardTypeName: getCardTypeName(currentCardType),
                health,
                healthName: getCardHealthName(health),
                healthDescription: getCardHealthDescription(health),
                healthIcon: getCardHealthIcon(health),
                healthSeverity: getCardHealthSeverity(health),
                rearConnectorUnit,
                rackNumber,
                slotNumber,
                firstPort,
                lastPort,
                channels,
                dtmfBoardPresent,
                appVersionStr,
                bootVersionStr,
                fpgaVersionStr
            });
        }

        return {
            messageType: 'cardInfo',
            messageID: 0x00C4,
            timestamp: new Date().toISOString(),
            count,
            cards,
            rawPayload: payload.toString('hex')
        };
    }

    public static displayCardInfo(data: CardInfoData): void {
        console.log('=== Card Info Reply ===');
        console.log(`Card Count: ${data.count}`);
        console.log(`Cards Found: ${data.cards.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.cards.length > 0) {
            data.cards.forEach((card, index) => {
                const healthStatus = `${card.healthIcon} ${card.healthName}`;
                const typeMatch = card.expectedCardType === card.currentCardType ? '✅' : '❌';
                const portRange = card.firstPort !== card.lastPort ? `${card.firstPort}-${card.lastPort}` : `${card.firstPort}`;
                const rearConnector = card.rearConnectorUnit ? ' [REAR]' : '';

                console.log(`--- Card ${index + 1}: Rack ${card.rackNumber}, Slot ${card.slotNumber} ---`);
                console.log(`  Slot Type: ${card.slotTypeName}`);
                console.log(`  Expected Type: ${card.expectedCardTypeName}`);
                console.log(`  Current Type: ${card.currentCardTypeName} ${typeMatch}${rearConnector}`);
                console.log(`  Health: ${healthStatus}`);
                console.log(`  Health Details: ${card.healthDescription}`);
                console.log(`  Port Range: ${portRange} (${card.channels} channels)`);

                if (card.currentCardType === 3) { // MVX card
                    const dtmfPorts = this.getDTMFPortList(card.dtmfBoardPresent);
                    console.log(`  DTMF Boards: 0x${card.dtmfBoardPresent.toString(16).padStart(4, '0')} (${dtmfPorts})`);
                }

                console.log(`  App Version: ${card.appVersionStr || 'N/A'}`);
                console.log(`  Boot Version: ${card.bootVersionStr || 'N/A'}`);
                console.log(`  FPGA Version: ${card.fpgaVersionStr || 'N/A'}`);
                console.log('');
            });

            // Summary statistics
            const stats = ReplyCardInfo.getCardStats(data);
            console.log('--- Summary ---');
            console.log(`Total Cards: ${data.cards.length}`);
            console.log(`Healthy Cards: ${stats.healthyCards} | Faulty Cards: ${stats.faultyCards}`);
            console.log(`Type Matches: ${stats.typeMatchCards} | Type Mismatches: ${stats.typeMismatchCards}`);
            console.log(`Rear Connector Cards: ${stats.rearConnectorCards}`);
            console.log(`Total Ports: ${stats.totalPorts} | Total Channels: ${stats.totalChannels}`);

            // Show card type breakdown
            console.log('Card Types:', Object.entries(stats.cardTypeBreakdown)
                .map(([type, count]) => `${type}: ${count}`)
                .join(', '));

            // Show health breakdown
            console.log('Health Status:', Object.entries(stats.healthBreakdown)
                .map(([health, count]) => `${health}: ${count}`)
                .join(', '));

            // Show any issues
            if (stats.faultyCards > 0 || stats.typeMismatchCards > 0) {
                console.log('');
                console.log('⚠️  ISSUES DETECTED:');
                if (stats.faultyCards > 0) {
                    console.log(`  - ${stats.faultyCards} cards have health issues`);
                }
                if (stats.typeMismatchCards > 0) {
                    console.log(`  - ${stats.typeMismatchCards} cards have type mismatches`);
                }
            }
        } else {
            console.log('No card information found');
        }
        console.log('=========================');
    }

    // Helper methods for filtering and analysis
    public static getHealthyCards(data: CardInfoData): CardInfo[] {
        return data.cards.filter(card => isCardHealthy(card.health));
    }

    public static getFaultyCards(data: CardInfoData): CardInfo[] {
        return data.cards.filter(card => !isCardHealthy(card.health));
    }

    public static getCardsByType(data: CardInfoData, cardType: number): CardInfo[] {
        return data.cards.filter(card => card.currentCardType === cardType);
    }

    public static getCardsByHealth(data: CardInfoData, health: number): CardInfo[] {
        return data.cards.filter(card => card.health === health);
    }

    public static getTypeMatchingCards(data: CardInfoData): CardInfo[] {
        return data.cards.filter(card => card.expectedCardType === card.currentCardType);
    }

    public static getTypeMismatchCards(data: CardInfoData): CardInfo[] {
        return data.cards.filter(card => card.expectedCardType !== card.currentCardType);
    }

    public static getRearConnectorCards(data: CardInfoData): CardInfo[] {
        return data.cards.filter(card => card.rearConnectorUnit);
    }

    public static findCardBySlot(data: CardInfoData, slotNumber: number): CardInfo | null {
        return data.cards.find(card => card.slotNumber === slotNumber) || null;
    }

    public static findCardsByRack(data: CardInfoData, rackNumber: number): CardInfo[] {
        return data.cards.filter(card => card.rackNumber === rackNumber);
    }

    public static getCardStats(data: CardInfoData): {
        totalCards: number;
        healthyCards: number;
        faultyCards: number;
        typeMatchCards: number;
        typeMismatchCards: number;
        rearConnectorCards: number;
        totalPorts: number;
        totalChannels: number;
        cardTypeBreakdown: Record<string, number>;
        healthBreakdown: Record<string, number>;
        slotTypeBreakdown: Record<string, number>;
        rackBreakdown: Record<number, number>;
    } {
        if (data.cards.length === 0) {
            return {
                totalCards: 0,
                healthyCards: 0,
                faultyCards: 0,
                typeMatchCards: 0,
                typeMismatchCards: 0,
                rearConnectorCards: 0,
                totalPorts: 0,
                totalChannels: 0,
                cardTypeBreakdown: {},
                healthBreakdown: {},
                slotTypeBreakdown: {},
                rackBreakdown: {}
            };
        }

        let healthyCards = 0, typeMatchCards = 0, rearConnectorCards = 0, totalPorts = 0, totalChannels = 0;
        const cardTypeBreakdown: Record<string, number> = {};
        const healthBreakdown: Record<string, number> = {};
        const slotTypeBreakdown: Record<string, number> = {};
        const rackBreakdown: Record<number, number> = {};

        data.cards.forEach(card => {
            if (isCardHealthy(card.health)) healthyCards++;
            if (card.expectedCardType === card.currentCardType) typeMatchCards++;
            if (card.rearConnectorUnit) rearConnectorCards++;

            totalPorts += (card.lastPort - card.firstPort + 1);
            totalChannels += card.channels;

            // Track card type breakdown
            const cardTypeName = card.currentCardTypeName;
            cardTypeBreakdown[cardTypeName] = (cardTypeBreakdown[cardTypeName] || 0) + 1;

            // Track health breakdown
            const healthName = card.healthName;
            healthBreakdown[healthName] = (healthBreakdown[healthName] || 0) + 1;

            // Track slot type breakdown
            const slotTypeName = card.slotTypeName;
            slotTypeBreakdown[slotTypeName] = (slotTypeBreakdown[slotTypeName] || 0) + 1;

            // Track rack breakdown
            rackBreakdown[card.rackNumber] = (rackBreakdown[card.rackNumber] || 0) + 1;
        });

        return {
            totalCards: data.cards.length,
            healthyCards,
            faultyCards: data.cards.length - healthyCards,
            typeMatchCards,
            typeMismatchCards: data.cards.length - typeMatchCards,
            rearConnectorCards,
            totalPorts,
            totalChannels,
            cardTypeBreakdown,
            healthBreakdown,
            slotTypeBreakdown,
            rackBreakdown
        };
    }

    private static getDTMFPortList(dtmfBitmap: number): string {
        if (dtmfBitmap === 0xFFFF) {
            return 'All 16 ports';
        }

        const ports: number[] = [];
        for (let bit = 0; bit < 16; bit++) {
            if (dtmfBitmap & (1 << bit)) {
                ports.push(bit + 1);
            }
        }

        if (ports.length === 0) {
            return 'None';
        } else if (ports.length <= 4) {
            return `Ports ${ports.join(', ')}`;
        } else {
            return `${ports.length} ports`;
        }
    }
}

export { ReplyCardInfo, CardInfoData, CardInfo };