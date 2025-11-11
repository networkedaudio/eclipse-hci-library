import { ReplyConferenceStatus } from './Responses/ReplyConferenceStatus';
import { ReplyCrosspointStatus } from './Responses/ReplyCrosspointStatus';
import { ReplyCrosspointLevelStatus } from './Responses/ReplyCrosspointLevelStatus';
import { ReplyUnicodeAliasStatus } from './Responses/ReplyUnicodeAliasStatus';
import { ReplyEHXControlCardStatus } from './Responses/ReplyEHXControlCardStatus';
import { ReplyGPIOSFOStatus } from './Responses/ReplyGPIOSFOStatus';
import { ReplyInputLevelStatus } from './Responses/ReplyInputLevelStatus';
import { ReplyOutputLevelStatus } from './Responses/ReplyOutputLevelStatus';

class HCIResponse {
    public static handleMessageByID(
        messageID: number,
        flags: any,
        payload: Buffer,
        hciVersion: string,
        protocolVersion: number | null,
        eclipseHCI?: any
    ): void {
        // Handle different message types based on messageID and HCI version
        this.writeDebug(eclipseHCI, `Processing ${hciVersion} message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
        if (protocolVersion !== null) {
            this.writeDebug(eclipseHCI, `Protocol Version: ${protocolVersion}`);
        }

        switch (hciVersion) {
            case 'HCIv1':
                switch (messageID) {
                    case 0x0001:
                        this.writeDebug(eclipseHCI, 'Handling Broadcast Message');
                        this.parseBroadcastMessageV1(payload, eclipseHCI);
                        break;
                    default:
                        this.writeDebug(eclipseHCI, `Unknown message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
                        break;
                }
                break;

            case "HCIv2":
                this.writeDebug(eclipseHCI, 'Handling protocol version 2 specifics');
                switch (messageID) {
                    case 0x0001:
                        this.writeDebug(eclipseHCI, 'Handling Protocol v2 Broadcast Message');
                        this.writeDebug(eclipseHCI, `Payload as text:`, payload.toString());
                        break;
                    case 0x000E: // Crosspoint Status Reply
                        this.writeDebug(eclipseHCI, 'Handling Crosspoint Status Reply');
                        this.parseCrosspointStatusReply(payload, eclipseHCI);

                        break;
                    case 0x0014: // Conference Status Reply
                        this.writeDebug(eclipseHCI, 'Handling Conference Status Reply');
                        this.parseConferenceStatusReply(payload, eclipseHCI);
                        break;
                    case 0x0028: // Crosspoint Level Status Reply
                        this.writeDebug(eclipseHCI, 'Handling Crosspoint Level Status Reply');
                        this.parseCrosspointLevelStatusReply(payload, eclipseHCI);
                        break;
                    case 0x00F5: // Unicode Alias Status Reply
                        this.writeDebug(eclipseHCI, 'Handling Unicode Alias Status Reply');
                        this.parseUnicodeAliasStatusReply(payload, flags, eclipseHCI);
                        break;
                    case 0x0016: // EHX Control Card Status Reply
                        this.writeDebug(eclipseHCI, 'Handling EHX Control Card Status Reply');
                        this.parseEHXControlCardStatusReply(payload, eclipseHCI);
                        break;
                    case 0x0018: // GPIO/SFO Status Reply
                        this.writeDebug(eclipseHCI, 'Handling GPIO/SFO Status Reply');
                        this.parseGPIOSFOStatusReply(payload, eclipseHCI);
                        break;
                    case 0x0022: // Input Level Status Reply
                        this.writeDebug(eclipseHCI, 'Handling Input Level Status Reply');
                        this.parseInputLevelStatusReply(payload, eclipseHCI);
                        break;
                    case 0x0025: // Output Level Status Reply
                        this.writeDebug(eclipseHCI, 'Handling Output Level Status Reply');
                        this.parseOutputLevelStatusReply(payload, flags, eclipseHCI);
                        break;
                    default:
                        this.writeDebug(eclipseHCI, `Unknown protocol v2 message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
                        break;
                }
                break;

            case null:
                // HCIv1 messages (no protocol version)
                switch (messageID) {
                    case 0x0001:
                        this.writeDebug(eclipseHCI, 'Handling HCIv1 Broadcast Message');
                        this.writeDebug(eclipseHCI, `Payload as text:`, payload.toString());
                        break;
                    default:
                        this.writeDebug(eclipseHCI, `Unknown HCIv1 message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
                        break;
                }
                break;

            default:
                this.writeDebug(eclipseHCI, `Unsupported protocol version: ${protocolVersion}`);
                break;
        }
    }

    // Debug method that only outputs when showDebug is true on the EclipseHCI instance
    private static writeDebug(eclipseHCI: any, message: string, ...args: any[]): void {
        if (eclipseHCI && eclipseHCI.showDebug) {
            console.log(message, ...args);
        }
    }

    private static parseCrosspointStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const crosspointStatus = ReplyCrosspointStatus.parse(payload);

