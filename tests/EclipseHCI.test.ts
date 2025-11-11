import { EclipseHCI } from '../src/EclipseHCI';

describe('EclipseHCI', () => {
    let hci: EclipseHCI;

    beforeEach(() => {
        hci = new EclipseHCI('192.168.1.1'); // Example IP address
    });

    test('should instantiate with an IP address or hostname', () => {
        expect(hci).toBeDefined();
    });

    test('should connect successfully', () => {
        const result = hci.connect();
        expect(result).toBe('Connected to 192.168.1.1'); // Assuming this is the expected output
    });

    test('should disconnect successfully', () => {
        hci.connect(); // Ensure it's connected first
        const result = hci.disconnect();
        expect(result).toBe('Disconnected from 192.168.1.1'); // Assuming this is the expected output
    });

    test('should return the correct status', () => {
        hci.connect(); // Ensure it's connected first
        const status = hci.getStatus();
        expect(status).toBe('Connected'); // Assuming this is the expected output
    });
});