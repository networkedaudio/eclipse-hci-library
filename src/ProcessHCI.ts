import { ReplyConferenceStatus } from './Responses/ReplyConferenceStatus';
import { ReplyCrosspointStatus } from './Responses/ReplyCrosspointStatus';

class ProcessHCI {
    public static handleMessageByID(
        messageID: number, 
        flags: any, 
        payload: Buffer, 
        hciVersion: string, 
        protocolVersion: number | null,
        eclipseHCI?: any
    ): void {
        // Handle different message types based on messageID and HCI version
        console.log(`Processing ${hciVersion} message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
        if (protocolVersion !== null) {
            console.log(`Protocol Version: ${protocolVersion}`);
        }

        switch(protocolVersion){
            case 1:
                switch (messageID) {
                    case 0x0001:
                        console.log('Handling Broadcast Message');
                        this.parseBroadcastMessageV1(payload, eclipseHCI);
                        break;
                    default:
                        console.log(`Unknown message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
                        break;
                }
                break;
                
            case 2:
                console.log('Handling protocol version 2 specifics');
                switch (messageID) {
                    case 0x0001:
                        console.log('Handling Protocol v2 Broadcast Message');
                        console.log(`Payload as text:`, payload.toString());
                        break;
                    case 0x000E: // Crosspoint Status Reply
                        console.log('Handling Crosspoint Status Reply');
                        this.parseCrosspointStatusReply(payload, eclipseHCI);
                        break;
                    case 0x0014: // Conference Status Reply
                        console.log('Handling Conference Status Reply');
                        this.parseConferenceStatusReply(payload, eclipseHCI);
                        break;
                    default:
                        console.log(`Unknown protocol v2 message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
                        break;
                }
                break;
                
            case null:
                // HCIv1 messages (no protocol version)
                switch (messageID) {
                    case 0x0001:
                        console.log('Handling HCIv1 Broadcast Message');
                        console.log(`Payload as text:`, payload.toString());
                        break;
                    default:
                        console.log(`Unknown HCIv1 message ID: 0x${messageID.toString(16).padStart(4, '0')}`);
                        break;
                }
                break;
                
            default:
                console.log(`Unsupported protocol version: ${protocolVersion}`);
                break;
        }
    }

    private static parseCrosspointStatusReply(payload: Buffer, eclipseHCI?: any): void {
        const crosspointStatus = ReplyCrosspointStatus.parse(payload);
        
        if (crosspointStatus) {
            // Display the parsed crosspoint status
            ReplyCrosspointStatus.displayCrosspointStatus(crosspointStatus);
            
            // Emit event if EclipseHCI instance is provided
            if (eclipseHCI && typeof eclipseHCI.emit === 'function') {
                eclipseHCI.emit('crosspointStatus', crosspointStatus);
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
        console.log('=== Broadcast Message (Protocol v1) ===');
        console.log(`Class: ${classValue} (${className})`);
        console.log(`Code: 0x${code.toString(16).padStart(4, '0')} (${code})`);
        console.log(`Reserved: ${reserved.toString('hex')}`);
        console.log(`Text: "${text}"`);
        console.log(`Text length: ${text.length} characters`);
        console.log('=====================================');

        // Emit the event if EclipseHCI instance is provided
        if (eclipseHCI && typeof eclipseHCI.emitBroadcastMessage === 'function') {
            eclipseHCI.emitBroadcastMessage(broadcastData);
        }
    }
}

export default ProcessHCI;