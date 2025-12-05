// @ts-nocheck
interface ConferencePortData {
    portNumber: number;        // 0-1023 (13 bits)
    isListener: boolean;       // bit 13
    isTalker: boolean;         // bit 14
}

interface ConferenceStatusData {
    messageType: 'conferenceStatus';
    messageID: number;
    timestamp: string;
    conferenceNumber: number;  // 0-4095 (13 bits)
    portCount: number;
    ports: ConferencePortData[];
    rawPayload: string;
}

class ReplyConferenceStatus {
    public static parse(payload: Buffer): ConferenceStatusData | null {
        // Check minimum payload size
        // Protocol Tag (4) + Protocol Schema (1) + Port Count (2) + Conference Data (2) = 9 bytes minimum
        if (payload.length < 9) {
            console.error('Conference status reply payload too short');
            return null;
        }

        let offset = 0;

        // Protocol Tag (4 bytes): should be 0xABBACEDE
        const protocolTag = payload.subarray(offset, offset + 4);
        const expectedTag = Buffer.from([0xAB, 0xBA, 0xCE, 0xDE]);
        if (!protocolTag.equals(expectedTag)) {
            console.error('Invalid protocol tag in conference status reply');
            return null;
        }
        offset += 4;

        // Protocol Schema (1 byte): should be 1
        const protocolSchema = payload.readUInt8(offset);
        if (protocolSchema !== 1) {
            console.warn(`Unexpected protocol schema: ${protocolSchema}`);
        }
        offset += 1;

        // Port Count (2 bytes)
        const portCount = payload.readUInt16BE(offset);
        offset += 2;

        // Conference Data (2 bytes)
        const conferenceData = payload.readUInt16BE(offset);
        offset += 2;

        // Extract conference number (bits 0-12)
        const conferenceNumber = conferenceData & 0x1FFF;

        // Validate bit 15 is set (should be 1)
        const bit15 = (conferenceData & 0x8000) !== 0;
        if (!bit15) {
            console.warn('Conference data bit 15 should be set to 1');
        }

        // Check if we have enough bytes for all port data
        const expectedPortDataBytes = portCount * 2;
        if (payload.length < offset + expectedPortDataBytes) {
            console.error(`Insufficient data for ${portCount} ports`);
            return null;
        }

        // Parse port data
        const ports: ConferencePortData[] = [];
        for (let i = 0; i < portCount; i++) {
            const portData = payload.readUInt16BE(offset);
            offset += 2;

            // Extract port information
            const portNumber = portData & 0x1FFF;        // bits 0-12
            const isListener = (portData & 0x2000) !== 0; // bit 13
            const isTalker = (portData & 0x4000) !== 0;   // bit 14
            const bit15Port = (portData & 0x8000) !== 0;  // bit 15 (should be 0)

            if (bit15Port) {
                console.warn(`Port data bit 15 should be 0 for port ${i}`);
            }

            ports.push({
                portNumber,
                isListener,
                isTalker
            });
        }

        return {
            messageType: 'conferenceStatus',
            messageID: 0x0014,
            timestamp: new Date().toISOString(),
            conferenceNumber,
            portCount,
            ports,
            rawPayload: payload.toString('hex')
        };
    }

    public static getPortSummary(data: ConferenceStatusData): string {
        if (data.ports.length === 0) {
            return 'No ports in conference';
        }

        const summary = data.ports.map(port => {
            const roles: string[] = [];
            if (port.isTalker) roles.push('Talker');
            if (port.isListener) roles.push('Listener');
            const roleStr = roles.length > 0 ? roles.join(', ') : 'No role';
            return `Port ${port.portNumber}: ${roleStr}`;
        });

        return summary.join('\n');
    }

    public static displayConferenceStatus(data: ConferenceStatusData): void {
        console.log('=== Conference Status Reply ===');
        console.log(`Conference Number: ${data.conferenceNumber}`);
        console.log(`Port Count: ${data.portCount}`);
        console.log(`Timestamp: ${data.timestamp}`);
        
        if (data.ports.length > 0) {
            console.log('Ports:');
            data.ports.forEach((port, index) => {
                const roles: string[] = [];
                if (port.isTalker) roles.push('Talker');
                if (port.isListener) roles.push('Listener');
                const roleStr = roles.length > 0 ? roles.join(', ') : 'No role';
                console.log(`  ${index + 1}. Port ${port.portNumber}: ${roleStr}`);
            });
        } else {
            console.log('No ports in this conference');
        }
        console.log('===============================');
    }

    // Helper methods for filtering ports
    public static getTalkers(data: ConferenceStatusData): number[] {
        return data.ports.filter(port => port.isTalker).map(port => port.portNumber);
    }

    public static getListeners(data: ConferenceStatusData): number[] {
        return data.ports.filter(port => port.isListener).map(port => port.portNumber);
    }

    public static getBothRoles(data: ConferenceStatusData): number[] {
        return data.ports.filter(port => port.isTalker && port.isListener).map(port => port.portNumber);
    }
}

export { ReplyConferenceStatus, ConferenceStatusData, ConferencePortData };