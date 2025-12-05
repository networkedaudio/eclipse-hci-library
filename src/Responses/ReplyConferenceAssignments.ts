import { getEditTypeName, parseEditTypeMask, getEditTypeMaskDescription, getEditTypeMaskIcon } from '../DataStructures/EditTypes';

interface ConferenceAssignment {
    conferenceNumber: number;          // Conference/group number (starting at 1)
    editTypeMask: number;             // Edit type bit mask
    editType: {                       // Parsed edit type flags
        talk: boolean;                // Talk permission
        listen: boolean;              // Listen permission
        localDeleted: boolean;        // Locally deleted
        localAssigned: boolean;       // Locally assigned
        mapAssigned: boolean;         // Map assigned
        localOverride: boolean;       // Local override
    };
    editTypeDescriptions: string[];   // Human-readable edit type descriptions
    editTypeIcon: string;            // Visual representation of edit types
    fullPortIdentifier: {            // Full port identifier
        systemNumber: number;        // System number (1-15)
        portNumber: number;          // Port number (1-1023)
        identifier: string;          // Human-readable identifier
    };
}

interface ConferenceAssignmentsData {
    messageType: 'conferenceAssignments';
    messageID: number;
    timestamp: string;
    count: number;                    // Number of conference assignments
    assignments: ConferenceAssignment[]; // Array of conference assignments
    rawPayload: string;
}

class ReplyConferenceAssignments {
    public static parse(payload: Buffer): ConferenceAssignmentsData | null {
        // Check minimum payload size
        // Count (2) = 2 bytes minimum
        if (payload.length < 2) {
            console.error('Conference assignments reply payload too short');
            return null;
        }

        // Log the raw payload with 0x between bytes
        console.log('Raw conference assignments payload:', payload.toString('hex').replace(/../g, '0x$& ').trim());

        let offset = 0;

        // Count (2 bytes)
        const count = payload.readUInt16BE(offset);
        offset += 2;

        console.log(`Parsing conference assignments: Count=${count}`);

        // Calculate expected size per assignment entry
        // ConferenceNumber(2) + EditTypeMask(1) + SystemNumber(1) + PortNumber(2) = 6 bytes per assignment
        const bytesPerAssignment = 6;
        const expectedDataSize = count * bytesPerAssignment;

        if (payload.length < 2 + expectedDataSize) {
            console.error(`Insufficient data: need ${2 + expectedDataSize} bytes, got ${payload.length}`);
            return null;
        }

        const assignments: ConferenceAssignment[] = [];

        // Parse each assignment entry
        for (let i = 0; i < count; i++) {
            if (offset + bytesPerAssignment > payload.length) {
                console.error(`Insufficient data for assignment entry ${i + 1}`);
                return null;
            }

            // Conference/Group Number (2 bytes)
            const conferenceNumber = payload.readUInt16BE(offset);
            offset += 2;

            // Edit Type Mask (1 byte)
            const editTypeMask = payload.readUInt8(offset);
            offset += 1;

            // System Number (1 byte)
            const systemNumber = payload.readUInt8(offset);
            offset += 1;

            // Port Number (2 bytes)
            const portNumber = payload.readUInt16BE(offset);
            offset += 2;

            // Parse edit type mask
            const editType = parseEditTypeMask(editTypeMask);
            const editTypeDescriptions = getEditTypeMaskDescription(editTypeMask);
            const editTypeIcon = getEditTypeMaskIcon(editTypeMask);

            // Create full port identifier
            const fullPortIdentifier = {
                systemNumber,
                portNumber,
                identifier: `S${systemNumber}P${portNumber}`
            };

            console.log(`Assignment ${i + 1}: Conference=${conferenceNumber}, EditMask=0x${editTypeMask.toString(16).padStart(2, '0')}, Port=${fullPortIdentifier.identifier}`);

            assignments.push({
                conferenceNumber,
                editTypeMask,
                editType,
                editTypeDescriptions,
                editTypeIcon,
                fullPortIdentifier
            });
        }

        return {
            messageType: 'conferenceAssignments',
            messageID: 0x00C6,
            timestamp: new Date().toISOString(),
            count,
            assignments,
            rawPayload: payload.toString('hex')
        };
    }

