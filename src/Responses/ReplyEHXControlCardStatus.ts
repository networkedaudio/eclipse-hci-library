interface EHXControlCard {
    cardNumber: number;     // Card number (0-8191, bits 0-12)
    isPresent: boolean;     // Card status: false = absent, true = present (bit 14)
    cardType: 'GPIO' | 'SFO'; // Card type: GPIO card or SFO card (bit 15)
}

interface EHXControlCardStatusData {
    messageType: 'ehxControlCardStatus';
    messageID: number;
    timestamp: string;
    cardCount: number;
    cards: EHXControlCard[];
    rawPayload: string;
}

class ReplyEHXControlCardStatus {
    public static parse(payload: Buffer): EHXControlCardStatusData | null {
        // Check minimum payload size
        // Card Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('EHX control card status reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw EHX control card status payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Card Count (2 bytes)
        const cardCount = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing EHX control card status with count: ${cardCount}`);

        // Validate we have enough data for all card entries
        // Each card entry is 2 bytes
        const expectedDataSize = cardCount * 2;
        if (payload.length < 2 + expectedDataSize) {
            console.error(`Insufficient data: need ${2 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const cards: EHXControlCard[] = [];

        // Parse each card entry
        for (let i = 0; i < cardCount; i++) {
            if (offset + 2 > payload.length) {
                console.error(`Insufficient data for card entry ${i + 1}`);
                return null;
            }

            // Card Data (2 bytes)
            const cardData = payload.readUInt16BE(offset);
            offset += 2;

            // Extract fields from the card data word
            const cardNumber = cardData & 0x1FFF;        // bits 0-12: card number (0-8191)
            // bit 13 is set to 0 (reserved)
            const isPresent = (cardData & 0x4000) !== 0; // bit 14: card status (0=absent, 1=present)
            const cardType = (cardData & 0x8000) !== 0 ? 'SFO' : 'GPIO'; // bit 15: card type (0=GPIO, 1=SFO)

            console.log(`Card entry ${i + 1}: Number=${cardNumber}, Present=${isPresent}, Type=${cardType}, Raw=0x${cardData.toString(16).padStart(4, '0')}`);

            cards.push({
                cardNumber,
                isPresent,
                cardType
            });
        }

        return {
            messageType: 'ehxControlCardStatus',
            messageID: 0x0016,
            timestamp: new Date().toISOString(),
            cardCount,
            cards,
            rawPayload: payload.toString('hex')
        };
    }

    public static getCardSummary(data: EHXControlCardStatusData): string {
        if (data.cards.length === 0) {
            return 'No EHX control cards';
        }

        const summary = data.cards.map((card, index) => {
            const status = card.isPresent ? 'Present' : 'Absent';
            return `${index + 1}. Card ${card.cardNumber}: ${card.cardType} (${status})`;
        });

        return summary.join('\n');
    }

    public static displayEHXControlCardStatus(data: EHXControlCardStatusData): void {
        console.log('=== EHX Control Card Status Reply ===');
        console.log(`Card Count: ${data.cardCount}`);
        console.log(`Cards Found: ${data.cards.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.cards.length > 0) {
            data.cards.forEach((card, index) => {
                const status = card.isPresent ? '✓ Present' : '✗ Absent';
                console.log(`${index + 1}. Card ${card.cardNumber}:`);
                console.log(`   Type: ${card.cardType}`);
                console.log(`   Status: ${status}`);
                console.log('');
            });

            // Summary statistics
            const presentCards = data.cards.filter(card => card.isPresent);
            const gpioCards = data.cards.filter(card => card.cardType === 'GPIO');
            const sfoCards = data.cards.filter(card => card.cardType === 'SFO');

            console.log('--- Summary ---');
            console.log(`Total Cards: ${data.cards.length}`);
            console.log(`Present: ${presentCards.length}`);
            console.log(`GPIO Cards: ${gpioCards.length}`);
            console.log(`SFO Cards: ${sfoCards.length}`);
        } else {
            console.log('No EHX control cards in response');
        }
        console.log('=====================================');
    }

    // Helper methods for filtering and analysis
    public static getPresentCards(data: EHXControlCardStatusData): EHXControlCard[] {
        return data.cards.filter(card => card.isPresent);
    }

    public static getAbsentCards(data: EHXControlCardStatusData): EHXControlCard[] {
        return data.cards.filter(card => !card.isPresent);
    }

    public static getGPIOCards(data: EHXControlCardStatusData): EHXControlCard[] {
        return data.cards.filter(card => card.cardType === 'GPIO');
    }

    public static getSFOCards(data: EHXControlCardStatusData): EHXControlCard[] {
        return data.cards.filter(card => card.cardType === 'SFO');
    }

    public static getCardByNumber(data: EHXControlCardStatusData, cardNumber: number): EHXControlCard | null {
        return data.cards.find(card => card.cardNumber === cardNumber) || null;
    }

    public static getPresentGPIOCards(data: EHXControlCardStatusData): EHXControlCard[] {
        return data.cards.filter(card => card.isPresent && card.cardType === 'GPIO');
    }

    public static getPresentSFOCards(data: EHXControlCardStatusData): EHXControlCard[] {
        return data.cards.filter(card => card.isPresent && card.cardType === 'SFO');
    }

    public static getCardStats(data: EHXControlCardStatusData): {
        total: number;
        present: number;
        absent: number;
        gpio: number;
        sfo: number;
        presentGpio: number;
        presentSfo: number;
    } {
        const present = data.cards.filter(card => card.isPresent);
        const gpio = data.cards.filter(card => card.cardType === 'GPIO');
        const sfo = data.cards.filter(card => card.cardType === 'SFO');
        const presentGpio = data.cards.filter(card => card.isPresent && card.cardType === 'GPIO');
        const presentSfo = data.cards.filter(card => card.isPresent && card.cardType === 'SFO');

        return {
            total: data.cards.length,
            present: present.length,
            absent: data.cards.length - present.length,
            gpio: gpio.length,
            sfo: sfo.length,
            presentGpio: presentGpio.length,
            presentSfo: presentSfo.length
        };
    }

    public static formatCardTable(data: EHXControlCardStatusData): string {
        if (data.cards.length === 0) {
            return 'No EHX control card data';
        }

        const header = 'Card # | Type | Status  | Raw Data';
        const separator = '-'.repeat(header.length);

        const rows = data.cards.map(card => {
            const cardNumStr = card.cardNumber.toString().padStart(6);
            const typeStr = card.cardType.padEnd(4);
            const statusStr = (card.isPresent ? 'Present' : 'Absent').padEnd(7);

            // Reconstruct the raw data word for reference
            let rawData = card.cardNumber & 0x1FFF;
            if (card.isPresent) rawData |= 0x4000;
            if (card.cardType === 'SFO') rawData |= 0x8000;
            const rawStr = `0x${rawData.toString(16).padStart(4, '0').toUpperCase()}`;

            return `${cardNumStr} | ${typeStr} | ${statusStr} | ${rawStr}`;
        });

        return [header, separator, ...rows].join('\n');
    }

    // Get card data breakdown for debugging
    public static getCardDataBreakdown(card: EHXControlCard): string {
        // Reconstruct the raw data word
        let rawData = card.cardNumber & 0x1FFF;
        if (card.isPresent) rawData |= 0x4000;
        if (card.cardType === 'SFO') rawData |= 0x8000;

        return `Card ${card.cardNumber} data breakdown:\n` +
            `  Raw Data: 0x${rawData.toString(16).padStart(4, '0')} (${rawData.toString(2).padStart(16, '0')})\n` +
            `  Bits 0-12 (Card Number): ${card.cardNumber}\n` +
            `  Bit 13 (Reserved): 0\n` +
            `  Bit 14 (Present): ${card.isPresent ? '1' : '0'} (${card.isPresent ? 'Present' : 'Absent'})\n` +
            `  Bit 15 (Type): ${card.cardType === 'SFO' ? '1' : '0'} (${card.cardType})`;
    }
}

export { ReplyEHXControlCardStatus, EHXControlCardStatusData, EHXControlCard };