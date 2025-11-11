import HCIRequest from '../HCIRequest';

class RequestCrosspointStatus extends HCIRequest {
    public Ports: number[];

    constructor(ports: number[] = [], urgent: boolean = false, responseID?: number) {
        // Validate port count (1-495)
        if (ports.length < 1 || ports.length > 495) {
            throw new Error('Port count must be between 1 and 495');
        }

        // Validate each port number (0-1023)
        for (const port of ports) {
            if (port < 0 || port > 1023) {
                throw new Error(`Port number must be between 0 and 1023, got ${port}`);
            }
        }

        // Create the payload buffer - this is just the middle part
        const payload = RequestCrosspointStatus.createPayload(ports);
        
        // Call parent constructor with Message ID 13 (0x000D)
        super(0x000D, payload, urgent, responseID);
        
        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.Version = 2;
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
            portBuffer.writeUInt16BE(port, 0);
            portBuffers.push(portBuffer);
        }
        
        // Combine count + all port data
        const portData = Buffer.concat(portBuffers);
        return Buffer.concat([countBuffer, portData]);
    }

    // Add a port to the request
    public addPort(port: number): void {
        if (port < 0 || port > 1023) {
            throw new Error(`Port number must be between 0 and 1023, got ${port}`);
        }

        if (this.Ports.length >= 495) {
            throw new Error('Cannot add more ports - maximum of 495 ports allowed');
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
        if (ports.length < 1 || ports.length > 495) {
            throw new Error('Port count must be between 1 and 495');
        }

        // Validate each port
        for (const port of ports) {
            if (port < 0 || port > 1023) {
                throw new Error(`Port number must be between 0 and 1023, got ${port}`);
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

    // Clear all ports (but ensure at least one remains)
    public clearPorts(): void {
        throw new Error('Cannot clear all ports - must have at least 1 port');
    }

    private updatePayload(): void {
        // Update the Data buffer with new ports
        this.Data = RequestCrosspointStatus.createPayload(this.Ports);
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
        
        return `RequestCrosspointStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
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
    public static forPortRange(startPort: number, endPort: number, urgent: boolean = false): RequestCrosspointStatus {
        if (startPort > endPort) {
            throw new Error('Start port must be <= end port');
        }

        const ports: number[] = [];
        for (let port = startPort; port <= endPort; port++) {
            ports.push(port);
        }

        return new RequestCrosspointStatus(ports, urgent);
    }

    // Static helper to create a request for specific ports
    public static forPorts(ports: number[], urgent: boolean = false): RequestCrosspointStatus {
        return new RequestCrosspointStatus(ports, urgent);
    }
}

export default RequestCrosspointStatus;