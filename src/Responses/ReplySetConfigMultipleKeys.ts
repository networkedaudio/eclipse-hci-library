interface SetConfigMultipleKeysReplyData {
    messageType: 'setConfigMultipleKeysReply';
    messageID: number;
    timestamp: string;
    schemaVersion: 1 | 2;       // Protocol schema version
    slot: number;               // Card slot number
    port: number;               // Port offset from first port of card
    endpointType?: number;      // Endpoint type (only for schema 2)
    keysProcessed: number;      // Number of keys that were processed
    rawPayload: string;
}

class ReplySetConfigMultipleKeys {
    public static parse(payload: Buffer, hciVersion: string, protocolVersion: number | null): SetConfigMultipleKeysReplyData | null {
        // Schema version comes from protocol version
        const schemaVersion = (protocolVersion === 1 || protocolVersion === 2) ? protocolVersion as 1 | 2 : 2;

        // Calculate minimum payload size based on schema
        // Schema 1: Slot(1) + Port(1) + Keys(2) = 4 bytes
        // Schema 2: Slot(1) + Port(1) + EndpointType(2) + Keys(2) = 6 bytes
        const minSize = schemaVersion === 1 ? 4 : 6;

        if (payload.length < minSize) {
            console.error(`Set config multiple keys reply payload too short: expected ${minSize} bytes, got ${payload.length}`);
            return null;
        }

        // Log the raw payload
        console.log('Raw set config multiple keys reply payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Slot (1 byte)
        const slot = payload.readUInt8(offset);
        offset += 1;

        // Port (1 byte)
        const port = payload.readUInt8(offset);
        offset += 1;

        // Endpoint Type (2 bytes) - only for schema 2
        let endpointType: number | undefined;
        if (schemaVersion === 2) {
            endpointType = payload.readUInt16BE(offset);
            offset += 2;
        }

        // Keys Processed (2 bytes)
        const keysProcessed = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing set config multiple keys reply: Schema=${schemaVersion}, Slot=${slot}, Port=${port}, EndpointType=${endpointType || 'N/A'}, KeysProcessed=${keysProcessed}`);

        return {
            messageType: 'setConfigMultipleKeysReply',
            messageID: 0x00CE,
            timestamp: new Date().toISOString(),
            schemaVersion,
            slot,
            port,
            endpointType,
            keysProcessed,
            rawPayload: payload.toString('hex')
        };
    }

    public static displaySetConfigMultipleKeysReply(data: SetConfigMultipleKeysReplyData): void {
        console.log('=== Set Config Multiple Keys Reply ===');
        console.log(`Schema Version: ${data.schemaVersion}`);
        console.log(`Target: Slot ${data.slot}, Port ${data.port}`);

        if (data.schemaVersion === 2 && data.endpointType !== undefined) {
            console.log(`Endpoint Type: 0x${data.endpointType.toString(16).padStart(4, '0')} (${data.endpointType})`);
        }

        console.log(`Keys Processed: ${data.keysProcessed}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        // Success/failure indication
        if (data.keysProcessed > 0) {
            console.log(`✅ Successfully processed ${data.keysProcessed} key configuration(s)`);
            console.log(`   All specified keys have been configured on ${ReplySetConfigMultipleKeys.getPanelIdentifier(data)}`);
        } else {
            console.log(`⚠️  No keys were processed`);
            console.log(`   This may indicate an error or that no valid key configurations were provided`);
        }

        console.log('=====================================');
    }

    // Helper methods
    public static getPanelIdentifier(data: SetConfigMultipleKeysReplyData): string {
        return `Slot ${data.slot}, Port ${data.port}`;
    }

    public static getSchemaInfo(data: SetConfigMultipleKeysReplyData): string {
        if (data.schemaVersion === 2 && data.endpointType !== undefined && data.endpointType !== 0) {
            return `Schema v${data.schemaVersion} with Endpoint Type 0x${data.endpointType.toString(16).padStart(4, '0')}`;
        } else {
            return `Schema v${data.schemaVersion}`;
        }
    }

    public static isSuccessful(data: SetConfigMultipleKeysReplyData): boolean {
        return data.keysProcessed > 0;
    }

    public static getEndpointTypeDescription(data: SetConfigMultipleKeysReplyData): string {
        if (data.schemaVersion !== 2 || data.endpointType === undefined) {
            return 'N/A (Schema 1)';
        }

        if (data.endpointType === 0) {
            return 'No specific endpoint type';
        }

        // Common endpoint types
        switch (data.endpointType) {
            case 0x8200:
                return 'FS II Beltpack';
            case 0x8300:
                return 'FS III Beltpack';
            case 0x8400:
                return 'Edge Beltpack';
            default:
                return `Endpoint Type 0x${data.endpointType.toString(16).padStart(4, '0')}`;
        }
    }

    public static getSummary(data: SetConfigMultipleKeysReplyData): string {
        const successIcon = data.keysProcessed > 0 ? '✅' : '⚠️';
        const statusText = data.keysProcessed > 0 ? 'Success' : 'No keys processed';

        return `${successIcon} Set Multiple Keys Configuration Reply:\n` +
            `  Status: ${statusText}\n` +
            `  Target: ${ReplySetConfigMultipleKeys.getPanelIdentifier(data)}\n` +
            `  Schema: ${ReplySetConfigMultipleKeys.getSchemaInfo(data)}\n` +
            `  Keys Processed: ${data.keysProcessed}\n` +
            `  Timestamp: ${data.timestamp}`;
    }

    public static getDetailedInfo(data: SetConfigMultipleKeysReplyData): string {
        return `Set Config Multiple Keys Reply Details:\n` +
            `  Message ID: 0x${data.messageID.toString(16).padStart(4, '0')} (${data.messageID})\n` +
            `  Panel Location: ${ReplySetConfigMultipleKeys.getPanelIdentifier(data)}\n` +
            `  Protocol Schema: Version ${data.schemaVersion}\n` +
            `  Endpoint Type: ${ReplySetConfigMultipleKeys.getEndpointTypeDescription(data)}\n` +
            `  Keys Processed: ${data.keysProcessed}\n` +
            `  Processing Result: ${data.keysProcessed > 0 ? 'Configuration applied successfully' : 'No keys were configured'}\n` +
            `  Response Time: ${data.timestamp}`;
    }

    // Validation helpers
    public static validateReply(data: SetConfigMultipleKeysReplyData): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (data.slot < 0 || data.slot > 255) {
            issues.push(`Invalid slot number: ${data.slot} (should be 0-255)`);
        }

        if (data.port < 0 || data.port > 255) {
            issues.push(`Invalid port number: ${data.port} (should be 0-255)`);
        }

        if (data.schemaVersion === 2 && data.endpointType !== undefined) {
            if (data.endpointType < 0 || data.endpointType > 65535) {
                issues.push(`Invalid endpoint type: ${data.endpointType} (should be 0-65535)`);
            }
        }

        if (data.keysProcessed < 0 || data.keysProcessed > 65535) {
            issues.push(`Invalid keys processed count: ${data.keysProcessed} (should be 0-65535)`);
        }

        // Warning if no keys were processed
        if (data.keysProcessed === 0) {
            issues.push('Warning: No keys were processed - check original request validity');
        }

        return {
            valid: issues.length === 0 || (issues.length === 1 && issues[0].startsWith('Warning:')),
            issues
        };
    }

