import { ReplyConferenceStatus } from './Responses/ReplyConferenceStatus';
import { ReplyCrosspointStatus } from './Responses/ReplyCrosspointStatus';
import { ReplyCrosspointLevelStatus } from './Responses/ReplyCrosspointLevelStatus';
import { ReplyUnicodeAliasStatus } from './Responses/ReplyUnicodeAliasStatus';
import { ReplyEHXControlCardStatus } from './Responses/ReplyEHXControlCardStatus';
import { ReplyGPIOSFOStatus } from './Responses/ReplyGPIOSFOStatus';
import { ReplyInputLevelStatus } from './Responses/ReplyInputLevelStatus';
import { ReplyOutputLevelStatus } from './Responses/ReplyOutputLevelStatus';
import { ReplyPanelStatus } from './Responses/ReplyPanelStatus';
import { ReplySystemCardStatus } from './Responses/ReplySystemCardStatus';
import { ReplyPanelKeysStatus } from './Responses/ReplyPanelKeysStatus';
import { ReplyPortInfo } from './Responses/ReplyPortInfo';
import { ReplyLocallyAssignedKeys } from './Responses/ReplyLocallyAssignedKeys';
import { ReplyAssignedKeys } from './Responses/ReplyAssignedKeys';
import { ReplyCardInfo } from './Responses/ReplyCardInfo';
import { ReplyConferenceAssignments } from './Responses/ReplyConferenceAssignments';
import { ReplySetConfigMultipleKeys } from './Responses/ReplySetConfigMultipleKeys';

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
                    case 0x001E: // Panel Status Reply
                        this.writeDebug(eclipseHCI, 'Handling Panel Status Reply');
                        this.parsePanelStatusReply(payload, flags, eclipseHCI);
                        break;
                    case 0x0004: // System Card Status Reply
                        this.writeDebug(eclipseHCI, 'Handling System Card Status Reply');
                        this.parseSystemCardStatusReply(payload, flags, eclipseHCI);
                        break;
                    case 0x00B2: // Panel Keys Status Reply (Message ID 178)
                        this.writeDebug(eclipseHCI, 'Handling Panel Keys Status Reply');
                        this.parsePanelKeysStatusReply(payload, eclipseHCI);
                        break;
                    case 0x00B4: // Panel Keys Status Reply (Message ID 180) - Reply to Panel Keys Action
                        this.writeDebug(eclipseHCI, 'Handling Panel Keys Status Reply (Action Response)');
                        this.parsePanelKeysStatusReply(payload, eclipseHCI);
                        break;
                    case 0x00B8: // Port Info Reply (Message ID 184)
                        this.writeDebug(eclipseHCI, 'Handling Port Info Reply');
                        this.parsePortInfoReply(payload, eclipseHCI);
                        break;
                    case 0x00BA: // Locally Assigned Keys Reply (Message ID 186)
                        this.writeDebug(eclipseHCI, 'Handling Locally Assigned Keys Reply');
                        this.parseLocallyAssignedKeysReply(payload, eclipseHCI);
                        break;
                    case 0x00E8: // Assigned Keys Reply (Message ID 232)
                        this.writeDebug(eclipseHCI, 'Handling Assigned Keys Reply');
                        this.parseAssignedKeysReply(payload, protocolVersion, eclipseHCI);
                        break;
                    case 0x00C4: // Card Info Reply (Message ID 196)
                        this.writeDebug(eclipseHCI, 'Handling Card Info Reply');
                        this.parseCardInfoReply(payload, eclipseHCI);
                        break;
                    case 0x00C6: // Conference Assignments Reply (Message ID 198)
                        this.writeDebug(eclipseHCI, 'Handling Conference Assignments Reply');
                        this.parseConferenceAssignmentsReply(payload, eclipseHCI);
                        break;
                    case 0x00CE: // Set Config Multiple Keys Reply (Message ID 206)
                        this.writeDebug(eclipseHCI, 'Handling Set Config Multiple Keys Reply');
                        this.parseSetConfigMultipleKeysReply(payload, hciVersion, protocolVersion, eclipseHCI);
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

    private static parsePanelStatusReply(payload: Buffer, flags: any, eclipseHCI?: any): void {
        const panelStatus = ReplyPanelStatus.parse(payload, flags);

        if (panelStatus) {
            // Display the parsed panel status
            ReplyPanelStatus.displayPanelStatus(panelStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyPanelStatus', panelStatus);
            }
        }
    }

    private static parseSystemCardStatusReply(payload: Buffer, flags: any, eclipseHCI?: any): void {
        const cardStatus = ReplySystemCardStatus.parse(payload, flags);

        if (cardStatus) {
            // Display the parsed card status
            ReplySystemCardStatus.displaySystemCardStatus(cardStatus);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplySystemCardStatus', cardStatus);
            }
        }
    }

    private static parsePanelKeysStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const keysStatusResult = ReplyPanelKeysStatus.parse(payload);

        if (keysStatusResult) {
            // Display the parsed keys status result
            ReplyPanelKeysStatus.displayPanelKeysStatus(keysStatusResult);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyPanelKeysStatus', keysStatusResult);
            }
        }
    }

    private static parsePortInfoReply(payload: Buffer, eclipseHCI?: any): void {
        const portInfo = ReplyPortInfo.parse(payload);

        if (portInfo) {
            // Display the parsed port info
            ReplyPortInfo.displayPortInfo(portInfo);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyPortInfo', portInfo);
            }
        }
    }

    private static parseLocallyAssignedKeysReply(payload: Buffer, eclipseHCI?: any): void {
        const locallyAssignedKeys = ReplyLocallyAssignedKeys.parse(payload);

        if (locallyAssignedKeys) {
            // Display the parsed locally assigned keys
            ReplyLocallyAssignedKeys.displayLocallyAssignedKeys(locallyAssignedKeys);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyLocallyAssignedKeys', locallyAssignedKeys);
            }
        }
    }

    private static parseAssignedKeysReply(payload: Buffer, protocolVersion: number | null, eclipseHCI?: any): void {
        // Default to schema 1 if protocol version is not available
        const schemaVersion = (protocolVersion === 1 || protocolVersion === 2) ? protocolVersion : 1;

        const assignedKeys = ReplyAssignedKeys.parse(payload, schemaVersion as 1 | 2);

        if (assignedKeys) {
            // Display the parsed assigned keys
            ReplyAssignedKeys.displayAssignedKeys(assignedKeys);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyAssignedKeys', assignedKeys);
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

    private static parseCardInfoReply(payload: Buffer, eclipseHCI?: any): void {
        const cardInfo = ReplyCardInfo.parse(payload);

        if (cardInfo) {
            // Display the parsed card info
            ReplyCardInfo.displayCardInfo(cardInfo);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyCardInfo', cardInfo);
            }
        }
    }

    private static parseConferenceAssignmentsReply(payload: Buffer, eclipseHCI?: any): void {
        const conferenceAssignments = ReplyConferenceAssignments.parse(payload);

        if (conferenceAssignments) {
            // Display the parsed conference assignments
            ReplyConferenceAssignments.displayConferenceAssignments(conferenceAssignments);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplyConferenceAssignments', conferenceAssignments);
            }
        }
    }

    private static parseSetConfigMultipleKeysReply(
        payload: Buffer,
        hciVersion: string,
        protocolVersion: number | null,
        eclipseHCI?: any
    ): void {
        const reply = ReplySetConfigMultipleKeys.parse(payload, hciVersion, protocolVersion);

        if (reply) {
            // Display the parsed reply
            ReplySetConfigMultipleKeys.displaySetConfigMultipleKeysReply(reply);

            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('onReplySetConfigMultipleKeys', reply);
            }
        }
    }
}

export default HCIResponse;