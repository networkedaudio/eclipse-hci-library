import HCIRequest from '../HCIRequest';

class RequestConferenceStatus extends HCIRequest {
    public ConferenceNumber: number;

    constructor(conferenceNumber: number = 0, urgent: boolean = false, responseID?: number) {
        // Validate conference number (should be 0-65535 for 16-bit word)
        if (conferenceNumber < 0 || conferenceNumber > 65535) {
            throw new Error('Conference number must be between 0 and 65535');
        }

        // Create the payload buffer - this is just the middle part
        const payload = RequestConferenceStatus.createPayload(conferenceNumber);

        // Call parent constructor with Message ID 19 (0x0013)
        super(0x0013, payload, urgent, responseID);

        // Set version to 2 for HCIv2 (parent's getRequest() will handle the formatting)
        this.HCIVersion = 2;
        this.ConferenceNumber = conferenceNumber;
    }

    private static createPayload(conferenceNumber: number): Buffer {
        // Just the conference number (2 bytes): 16-bit word
        const conferenceNumberBuffer = Buffer.allocUnsafe(2);
        conferenceNumberBuffer.writeUInt16BE(conferenceNumber, 0);

        // Return just the conference number - no protocol tag/schema needed
        return conferenceNumberBuffer;
    }

    // Update conference number
    public setConferenceNumber(conferenceNumber: number): void {
        if (conferenceNumber < 0 || conferenceNumber > 65535) {
            throw new Error('Conference number must be between 0 and 65535');
        }

        this.ConferenceNumber = conferenceNumber;
        this.updatePayload();
    }

    private updatePayload(): void {
        // Update the Data buffer with new conference number
        this.Data = RequestConferenceStatus.createPayload(this.ConferenceNumber);
    }

    // Helper method to display the request details
    public override toString(): string {
        return `RequestConferenceStatus - Message ID: 0x${this.RequestID.toString(16).padStart(4, '0')}, ` +
            `Conference Number: ${this.ConferenceNumber} (0x${this.ConferenceNumber.toString(16).padStart(4, '0')})`;
    }

    // Get payload size in bytes
    public getPayloadSize(): number {
        // Just Conference Number (2) = 2 bytes
        return 2;
    }

    // Get conference number in different formats
    public getConferenceInfo(): { decimal: number; hex: string; binary: string } {
        return {
            decimal: this.ConferenceNumber,
            hex: `0x${this.ConferenceNumber.toString(16).padStart(4, '0')}`,
            binary: `0b${this.ConferenceNumber.toString(2).padStart(16, '0')}`
        };
    }
}

export default RequestConferenceStatus;