interface ConnectedPortData {
    portNumber: number;        // 0-1023 (13 bits)
    isListener: boolean;       // bit 13
    isTalker: boolean;         // bit 14
}

interface MonitoredPortData {
    portNumber: number;        // 0-1023 (13 bits)
    connectedPorts: ConnectedPortData[];
}

interface CrosspointStatusData {
    messageType: 'crosspointStatus';
    messageID: number;
    timestamp: string;
    count: number;
    monitoredPorts: MonitoredPortData[];
    rawPayload: string;
}

class ReplyCrosspointStatus {
    public static parse(payload: Buffer): CrosspointStatusData | null {
        // Check minimum payload size
        // Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('Crosspoint status reply payload too short');
            return null;
        }

        let offset = 0;

        // Count (2 bytes)
        const count = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing crosspoint status with count: ${count}`);

        const monitoredPorts: MonitoredPortData[] = [];

        // Parse each monitored port and its connected ports
        for (let i = 0; i < count; i++) {
            if (offset + 2 > payload.length) {
                console.error(`Insufficient data for monitored port ${i + 1}`);
                return null;
            }

            // Read the monitored port data
            const monitoredPortData = payload.readUInt16BE(offset);
            offset += 2;

            // Check if this is actually a monitored port (bit 15 should be 1)
            const isMonitoredPort = (monitoredPortData & 0x8000) !== 0;
            if (!isMonitoredPort) {
                console.error(`Expected monitored port at position ${i + 1}, but bit 15 is not set`);
                return null;
            }

            // Extract monitored port number (bits 0-12)
            const monitoredPortNumber = monitoredPortData & 0x1FFF;

            // Validate bits 13,14 are 0
            const bits13_14 = (monitoredPortData & 0x6000) >> 13;
            if (bits13_14 !== 0) {
                console.warn(`Monitored port ${monitoredPortNumber}: bits 13,14 should be 0, got ${bits13_14}`);
            }

            console.log(`Monitored port: ${monitoredPortNumber}`);

            // Now read connected ports for this monitored port
            const connectedPorts: ConnectedPortData[] = [];
            
            // Continue reading until we hit another monitored port or end of data
            while (offset + 2 <= payload.length) {
                const nextPortData = payload.readUInt16BE(offset);
                
                // Check if this is a monitored port (bit 15 = 1) or connected port (bit 15 = 0)
                const isNextMonitoredPort = (nextPortData & 0x8000) !== 0;
                
                if (isNextMonitoredPort) {
                    // This is the next monitored port, don't consume it
                    break;
                }

                // This is a connected port, consume it
                offset += 2;

                // Extract connected port information
                const connectedPortNumber = nextPortData & 0x1FFF;  // bits 0-12
                const isListener = (nextPortData & 0x2000) !== 0;   // bit 13
                const isTalker = (nextPortData & 0x4000) !== 0;     // bit 14

                console.log(`  Connected port: ${connectedPortNumber} (Listener: ${isListener}, Talker: ${isTalker})`);

                connectedPorts.push({
                    portNumber: connectedPortNumber,
                    isListener,
                    isTalker
                });
            }

            monitoredPorts.push({
                portNumber: monitoredPortNumber,
                connectedPorts
            });
        }

        return {
            messageType: 'crosspointStatus',
            messageID: 0x000E,
            timestamp: new Date().toISOString(),
            count,
            monitoredPorts,
            rawPayload: payload.toString('hex')
        };
    }

    public static getPortSummary(data: CrosspointStatusData): string {
        if (data.monitoredPorts.length === 0) {
            return 'No monitored ports';
        }

        const summary = data.monitoredPorts.map(monitored => {
            const connections = monitored.connectedPorts.map(conn => {
                const roles: string[] = [];
                if (conn.isTalker) roles.push('Talker');
                if (conn.isListener) roles.push('Listener');
                const roleStr = roles.length > 0 ? ` (${roles.join(', ')})` : ' (No role)';
                return `    → Port ${conn.portNumber}${roleStr}`;
            });

            if (connections.length === 0) {
                return `Port ${monitored.portNumber}: No connections`;
            }

            return `Port ${monitored.portNumber}:\n${connections.join('\n')}`;
        });

        return summary.join('\n');
    }

    public static displayCrosspointStatus(data: CrosspointStatusData): void {
        console.log('=== Crosspoint Status Reply ===');
        console.log(`Count: ${data.count}`);
        console.log(`Monitored Ports: ${data.monitoredPorts.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');
        
        if (data.monitoredPorts.length > 0) {
            data.monitoredPorts.forEach((monitored, index) => {
                console.log(`${index + 1}. Port ${monitored.portNumber}:`);
                if (monitored.connectedPorts.length > 0) {
                    monitored.connectedPorts.forEach((conn, connIndex) => {
                        const roles: string[] = [];
                        if (conn.isTalker) roles.push('Talker');
                        if (conn.isListener) roles.push('Listener');
                        const roleStr = roles.length > 0 ? ` (${roles.join(', ')})` : ' (No role)';
                        console.log(`   ${connIndex + 1}. → Port ${conn.portNumber}${roleStr}`);
                    });
                } else {
                    console.log('   No connections');
                }
                console.log('');
            });
        } else {
            console.log('No monitored ports in response');
        }
        console.log('===============================');
    }

    // Helper methods for filtering connections
    public static getAllConnectedPorts(data: CrosspointStatusData): number[] {
        const allPorts: number[] = [];
        data.monitoredPorts.forEach(monitored => {
            monitored.connectedPorts.forEach(conn => {
                if (!allPorts.includes(conn.portNumber)) {
                    allPorts.push(conn.portNumber);
                }
            });
        });
        return allPorts.sort((a, b) => a - b);
    }

    public static getTalkerConnections(data: CrosspointStatusData): { monitoredPort: number; connectedPort: number }[] {
        const talkers: { monitoredPort: number; connectedPort: number }[] = [];
        data.monitoredPorts.forEach(monitored => {
            monitored.connectedPorts.forEach(conn => {
                if (conn.isTalker) {
                    talkers.push({
                        monitoredPort: monitored.portNumber,
                        connectedPort: conn.portNumber
                    });
                }
            });
        });
        return talkers;
    }

    public static getListenerConnections(data: CrosspointStatusData): { monitoredPort: number; connectedPort: number }[] {
        const listeners: { monitoredPort: number; connectedPort: number }[] = [];
        data.monitoredPorts.forEach(monitored => {
            monitored.connectedPorts.forEach(conn => {
                if (conn.isListener) {
                    listeners.push({
                        monitoredPort: monitored.portNumber,
                        connectedPort: conn.portNumber
                    });
                }
            });
        });
        return listeners;
    }

    public static getConnectionsForPort(data: CrosspointStatusData, portNumber: number): ConnectedPortData[] {
        const monitored = data.monitoredPorts.find(m => m.portNumber === portNumber);
        return monitored ? monitored.connectedPorts : [];
    }

    public static getPortsConnectedTo(data: CrosspointStatusData, targetPort: number): number[] {
        const sourcePorts: number[] = [];
        data.monitoredPorts.forEach(monitored => {
            const hasConnection = monitored.connectedPorts.some(conn => conn.portNumber === targetPort);
            if (hasConnection) {
                sourcePorts.push(monitored.portNumber);
            }
        });
        return sourcePorts.sort((a, b) => a - b);
    }
}

export { ReplyCrosspointStatus, CrosspointStatusData, MonitoredPortData, ConnectedPortData };