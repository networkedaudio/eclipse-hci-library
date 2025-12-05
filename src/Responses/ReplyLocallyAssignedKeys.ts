import { ENTITY_TYPES, getEntityTypeName } from '../DataStructures/EntityTypes';
import { KEY_STATES, getKeyStateName, getKeyStateIcon } from '../DataStructures/KeyStates';
import { getLatchModeName } from '../DataStructures/LatchModes';
import { KeyConfiguration, LocallyAssignedKey, LocallyAssignedKeysData } from '../DataStructures/KeyInterfaces';

class ReplyLocallyAssignedKeys {
    public static parse(payload: Buffer): LocallyAssignedKeysData | null {
        // Check minimum payload size
        // Slot (1) + Port (1) + Count (1) = 3 bytes minimum
        if (payload.length < 3) {
            console.error('Locally assigned keys reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw locally assigned keys payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Slot (1 byte)
        const slot = payload.readUInt8(offset);
        offset += 1;

        // Port (1 byte)
        const port = payload.readUInt8(offset);
        offset += 1;

        // Count (1 byte)
        const count = payload.readUInt8(offset);
        offset += 1;

        console.log(`Parsing locally assigned keys: Slot=${slot}, Port=${port}, Count=${count}`);

        // Validate we have enough data for all key entries
        // Each entry is: Region(1) + Key(1) + Page(1) + Entity(2) + KeyStatus(1) + PotNumber(2) + KeyOperation(4) + PageValue(1) + KeyConfig(26) = 39 bytes
        const expectedDataSize = count * 39;
        if (payload.length < 3 + expectedDataSize) {
            console.error(`Insufficient data: need ${3 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const keys: LocallyAssignedKey[] = [];

        // Parse each key entry
        for (let i = 0; i < count; i++) {
            if (offset + 39 > payload.length) {
                console.error(`Insufficient data for key entry ${i + 1}`);
                return null;
            }

            // Region (1 byte)
            const region = payload.readUInt8(offset);
            offset += 1;

            // Key (1 byte)
            const keyId = payload.readUInt8(offset);
            offset += 1;

            // Page (1 byte)
            const page = payload.readUInt8(offset);
            offset += 1;

            // Entity (2 bytes)
            const entity = payload.readUInt16BE(offset);
            offset += 2;

            // Key Status (1 byte)
            const keyStatusByte = payload.readUInt8(offset);
            offset += 1;

            // Pot Number (2 bytes)
            const potNumber = payload.readUInt16BE(offset);
            offset += 2;

            // Key Operation (4 bytes)
            const keyOperationBytes = payload.readUInt32BE(offset);
            offset += 4;

            // Page Value (1 byte)
            const pageValue = payload.readUInt8(offset);
            offset += 1;

            // Key Config (26 bytes)
            const keyConfigStart = offset;

            // System Number (1 byte)
            const systemNumber = payload.readUInt8(offset);
            offset += 1;

            // Unused (1 byte)
            offset += 1;

            // Specific Use (2 bytes)
            const specificUse = payload.readUInt16BE(offset);
            offset += 2;

            // Secondary DCC (2 bytes)
            const secondaryDcc = payload.readUInt16BE(offset);
            offset += 2;

            // Key Action (2 bytes)
            const keyActionBytes = payload.readUInt16BE(offset);
            offset += 2;

            // GUID (16 bytes)
            const guidBytes = payload.subarray(offset, offset + 16);
            const guid = guidBytes.toString('hex').toUpperCase();
            offset += 16;

            // Parse key status
            const keyState = (keyStatusByte >> 6) & 0x03;
            const listenMode = (keyStatusByte & 0x20) !== 0;
            const potAssigned = (keyStatusByte & 0x10) !== 0;
            const potState = keyStatusByte & 0x0F;

            // Parse key operation
            const unpaged = (keyOperationBytes & 0x100) !== 0;
            const textMode = (keyOperationBytes & 0x80) !== 0;
            const dual = (keyOperationBytes & 0x40) !== 0;
            const dial = (keyOperationBytes & 0x20) !== 0;
            const latchMode = keyOperationBytes & 0x0F;
            const group = (keyOperationBytes >> 4) & 0x0F;
            const deactivating = (keyOperationBytes & 0x08) !== 0;
            const makeBreak = (keyOperationBytes & 0x04) !== 0;
            const crossPage = (keyOperationBytes & 0x02) !== 0;
            const cmapsiSp1 = (keyOperationBytes & 0x01) !== 0;
            const cmapsiSp2 = (keyOperationBytes & 0x80) !== 0;
            const regionValue = (keyOperationBytes >> 4) & 0x07;
            const stackedGroup = (keyOperationBytes & 0x08) !== 0;

            // Parse key action
            const forceListen = (keyActionBytes & 0x8000) !== 0;
            const talk = (keyActionBytes & 0x4000) !== 0;
            const listen = (keyActionBytes & 0x2000) !== 0;
            const holdToTalk = (keyActionBytes & 0x1000) !== 0;
            const initialState = (keyActionBytes & 0x0800) !== 0;
            const assignLocally = (keyActionBytes & 0x0400) !== 0;
            const assignRemotely = (keyActionBytes & 0x0200) !== 0;
            const locallyAssigned = (keyActionBytes & 0x0100) !== 0;

            // Create human-readable key identifier
            const keyIdentifier = `R${region}K${keyId}P${page}`;

            console.log(`Key ${i + 1}: ${keyIdentifier}, Entity=${entity}, Status=0x${keyStatusByte.toString(16).padStart(2, '0')}, Operation=0x${keyOperationBytes.toString(16).padStart(8, '0')}`);

            keys.push({
                region,
                keyId,
                page,
                entity,
                entityName: getEntityTypeName(entity),
                keyIdentifier,
                keyStatus: {
                    keyState,
                    keyStateName: getKeyStateName(keyState),
                    listenMode,
                    potAssigned,
                    potState
                },
                potNumber,
                keyOperation: {
                    unpaged,
                    textMode,
                    dual,
                    dial,
                    latchMode,
                    latchModeName: getLatchModeName(latchMode),
                    group,
                    deactivating,
                    makeBreak,
                    crossPage,
                    cmapsiSp1,
                    cmapsiSp2,
                    regionValue,
                    stackedGroup
                },
                pageValue,
                keyConfig: {
                    systemNumber,
                    specificUse,
                    secondaryDcc,
                    keyAction: {
                        forceListen,
                        talk,
                        listen,
                        holdToTalk,
                        initialState,
                        assignLocally,
                        assignRemotely,
                        locallyAssigned
                    },
                    guid
                }
            });
        }

        const panelIdentifier = `Slot ${slot}, Port ${port}`;

        return {
            messageType: 'locallyAssignedKeys',
            messageID: 0x00BA,
            timestamp: new Date().toISOString(),
            slot,
            port,
            panelIdentifier,
            count,
            keys,
            rawPayload: payload.toString('hex')
        };
    }

    public static displayLocallyAssignedKeys(data: LocallyAssignedKeysData): void {
        console.log('=== Locally Assigned Keys Reply ===');
        console.log(`Panel: ${data.panelIdentifier}`);
        console.log(`Slot: ${data.slot}`);
        console.log(`Port: ${data.port}`);
        console.log(`Key Count: ${data.count}`);
        console.log(`Keys Found: ${data.keys.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.keys.length > 0) {
            // Group keys by region for better display
            const keysByRegion = ReplyLocallyAssignedKeys.getKeysByRegion(data);

            Object.entries(keysByRegion).forEach(([region, regionKeys]) => {
                console.log(`--- Region ${region} (${regionKeys.length} locally assigned keys) ---`);

                regionKeys.forEach((key, index) => {
                    const stateIcon = getKeyStateIcon(key.keyStatus.keyState);
                    const stateText = key.keyStatus.keyState === 1 ? 'ON' : 'OFF';
                    const listenBadge = key.keyStatus.listenMode ? ' [LISTEN]' : '';
                    const pageInfo = key.page > 0 ? ` [Page ${key.page}]` : '';
                    const potInfo = key.keyStatus.potAssigned ? ` Pot:${key.keyStatus.potState}(#${key.potNumber})` : '';
                    const entityInfo = ` [${key.entityName}]`;

                    console.log(`  ${index + 1}. Key ${key.keyId}${pageInfo}: ${stateIcon} ${stateText}${listenBadge}${potInfo}${entityInfo}`);
                    console.log(`      ID: ${key.keyIdentifier}`);
                    console.log(`      Latch: ${key.keyOperation.latchModeName}`);
                    console.log(`      Actions: Talk=${key.keyConfig.keyAction.talk}, Listen=${key.keyConfig.keyAction.listen}`);
                    console.log(`      GUID: ${key.keyConfig.guid}`);

                    if (key.keyOperation.group > 0) {
                        console.log(`      Interlock Group: ${key.keyOperation.group}`);
                    }

                    if (key.pageValue > 0) {
                        console.log(`      Page Switch Target: ${key.pageValue}`);
                    }
                });
                console.log('');
            });

            // Summary statistics
            const stats = ReplyLocallyAssignedKeys.getKeyStats(data);
            console.log('--- Summary ---');
            console.log(`Total Locally Assigned Keys: ${data.keys.length}`);
            console.log(`Active Keys: ${stats.activeKeys} | Inactive Keys: ${stats.inactiveKeys}`);
            console.log(`Listen Mode Keys: ${stats.listenModeKeys}`);
            console.log(`Pot Assigned Keys: ${stats.potAssignedKeys}`);
            console.log(`Regions with Local Keys: ${stats.regionsWithKeys}`);
            console.log(`Pages with Local Keys: ${stats.pagesWithKeys}`);

            // Show entity breakdown
            console.log('Entity Types:', Object.entries(stats.entityBreakdown)
                .map(([entity, count]) => `${entity}: ${count}`)
                .join(', '));

            // Show latch mode breakdown
            console.log('Latch Modes:', Object.entries(stats.latchModeBreakdown)
                .map(([mode, count]) => `${mode}: ${count}`)
                .join(', '));
        } else {
            console.log('No locally assigned keys found on this panel');
        }
        console.log('displayLocallyAssignedKeys=====================================');
    }

    // Helper methods for filtering and analysis
    public static getActiveKeys(data: LocallyAssignedKeysData): LocallyAssignedKey[] {
        return data.keys.filter(key => key.keyStatus.keyState === 1);
    }

    public static getInactiveKeys(data: LocallyAssignedKeysData): LocallyAssignedKey[] {
        return data.keys.filter(key => key.keyStatus.keyState === 0);
    }

    public static getListenModeKeys(data: LocallyAssignedKeysData): LocallyAssignedKey[] {
        return data.keys.filter(key => key.keyStatus.listenMode);
    }

    public static getPotAssignedKeys(data: LocallyAssignedKeysData): LocallyAssignedKey[] {
        return data.keys.filter(key => key.keyStatus.potAssigned);
    }

    public static getKeysByEntity(data: LocallyAssignedKeysData, entityType: number): LocallyAssignedKey[] {
        return data.keys.filter(key => key.entity === entityType);
    }

    public static getKeysByLatchMode(data: LocallyAssignedKeysData, latchMode: number): LocallyAssignedKey[] {
        return data.keys.filter(key => key.keyOperation.latchMode === latchMode);
    }

    public static getKeysByRegion(data: LocallyAssignedKeysData): Record<string, LocallyAssignedKey[]> {
        const byRegion: Record<string, LocallyAssignedKey[]> = {};

        data.keys.forEach(key => {
            const regionKey = key.region.toString();
            if (!byRegion[regionKey]) {
                byRegion[regionKey] = [];
            }
            byRegion[regionKey].push(key);
        });

        // Sort regions numerically
        const sortedRegions: Record<string, LocallyAssignedKey[]> = {};
        Object.keys(byRegion)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .forEach(region => {
                // Sort keys within region
                byRegion[region].sort((a, b) => a.keyId - b.keyId);
                sortedRegions[region] = byRegion[region];
            });

        return sortedRegions;
    }

    public static getKeysByPage(data: LocallyAssignedKeysData): Record<string, LocallyAssignedKey[]> {
        const byPage: Record<string, LocallyAssignedKey[]> = {};

        data.keys.forEach(key => {
            const pageKey = key.page.toString();
            if (!byPage[pageKey]) {
                byPage[pageKey] = [];
            }
            byPage[pageKey].push(key);
        });

        return byPage;
    }

    public static findKey(data: LocallyAssignedKeysData, region: number, keyId: number, page: number = 0): LocallyAssignedKey | null {
        return data.keys.find(key =>
            key.region === region &&
            key.keyId === keyId &&
            key.page === page
        ) || null;
    }

    public static findKeyByIdentifier(data: LocallyAssignedKeysData, identifier: string): LocallyAssignedKey | null {
        return data.keys.find(key => key.keyIdentifier === identifier) || null;
    }

    public static findKeyByGuid(data: LocallyAssignedKeysData, guid: string): LocallyAssignedKey | null {
        return data.keys.find(key => key.keyConfig.guid.toLowerCase() === guid.toLowerCase()) || null;
    }

    public static getKeyStats(data: LocallyAssignedKeysData): {
        activeKeys: number;
        inactiveKeys: number;
        listenModeKeys: number;
        potAssignedKeys: number;
        regionsWithKeys: number;
        pagesWithKeys: number;
        entityBreakdown: Record<string, number>;
        latchModeBreakdown: Record<string, number>;
    } {
        const activeKeys = data.keys.filter(key => key.keyStatus.keyState === 1).length;
        const inactiveKeys = data.keys.filter(key => key.keyStatus.keyState === 0).length;
        const listenModeKeys = data.keys.filter(key => key.keyStatus.listenMode).length;
        const potAssignedKeys = data.keys.filter(key => key.keyStatus.potAssigned).length;

        // Count distinct regions and pages with local keys
        const regionsWithKeys = new Set(data.keys.map(key => key.region)).size;
        const pagesWithKeys = new Set(data.keys.map(key => key.page)).size;

        // Build entity and latch mode breakdowns
        const entityBreakdown: Record<string, number> = {};
        const latchModeBreakdown: Record<string, number> = {};

        data.keys.forEach(key => {
            // Entity breakdown
            const entityName = getEntityTypeName(key.entity);
            if (!entityBreakdown[entityName]) {
                entityBreakdown[entityName] = 0;
            }
            entityBreakdown[entityName]++;

            // Latch mode breakdown
            const latchModeName = getLatchModeName(key.keyOperation.latchMode);
            if (!latchModeBreakdown[latchModeName]) {
                latchModeBreakdown[latchModeName] = 0;
            }
            latchModeBreakdown[latchModeName]++;
        });

        return {
            activeKeys,
            inactiveKeys,
            listenModeKeys,
            potAssignedKeys,
            regionsWithKeys,
            pagesWithKeys,
            entityBreakdown,
            latchModeBreakdown
        };
    }
}

export { ReplyLocallyAssignedKeys, LocallyAssignedKeysData, LocallyAssignedKey };