    public static displayConferenceAssignments(data: ConferenceAssignmentsData): void {
        console.log('=== Conference Assignments Reply ===');
        console.log(`Assignment Count: ${data.count}`);
        console.log(`Assignments Found: ${data.assignments.length}`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('');

        if (data.assignments.length > 0) {
            // Group assignments by conference number for better display
            const assignmentsByConference = ReplyConferenceAssignments.getAssignmentsByConference(data);

            Object.entries(assignmentsByConference).forEach(([confNum, confAssignments]) => {
                console.log(`--- Conference ${confNum} (${confAssignments.length} members) ---`);

                confAssignments.forEach((assignment, index) => {
                    const permissions = [];
                    if (assignment.editType.talk) permissions.push('Talk');
                    if (assignment.editType.listen) permissions.push('Listen');
                    const permissionStr = permissions.length > 0 ? permissions.join(' + ') : 'None';

                    const assignments = [];
                    if (assignment.editType.mapAssigned) assignments.push('Map');
                    if (assignment.editType.localAssigned) assignments.push('Local');
                    if (assignment.editType.localOverride) assignments.push('Override');
                    if (assignment.editType.localDeleted) assignments.push('Deleted');
                    const assignmentStr = assignments.length > 0 ? assignments.join(' + ') : 'None';

                    console.log(`  ${index + 1}. ${assignment.fullPortIdentifier.identifier}: ${assignment.editTypeIcon} ${permissionStr}`);
                    console.log(`      Assignment: ${assignmentStr}`);
                    console.log(`      Details: ${assignment.editTypeDescriptions.join(', ')}`);
                });
                console.log('');
            });

            // Summary statistics
            const stats = ReplyConferenceAssignments.getAssignmentStats(data);
            console.log('displayConferenceAssignments--- Summary ---');
            console.log(`Total Assignments: ${data.assignments.length}`);
            console.log(`Conferences with Members: ${stats.conferencesWithMembers}`);
            console.log(`Talk Enabled: ${stats.talkEnabledAssignments} | Listen Enabled: ${stats.listenEnabledAssignments}`);
            console.log(`Map Assigned: ${stats.mapAssignedAssignments} | Locally Assigned: ${stats.locallyAssignedAssignments}`);
            console.log(`Local Overrides: ${stats.localOverrideAssignments} | Local Deletions: ${stats.localDeletedAssignments}`);
            console.log(`Systems Involved: ${stats.systemsInvolved}`);
            console.log(`Port Range: ${stats.minPort}-${stats.maxPort}`);

            // Show any issues
            if (stats.localDeletedAssignments > 0 || stats.localOverrideAssignments > 0) {
                console.log('');
                console.log('⚠️  LOCAL MODIFICATIONS DETECTED:');
                if (stats.localDeletedAssignments > 0) {
                    console.log(`  - ${stats.localDeletedAssignments} locally deleted assignments`);
                }
                if (stats.localOverrideAssignments > 0) {
                    console.log(`  - ${stats.localOverrideAssignments} local override assignments`);
                }
            }
        } else {
            console.log('No conference assignments found');
        }
        console.log('displayConferenceAssignments========================================');
    }

    // Helper methods for filtering and analysis
    public static getTalkEnabledAssignments(data: ConferenceAssignmentsData): ConferenceAssignment[] {
        return data.assignments.filter(assignment => assignment.editType.talk);
    }

    public static getListenEnabledAssignments(data: ConferenceAssignmentsData): ConferenceAssignment[] {
        return data.assignments.filter(assignment => assignment.editType.listen);
    }

    public static getLocallyAssignedAssignments(data: ConferenceAssignmentsData): ConferenceAssignment[] {
        return data.assignments.filter(assignment => assignment.editType.localAssigned);
    }

    public static getMapAssignedAssignments(data: ConferenceAssignmentsData): ConferenceAssignment[] {
        return data.assignments.filter(assignment => assignment.editType.mapAssigned);
    }

    public static getLocalOverrideAssignments(data: ConferenceAssignmentsData): ConferenceAssignment[] {
        return data.assignments.filter(assignment => assignment.editType.localOverride);
    }

    public static getLocalDeletedAssignments(data: ConferenceAssignmentsData): ConferenceAssignment[] {
        return data.assignments.filter(assignment => assignment.editType.localDeleted);
    }

    public static getAssignmentsByConference(data: ConferenceAssignmentsData): Record<string, ConferenceAssignment[]> {
        const byConference: Record<string, ConferenceAssignment[]> = {};

        data.assignments.forEach(assignment => {
            const confKey = assignment.conferenceNumber.toString();
            if (!byConference[confKey]) {
                byConference[confKey] = [];
            }
            byConference[confKey].push(assignment);
        });

        // Sort conferences numerically
        const sortedConferences: Record<string, ConferenceAssignment[]> = {};
        Object.keys(byConference)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .forEach(confNum => {
                // Sort assignments within conference by port
                byConference[confNum].sort((a, b) => {
                    if (a.fullPortIdentifier.systemNumber !== b.fullPortIdentifier.systemNumber) {
                        return a.fullPortIdentifier.systemNumber - b.fullPortIdentifier.systemNumber;
                    }
                    return a.fullPortIdentifier.portNumber - b.fullPortIdentifier.portNumber;
                });
                sortedConferences[confNum] = byConference[confNum];
            });

        return sortedConferences;
    }

    public static getAssignmentsBySystem(data: ConferenceAssignmentsData): Record<number, ConferenceAssignment[]> {
        const bySystem: Record<number, ConferenceAssignment[]> = {};

        data.assignments.forEach(assignment => {
            const systemNum = assignment.fullPortIdentifier.systemNumber;
            if (!bySystem[systemNum]) {
                bySystem[systemNum] = [];
            }
            bySystem[systemNum].push(assignment);
        });

        return bySystem;
    }

    public static findAssignmentsByConference(data: ConferenceAssignmentsData, conferenceNumber: number): ConferenceAssignment[] {
        return data.assignments.filter(assignment => assignment.conferenceNumber === conferenceNumber);
    }

    public static findAssignmentsByPort(data: ConferenceAssignmentsData, systemNumber: number, portNumber: number): ConferenceAssignment[] {
        return data.assignments.filter(assignment =>
            assignment.fullPortIdentifier.systemNumber === systemNumber &&
            assignment.fullPortIdentifier.portNumber === portNumber
        );
    }

    public static getAssignmentStats(data: ConferenceAssignmentsData): {
        totalAssignments: number;
        conferencesWithMembers: number;
        talkEnabledAssignments: number;
        listenEnabledAssignments: number;
        locallyAssignedAssignments: number;
        mapAssignedAssignments: number;
        localOverrideAssignments: number;
        localDeletedAssignments: number;
        systemsInvolved: number;
        minPort: number;
        maxPort: number;
        conferenceBreakdown: Record<number, number>;
        systemBreakdown: Record<number, number>;
    } {
        if (data.assignments.length === 0) {
            return {
                totalAssignments: 0,
                conferencesWithMembers: 0,
                talkEnabledAssignments: 0,
                listenEnabledAssignments: 0,
                locallyAssignedAssignments: 0,
                mapAssignedAssignments: 0,
                localOverrideAssignments: 0,
                localDeletedAssignments: 0,
                systemsInvolved: 0,
                minPort: 0,
                maxPort: 0,
                conferenceBreakdown: {},
                systemBreakdown: {}
            };
        }

        const conferences = new Set(data.assignments.map(a => a.conferenceNumber));
        const systems = new Set(data.assignments.map(a => a.fullPortIdentifier.systemNumber));
        const ports = data.assignments.map(a => a.fullPortIdentifier.portNumber);

        let talkEnabled = 0, listenEnabled = 0, locallyAssigned = 0, mapAssigned = 0, localOverride = 0, localDeleted = 0;
        const conferenceBreakdown: Record<number, number> = {};
        const systemBreakdown: Record<number, number> = {};

        data.assignments.forEach(assignment => {
            if (assignment.editType.talk) talkEnabled++;
            if (assignment.editType.listen) listenEnabled++;
            if (assignment.editType.localAssigned) locallyAssigned++;
            if (assignment.editType.mapAssigned) mapAssigned++;
            if (assignment.editType.localOverride) localOverride++;
            if (assignment.editType.localDeleted) localDeleted++;

            // Track conference breakdown
            conferenceBreakdown[assignment.conferenceNumber] = (conferenceBreakdown[assignment.conferenceNumber] || 0) + 1;

            // Track system breakdown
            systemBreakdown[assignment.fullPortIdentifier.systemNumber] = (systemBreakdown[assignment.fullPortIdentifier.systemNumber] || 0) + 1;
        });

        return {
            totalAssignments: data.assignments.length,
            conferencesWithMembers: conferences.size,
            talkEnabledAssignments: talkEnabled,
            listenEnabledAssignments: listenEnabled,
            locallyAssignedAssignments: locallyAssigned,
            mapAssignedAssignments: mapAssigned,
            localOverrideAssignments: localOverride,
            localDeletedAssignments: localDeleted,
            systemsInvolved: systems.size,
            minPort: Math.min(...ports),
            maxPort: Math.max(...ports),
            conferenceBreakdown,
            systemBreakdown
        };
    }
}

export { ReplyConferenceAssignments, ConferenceAssignmentsData, ConferenceAssignment };