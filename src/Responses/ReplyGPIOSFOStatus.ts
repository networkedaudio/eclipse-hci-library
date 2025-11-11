interface GPIOSFOPin {
    pinNumber: number;      // Pin number (0-31, bits 0-12)
    state: 'off' | 'on';    // State of pin: off = 0, on = 1 (bit 13)
    type: 'output' | 'input'; // Type of pin: output = 0, input = 1 (bit 14)
}

interface GPIOSFOStatusData {
    messageType: 'gpioSfoStatus';
    messageID: number;
    timestamp: string;
    cardNumber: number;     // Card number (0-128, bits 0-12 of Card Data)
    pinCount: number;       // Number of pins reported (includes card data, so actual pins = pinCount - 1)
    pins: GPIOSFOPin[];     // Pin data
    rawPayload: string;
}

class ReplyGPIOSFOStatus {
    public static parse(payload: Buffer): GPIOSFOStatusData | null {
        // Check minimum payload size
        // Pin Count (2) + Card Data (2) = 4 bytes minimum
        if (payload.length < 4) {
            console.error('GPIO/SFO status reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw GPIO/SFO status payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Pin Count (2 bytes)
        const pinCount = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing GPIO/SFO status with pin count: ${pinCount}`);

        // Card Data (2 bytes)
        const cardData = payload.readUInt16BE(offset);
        offset += 2;

        // Extract card number from Card Data
        const cardNumber = cardData & 0x1FFF;        // bits 0-12: card number (0-128)
        // bits 13-14 should be 0 (reserved)
        const bit15Set = (cardData & 0x8000) !== 0;  // bit 15 should be 1

        if (!bit15Set) {
            console.warn('Card Data bit 15 is not set (expected to be 1)');
        }

        console.log(`Card Data: Number=${cardNumber}, Bit15=${bit15Set ? 'Set' : 'Not Set'}, Raw=0x${cardData.toString(16).padStart(4, '0')}`);

        // Calculate actual number of pins (Pin Count includes Card Data, so subtract 1)
        const actualPinCount = pinCount - 1;
        console.log(`Actual pin data entries: ${actualPinCount}`);

        // Validate we have enough data for all pin entries
        // Each pin entry is 2 bytes
        const expectedDataSize = actualPinCount * 2;
        if (payload.length < 4 + expectedDataSize) {
            console.error(`Insufficient data: need ${4 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const pins: GPIOSFOPin[] = [];

        // Parse each pin entry
        for (let i = 0; i < actualPinCount; i++) {
            if (offset + 2 > payload.length) {
                console.error(`Insufficient data for pin entry ${i + 1}`);
                return null;
            }

            // Pin Data (2 bytes)
            const pinData = payload.readUInt16BE(offset);
            offset += 2;

            // Extract fields from the pin data word
            const pinNumber = pinData & 0x1FFF;        // bits 0-12: pin number (0-31)
            const state = (pinData & 0x2000) !== 0 ? 'on' : 'off'; // bit 13: state (0=off, 1=on)
            const type = (pinData & 0x4000) !== 0 ? 'input' : 'output'; // bit 14: type (0=output, 1=input)
            const bit15Clear = (pinData & 0x8000) === 0;  // bit 15 should be 0

            if (!bit15Clear) {
                console.warn(`Pin ${pinNumber} data bit 15 is set (expected to be 0)`);
            }

            console.log(`Pin entry ${i + 1}: Number=${pinNumber}, State=${state}, Type=${type}, Raw=0x${pinData.toString(16).padStart(4, '0')}`);

            pins.push({
                pinNumber,
                state,
                type
            });
        }

        return {
            messageType: 'gpioSfoStatus',
            messageID: 0x0018,
            timestamp: new Date().toISOString(),
            cardNumber,
            pinCount,
            pins,
            rawPayload: payload.toString('hex')
        };
    }

    public static getPinSummary(data: GPIOSFOStatusData): string {
        if (data.pins.length === 0) {
            return `Card ${data.cardNumber}: No pins reported`;
        }

        const summary = data.pins.map((pin, index) => {
            return `${index + 1}. Pin ${pin.pinNumber}: ${pin.type.toUpperCase()} = ${pin.state.toUpperCase()}`;
        });

        return `Card ${data.cardNumber}:\n${summary.join('\n')}`;
    }

    public static displayGPIOSFOStatus(data: GPIOSFOStatusData): void {
        console.log('=== GPIO/SFO Status Reply ===');
        console.log(`Card Number: ${data.cardNumber}`);
        console.log(`Pin Count: ${data.pinCount} (${data.pins.length} actual pins)`);
        console.log(`Card Type: ${data.cardNumber <= 12 ? 'GPIO' : 'SFO'}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.pins.length > 0) {
            data.pins.forEach((pin, index) => {
                const stateIcon = pin.state === 'on' ? '●' : '○';
                const typeIcon = pin.type === 'input' ? '→' : '←';
                console.log(`${index + 1}. Pin ${pin.pinNumber.toString().padStart(2)}: ${typeIcon} ${stateIcon} ${pin.state.toUpperCase()} (${pin.type})`);
            });

            console.log('');

            // Summary statistics
            const inputPins = data.pins.filter(pin => pin.type === 'input');
            const outputPins = data.pins.filter(pin => pin.type === 'output');
            const activePins = data.pins.filter(pin => pin.state === 'on');

            console.log('--- Summary ---');
            console.log(`Total Pins: ${data.pins.length}`);
            console.log(`Input Pins: ${inputPins.length}`);
            console.log(`Output Pins: ${outputPins.length}`);
            console.log(`Active Pins: ${activePins.length}`);
        } else {
            console.log('No pin data in response');
        }
        console.log('=============================');
    }

    // Helper methods for filtering and analysis
    public static getInputPins(data: GPIOSFOStatusData): GPIOSFOPin[] {
        return data.pins.filter(pin => pin.type === 'input');
    }

    public static getOutputPins(data: GPIOSFOStatusData): GPIOSFOPin[] {
        return data.pins.filter(pin => pin.type === 'output');
    }

    public static getActivePins(data: GPIOSFOStatusData): GPIOSFOPin[] {
        return data.pins.filter(pin => pin.state === 'on');
    }

    public static getInactivePins(data: GPIOSFOStatusData): GPIOSFOPin[] {
        return data.pins.filter(pin => pin.state === 'off');
    }

    public static getActiveInputPins(data: GPIOSFOStatusData): GPIOSFOPin[] {
        return data.pins.filter(pin => pin.type === 'input' && pin.state === 'on');
    }

    public static getActiveOutputPins(data: GPIOSFOStatusData): GPIOSFOPin[] {
        return data.pins.filter(pin => pin.type === 'output' && pin.state === 'on');
    }

    public static getPinByNumber(data: GPIOSFOStatusData, pinNumber: number): GPIOSFOPin | null {
        return data.pins.find(pin => pin.pinNumber === pinNumber) || null;
    }

    public static isGPIOCard(data: GPIOSFOStatusData): boolean {
        return data.cardNumber <= 12;
    }

    public static isSFOCard(data: GPIOSFOStatusData): boolean {
        return data.cardNumber >= 28 && data.cardNumber <= 128;
    }

    public static getCardType(data: GPIOSFOStatusData): 'GPIO' | 'SFO' | 'Unknown' {
        if (data.cardNumber <= 12) {
            return 'GPIO';
        } else if (data.cardNumber >= 28 && data.cardNumber <= 128) {
            return 'SFO';
        } else {
            return 'Unknown';
        }
    }

    public static getPinStats(data: GPIOSFOStatusData): {
        total: number;
        input: number;
        output: number;
        active: number;
        inactive: number;
        activeInput: number;
        activeOutput: number;
    } {
        const input = data.pins.filter(pin => pin.type === 'input');
        const output = data.pins.filter(pin => pin.type === 'output');
        const active = data.pins.filter(pin => pin.state === 'on');
        const activeInput = data.pins.filter(pin => pin.type === 'input' && pin.state === 'on');
        const activeOutput = data.pins.filter(pin => pin.type === 'output' && pin.state === 'on');

        return {
            total: data.pins.length,
            input: input.length,
            output: output.length,
            active: active.length,
            inactive: data.pins.length - active.length,
            activeInput: activeInput.length,
            activeOutput: activeOutput.length
        };
    }

    public static formatPinTable(data: GPIOSFOStatusData): string {
        if (data.pins.length === 0) {
            return `Card ${data.cardNumber}: No pin data`;
        }

        const header = 'Pin # | Type   | State | Raw Data';
        const separator = '-'.repeat(header.length);

        const rows = data.pins.map(pin => {
            const pinNumStr = pin.pinNumber.toString().padStart(5);
            const typeStr = pin.type.padEnd(6);
            const stateStr = pin.state.padEnd(5);

            // Reconstruct the raw data word for reference
            let rawData = pin.pinNumber & 0x1FFF;
            if (pin.state === 'on') rawData |= 0x2000;
            if (pin.type === 'input') rawData |= 0x4000;
            const rawStr = `0x${rawData.toString(16).padStart(4, '0').toUpperCase()}`;

            return `${pinNumStr} | ${typeStr} | ${stateStr} | ${rawStr}`;
        });

        return `Card ${data.cardNumber} (${ReplyGPIOSFOStatus.getCardType(data)}):\n${header}\n${separator}\n${rows.join('\n')}`;
    }

    // Get pin data breakdown for debugging
    public static getPinDataBreakdown(pin: GPIOSFOPin): string {
        // Reconstruct the raw data word
        let rawData = pin.pinNumber & 0x1FFF;
        if (pin.state === 'on') rawData |= 0x2000;
        if (pin.type === 'input') rawData |= 0x4000;

        return `Pin ${pin.pinNumber} data breakdown:\n` +
            `  Raw Data: 0x${rawData.toString(16).padStart(4, '0')} (${rawData.toString(2).padStart(16, '0')})\n` +
            `  Bits 0-12 (Pin Number): ${pin.pinNumber}\n` +
            `  Bit 13 (State): ${pin.state === 'on' ? '1' : '0'} (${pin.state})\n` +
            `  Bit 14 (Type): ${pin.type === 'input' ? '1' : '0'} (${pin.type})\n` +
            `  Bit 15 (Reserved): 0`;
    }
}

export { ReplyGPIOSFOStatus, GPIOSFOStatusData, GPIOSFOPin };