        console.log("Crosspoint Status Parsed as:", crosspointStatus);
        if (crosspointStatus) {
            // Display the parsed crosspoint status
            ReplyCrosspointStatus.displayCrosspointStatus(crosspointStatus);
            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {

                eclipseHCI.emit('onReplyCrosspointStatus', crosspointStatus);
            }
        }
    }

    private static parseConferenceStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const conferenceStatus = ReplyConferenceStatus.parse(payload);

        if (conferenceStatus) {
            // Display the parsed conference status
            ReplyConferenceStatus.displayConferenceStatus(conferenceStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('conferenceStatus', conferenceStatus);
            }
        }
    }

    private static parseCrosspointLevelStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const crosspointLevelStatus = ReplyCrosspointLevelStatus.parse(payload);

        if (crosspointLevelStatus) {
            // Display the parsed crosspoint level status
            ReplyCrosspointLevelStatus.displayCrosspointLevelStatus(crosspointLevelStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyCrosspointLevelStatus', crosspointLevelStatus);
            }
        }
    }

    private static parseUnicodeAliasStatusReply(payload: Buffer, flags: any, eclipseHCI?: any): void {
        const unicodeAliasStatus = ReplyUnicodeAliasStatus.parse(payload, flags);

        if (unicodeAliasStatus) {
            // Display the parsed unicode alias status
            ReplyUnicodeAliasStatus.displayUnicodeAliasStatus(unicodeAliasStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyUnicodeAliasStatus', unicodeAliasStatus);
            }
        }
    }

    private static parseEHXControlCardStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const ehxCardStatus = ReplyEHXControlCardStatus.parse(payload);

        if (ehxCardStatus) {
            // Display the parsed EHX control card status
            ReplyEHXControlCardStatus.displayEHXControlCardStatus(ehxCardStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyEHXControlCardStatus', ehxCardStatus);
            }
        }
    }

    private static parseGPIOSFOStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const gpioSfoStatus = ReplyGPIOSFOStatus.parse(payload);

        if (gpioSfoStatus) {
            // Display the parsed GPIO/SFO status
            ReplyGPIOSFOStatus.displayGPIOSFOStatus(gpioSfoStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyGPIOSFOStatus', gpioSfoStatus);
            }
        }
    }

    private static parseInputLevelStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const inputLevelStatus = ReplyInputLevelStatus.parse(payload);

        if (inputLevelStatus) {
            // Display the parsed input level status
            ReplyInputLevelStatus.displayInputLevelStatus(inputLevelStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyInputLevelStatus', inputLevelStatus);
            }
        }
    }

    private static parseOutputLevelStatusReply(payload: Buffer, flags: any, eclipseHCI?: any): void {
        const outputLevelStatus = ReplyOutputLevelStatus.parse(payload, flags);

        if (outputLevelStatus) {
            // Display the parsed output level status
            ReplyOutputLevelStatus.displayOutputLevelStatus(outputLevelStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyOutputLevelStatus', outputLevelStatus);
            }
        }
    }

    private static parseBroadcastMessageV1(payload: Buffer, eclipseHCI?: any): void {
        // Check if payload is long enough for the minimum structure
        // Class (2) + Code (2) + Reserved (4) = 8 bytes minimum
        if (payload.length < 8) {
            console.error('Broadcast message payload too short');
            return;
        }

        // Parse Class (16-bit word)
        const classValue = payload.readUInt16BE(0);
        const classNames = [
            'Fatal Error',      // 0
            'Non-Fatal Error',  // 1
            'Warning',          // 2
            'Information',      // 3
            'Debug',            // 4
            'Log to disk'       // 5
        ];

        const className = classValue <= 5 ? classNames[classValue] : `Reserved (${classValue})`;

        // Parse Code (16-bit word)
        const code = payload.readUInt16BE(2);

        // Parse Reserved (4 bytes)
        const reserved = payload.subarray(4, 8);

        // Parse Text (remaining bytes, max 180 bytes, null-terminated)
        let text = '';
        if (payload.length > 8) {
            const textBytes = payload.subarray(8, Math.min(payload.length, 8 + 180));

            // Find null terminator
            let nullIndex = textBytes.indexOf(0);
            if (nullIndex === -1) {
                nullIndex = textBytes.length;
            }

            text = textBytes.subarray(0, nullIndex).toString('utf8');
        }

        // Create JSON object with parsed data
        const broadcastData = {
            messageType: 'broadcast',
            protocolVersion: 1,
            timestamp: new Date().toISOString(),
            class: {
                value: classValue,
                name: className
            },
            code: {
                value: code,
                hex: `0x${code.toString(16).padStart(4, '0')}`
            },
            reserved: reserved.toString('hex'),
            text: text,
            textLength: text.length,
            rawPayload: payload.toString('hex')
        };

        // Display parsed information
        this.writeDebug(eclipseHCI, '=== Broadcast Message (Protocol v1) ===');
        this.writeDebug(eclipseHCI, `Class: ${classValue} (${className})`);
        this.writeDebug(eclipseHCI, `Code: 0x${code.toString(16).padStart(4, '0')} (${code})`);
        this.writeDebug(eclipseHCI, `Reserved: ${reserved.toString('hex')}`);
        this.writeDebug(eclipseHCI, `Text: "${text}"`);
        this.writeDebug(eclipseHCI, `Text length: ${text.length} characters`);
        this.writeDebug(eclipseHCI, '=====================================');

        // Emit the event if EclipseHCI instance is provided
        if (eclipseHCI && typeof eclipseHCI.emitBroadcastMessage === 'function') {
            eclipseHCI.emitBroadcastMessage(broadcastData);
        }
    }
}

export default HCIResponse;