    // Compare with original request (if available)
    public static compareWithRequest(
        reply: SetConfigMultipleKeysReplyData,
        originalKeyCount: number
    ): {
        allProcessed: boolean;
        processed: number;
        failed: number;
        successRate: number;
    } {
        const processed = reply.keysProcessed;
        const failed = originalKeyCount - processed;
        const successRate = originalKeyCount > 0 ? (processed / originalKeyCount) * 100 : 0;

        return {
            allProcessed: processed === originalKeyCount,
            processed,
            failed,
            successRate: Math.round(successRate * 100) / 100
        };
    }

    // Get processing status
    public static getProcessingStatus(data: SetConfigMultipleKeysReplyData): 'success' | 'partial' | 'failed' {
        if (data.keysProcessed === 0) {
            return 'failed';
        }
        // We don't know the original count, so assume success if any were processed
        return 'success';
    }

    // Format for logging
    public static formatForLog(data: SetConfigMultipleKeysReplyData): string {
        const status = ReplySetConfigMultipleKeys.getProcessingStatus(data);
        const statusIcon = status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌';

        return `${statusIcon} [${data.timestamp}] SetConfigMultipleKeys Reply: ` +
            `${ReplySetConfigMultipleKeys.getPanelIdentifier(data)} - ` +
            `${data.keysProcessed} keys processed (${ReplySetConfigMultipleKeys.getSchemaInfo(data)})`;
    }

    // Get response metrics
    public static getResponseMetrics(data: SetConfigMultipleKeysReplyData): {
        targetPanel: string;
        schemaVersion: number;
        endpointType: number | null;
        keysProcessed: number;
        isSuccessful: boolean;
        processingStatus: string;
    } {
        return {
            targetPanel: ReplySetConfigMultipleKeys.getPanelIdentifier(data),
            schemaVersion: data.schemaVersion,
            endpointType: data.endpointType || null,
            keysProcessed: data.keysProcessed,
            isSuccessful: ReplySetConfigMultipleKeys.isSuccessful(data),
            processingStatus: ReplySetConfigMultipleKeys.getProcessingStatus(data)
        };
    }
}

export { ReplySetConfigMultipleKeys, SetConfigMultipleKeysReplyData };