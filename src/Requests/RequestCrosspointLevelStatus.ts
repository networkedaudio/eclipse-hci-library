import HCIRequest from '../HCIRequest';

class RequestCrosspointLevelStatus extends HCIRequest {
    public Ports: number[];

    constructor(ports: number[] = [], urgent: boolean = false, responseID?: number) {
        // Validate port count (must have at least 1 port)
        if (ports.length < 1) {
            throw new Error('Must specify at least 1 port');
        }

        // Validate each port number (1-1024 for user, 0-1023 for matrix)
        for (const port of ports) {
            if (port < 1 || port > 1024) {
                throw new Error(`Port number must be between 1 and 1024, got ${port}`);
            }
        }

        // Create the payload buffer - this is just the middle part
        const payload = RequestCrosspointLevelStatus.createPayload(ports);

        // Call parent constructor with Message ID 39 (0x0027)
        super(0x0027, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;

        // Set protocol version to 1 for RequestCrosspointLevelStatus
        this.ProtocolVersion = 1;

        this.Ports = [...ports]; // Create a copy of the array
    }

    private static createPayload(ports: number[]): Buffer {
        // Count (2 bytes): number of ports
        const countBuffer = Buffer.allocUnsafe(2);
        countBuffer.writeUInt16BE(ports.length, 0);

        // Port data - each port is 2 bytes
        const portBuffers: Buffer[] = [];

        for (const port of ports) {
            const portBuffer = Buffer.allocUnsafe(2);
            // Convert from 1-indexed (user) to 0-indexed (matrix)
            portBuffer.writeUInt16BE(port - 1, 0);
            portBuffers.push(portBuffer);
        }

        // Combine count + all port data
        const portData = Buffer.concat(portBuffers);
        return Buffer.concat([countBuffer, portData]);
    }

    // Add a port to the request
    public addPort(port: number): void {
        if (port < 1 || port > 1024) {
            throw new Error(`Port number must be between 1 and 1024, got ${port}`);
        }

        // Avoid duplicates
        if (!this.Ports.includes(port)) {
            this.Ports.push(port);
            this.updatePayload();
        }
    }

    // Remove a port from the request
    public removePort(port: number): boolean {
        const index = this.Ports.indexOf(port);
        if (index !== -1) {
            this.Ports.splice(index, 1);

            // Ensure we have at least 1 port
            if (this.Ports.length === 0) {
                throw new Error('Must have at least 1 port in the request');
            }

            this.updatePayload();
            return true;
        }
        return false;
    }

    // Clear all ports and set new ones
    public setPorts(ports: number[]): void {
        if (ports.length < 1) {
            throw new Error('Must specify at least 1 port');
        }

        // Validate each port
        for (const port of ports) {
            if (port < 1 || port > 1024) {
                throw new Error(`Port number must be between 1 and 1024, got ${port}`);
            }
        }

        this.Ports = [...ports];
        this.updatePayload();
    }

    // Add multiple ports at once
    public addPorts(ports: number[]): void {
        for (const port of ports) {
            this.addPort(port);
        }
    }

    private updatePayload(): void {
        // Update the Data buffer with new ports
        this.Data = RequestCrosspointLevelStatus.createPayload(this.Ports);
    }

    // Get unique ports (remove duplicates)
    public getUniquePorts(): number[] {
        return [...new Set(this.Ports)].sort((a, b) => a - b);
    }

    // Check if a port is in the request
    public hasPort(port: number): boolean {
        return this.Ports.includes(port);
    }

    // Get ports in a specific range
    public getPortsInRange(minPort: number, maxPort: number): number[] {
        return this.Ports.filter(port => port >= minPort && port <= maxPort);
    }

    // Get port count
    public getPortCount(): number {
        return this.Ports.length;
    }

    // Helper method to display the request details
    public toString(): string {
        const portList = this.Ports.length <= 10
            ? `[${this.Ports.join(', ')}]`
            : `[${this.Ports.slice(0, 10).join(', ')}, ...and ${this.Ports.length - 10} more]`;

        return `RequestCrosspointLevelStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Port Count: ${this.Ports.length}, Ports: ${portList}`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Count (2) + (Port (2) * count)
        return 2 + (this.Ports.length * 2);
    }

    // Get ports description
    public getPortsDescription(): string {
        if (this.Ports.length === 0) {
            return 'No ports';
        }

        if (this.Ports.length <= 20) {
            return `Ports: ${this.Ports.sort((a, b) => a - b).join(', ')}`;
        }

        const sorted = this.Ports.sort((a, b) => a - b);
        return `${this.Ports.length} ports: ${sorted.slice(0, 10).join(', ')}, ...${sorted.slice(-5).join(', ')}`;
    }

    // Static helper to create a request for a range of ports
    public static forPortRange(startPort: number, endPort: number, urgent: boolean = false): RequestCrosspointLevelStatus {
        if (startPort > endPort) {
            throw new Error('Start port must be <= end port');
        }

        const ports: number[] = [];
        for (let port = startPort; port <= endPort; port++) {
            ports.push(port);
        }

        return new RequestCrosspointLevelStatus(ports, urgent);
    }

    // Static helper to create a request for specific ports
    public static forPorts(ports: number[], urgent: boolean = false): RequestCrosspointLevelStatus {
        return new RequestCrosspointLevelStatus(ports, urgent);
    }

    // Static helper to create a request for a single port
    public static forSinglePort(port: number, urgent: boolean = false): RequestCrosspointLevelStatus {
        return new RequestCrosspointLevelStatus([port], urgent);
    }
}

export default RequestCrosspointLevelStatus;