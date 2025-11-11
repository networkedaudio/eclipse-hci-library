# Eclipse HCI Library

A TypeScript library for communicating with Eclipse HX matrix systems using the HCI (Host Control Interface) protocol. This library provides comprehensive support for both HCI v1 and HCI v2 protocols, allowing you to control crosspoints, manage conferences, handle aliases, control GPIO/SFO cards, and manage audio levels.

## Features

### Core Functionality
- **HCI v1 and v2 Protocol Support** - Full compatibility with both protocol versions
- **TCP Connection Management** - Reliable connection handling with automatic reconnection
- **Message Queue System** - Efficient message queuing and processing
- **Event-Driven Architecture** - Listen for system status changes and responses
- **Comprehensive Debugging** - Detailed logging and debug information

### Request Types (Commands)
- **Crosspoint Management** - Set and query audio routing
- **Conference Control** - Create and manage conference connections
- **Level Control** - Adjust input and output audio levels with dB conversion
- **Alias Management** - Create, delete, and query Unicode aliases
- **GPIO/SFO Control** - Control general-purpose I/O and SFO cards
- **EHX Control** - Manage EHX control actions and card status
- **System Status** - Query various system status information

### Response Handling
- **Real-time Status Updates** - Automatic parsing of system status messages
- **Level Conversion** - Built-in dB ↔ level value conversion utilities
- **Visual Displays** - ASCII charts and tables for status visualization
- **Statistical Analysis** - Comprehensive analysis tools for system monitoring

## Installation

```bash
npm install eclipse-hci-library
```

## Quick Start

```typescript
import EclipseHCI from 'eclipse-hci-library';

// Create connection
const client = new EclipseHCI('192.168.1.100', 9999);

// Enable debug output
client.showDebug = true;

// Connect to matrix
client.connect();

// Listen for connection events
client.on('connected', () => {
    console.log('Connected to Eclipse matrix');
    
    // Request system status
    const statusRequest = RequestCrosspointStatus.create();
    client.addToQueue(statusRequest);
});

// Listen for status updates
client.on('onReplyCrosspointStatus', (status) => {
    console.log(`Found ${status.crosspoints.length} active crosspoints`);
});
```

## Request Messages

### Crosspoint Control

#### RequestCrosspointActions
Control audio routing between inputs and outputs.

```typescript
import { RequestCrosspointActions } from 'eclipse-hci-library';

// Create a single crosspoint (Input 3 → Output 5)
const request = RequestCrosspointActions.singleCrosspoint(3, 5, 'connect');
client.addToQueue(request);

// Create multiple crosspoints
const multiRequest = RequestCrosspointActions.forCrosspoints([
    { input: 3, output: 5, action: 'connect' },
    { input: 4, output: 6, action: 'connect' },
    { input: 7, output: 8, action: 'disconnect' }
]);

// Disconnect all outputs from an input
const disconnectRequest = RequestCrosspointActions.disconnectInput(3);

// Connect input to multiple outputs
const fanoutRequest = RequestCrosspointActions.connectInputToMultipleOutputs(3, [5, 6, 7]);
```

#### RequestCrosspointStatus
Query current crosspoint connections.

```typescript
import { RequestCrosspointStatus } from 'eclipse-hci-library';

// Request all crosspoint status
const statusRequest = RequestCrosspointStatus.create();
client.addToQueue(statusRequest);

// Listen for response
client.on('onReplyCrosspointStatus', (status) => {
    console.log(`Active crosspoints: ${status.crosspoints.length}`);
    
    // Find connections for specific input
    const input3Connections = status.crosspoints.filter(cp => cp.input === 3);
    console.log(`Input 3 connected to outputs: ${input3Connections.map(cp => cp.output).join(', ')}`);
});
```

### Conference Control

#### RequestConferenceActions
Manage conference connections between multiple ports.

```typescript
import { RequestConferenceActions } from 'eclipse-hci-library';

// Create a simple conference
const conference = RequestConferenceActions.createConference([1, 2, 3, 4], 'connect');
client.addToQueue(conference);

// Add member to existing conference
const addMember = RequestConferenceActions.singleAction(5, 1, 'connect');

// Remove member from conference
const removeMember = RequestConferenceActions.singleAction(3, 1, 'disconnect');

// Create conference with listen-only members
const mixedConference = RequestConferenceActions.forActions([
    { member: 1, conference: 1, action: 'connect' },    // Full participant
    { member: 2, conference: 1, action: 'connect' },    // Full participant
    { member: 3, conference: 1, action: 'listen' }      // Listen-only
]);
```

#### RequestConferenceStatus
Query current conference memberships.

```typescript
import { RequestConferenceStatus } from 'eclipse-hci-library';

const statusRequest = RequestConferenceStatus.create();
client.addToQueue(statusRequest);

client.on('conferenceStatus', (status) => {
    const conferences = ReplyConferenceStatus.getConferenceGroups(status);
    
    conferences.forEach((conference, confNum) => {
        console.log(`Conference ${confNum}: ${conference.length} members`);
    });
});
```

### Level Control

#### RequestInputLevelActions
Control input audio levels with dB conversion.

```typescript
import { RequestInputLevelActions } from 'eclipse-hci-library';

// Set single port level
const levelRequest = RequestInputLevelActions.singleActionDB(3, -6); // Port 3 to -6dB
client.addToQueue(levelRequest);

// Set multiple ports with different levels
const multiLevel = RequestInputLevelActions.forPortLevelsDB([
    { port: 3, levelDB: 0 },    // Unity gain
    { port: 4, levelDB: -6 },   // -6 dB
    { port: 5, levelDB: -12 }   // -12 dB
]);

// Mute specific ports
const muteRequest = RequestInputLevelActions.mutePorts([3, 4, 5]);

// Unmute ports (set to unity gain)
const unmuteRequest = RequestInputLevelActions.unmutePorts([3, 4, 5]);

// Set multiple ports to same level
const groupLevel = RequestInputLevelActions.setPortsToLevelDB([1, 2, 3, 4], -10);
```

#### RequestInputLevelStatus
Query current input levels.

```typescript
import { RequestInputLevelStatus } from 'eclipse-hci-library';

const statusRequest = RequestInputLevelStatus.create();
client.addToQueue(statusRequest);

client.on('onReplyInputLevelStatus', (status) => {
    // Display active levels
    console.log(ReplyInputLevelStatus.getLevelSummary(status));
    
    // Check specific port
    const port3Level = ReplyInputLevelStatus.getLevelForPort(status, 3);
    if (port3Level) {
        console.log(`Port 3: ${LevelConversion.formatDB(port3Level.levelDB)}`);
    }
    
    // Get statistics
    const stats = ReplyInputLevelStatus.getLevelStats(status);
    console.log(`Average level: ${LevelConversion.formatDB(stats.avgDB)}`);
});
```

#### RequestOutputLevelActions
Control output audio levels (-72dB to +18dB range).

```typescript
import { RequestOutputLevelActions } from 'eclipse-hci-library';

// Set output levels with range checking
const outputLevel = RequestOutputLevelActions.singleActionDB(5, -6); // -6dB
client.addToQueue(outputLevel);

// Full cut (complete muting)
const fullCut = RequestOutputLevelActions.mutePorts([3, 4]);

// Maximum output level
const maxLevel = RequestOutputLevelActions.setPortsToMax([5, 6]); // ~+18dB

// Check for range issues
console.log(outputLevel.getDescriptionWithWarnings());
```

#### RequestOutputLevelStatus
Query current output levels.

```typescript
import { RequestOutputLevelStatus } from 'eclipse-hci-library';

const statusRequest = RequestOutputLevelStatus.create();
client.addToQueue(statusRequest);

client.on('onReplyOutputLevelStatus', (status) => {
    if (status.isUpdate) {
        console.log('Output levels were changed');
    } else {
        console.log('Current output level status');
    }
    
    // Check for out-of-range levels
    const outOfRange = ReplyOutputLevelStatus.getOutOfRangePorts(status);
    if (outOfRange.length > 0) {
        console.log('Ports outside -72dB to +18dB range:');
        outOfRange.forEach(p => console.log(`Port ${p.port}: ${LevelConversion.formatDB(p.levelDB)}`));
    }
});
```

### Crosspoint Level Control

#### RequestCrosspointLevelActions
Control individual crosspoint levels (gain/attenuation).

```typescript
import { RequestCrosspointLevelActions } from 'eclipse-hci-library';

// Set crosspoint level
const cpLevel = RequestCrosspointLevelActions.singleActionDB(3, 5, -6); // Input 3→Output 5, -6dB
client.addToQueue(cpLevel);

// Set multiple crosspoint levels
const multiCpLevel = RequestCrosspointLevelActions.forCrosspointLevelsDB([
    { input: 3, output: 5, levelDB: -6 },
    { input: 4, output: 6, levelDB: -3 },
    { input: 7, output: 8, levelDB: 0 }
]);

// Mute specific crosspoints
const muteCrosspoints = RequestCrosspointLevelActions.muteCrosspoints([
    { input: 3, output: 5 },
    { input: 4, output: 6 }
]);
```

#### RequestCrosspointLevelStatus
Query crosspoint level settings.

```typescript
import { RequestCrosspointLevelStatus } from 'eclipse-hci-library';

const statusRequest = RequestCrosspointLevelStatus.create();
client.addToQueue(statusRequest);

client.on('onReplyCrosspointLevelStatus', (status) => {
    console.log(`${status.levels.length} crosspoints have custom levels`);
    
    // Find specific crosspoint level
    const cpLevel = ReplyCrosspointLevelStatus.getLevelForCrosspoint(status, 3, 5);
    if (cpLevel) {
        console.log(`Input 3→Output 5: ${LevelConversion.formatDB(cpLevel.levelDB)}`);
    }
});
```

### Alias Management

#### RequestUnicodeAliasList
Request list of all Unicode aliases.

```typescript
import { RequestUnicodeAliasList } from 'eclipse-hci-library';

const aliasRequest = RequestUnicodeAliasList.create();
client.addToQueue(aliasRequest);

client.on('onReplyUnicodeAliasStatus', (aliases) => {
    if (aliases.isFullList) {
        console.log(`Total aliases: ${aliases.aliases.length}`);
        
        // Group by entity type
        const byType = ReplyUnicodeAliasStatus.getAliasesByEntityType(aliases);
        Object.entries(byType).forEach(([type, typeAliases]) => {
            console.log(`${type}: ${typeAliases.length} aliases`);
        });
    }
});
```

#### RequestAliasDelete
Delete previously created aliases.

```typescript
import { RequestAliasDelete } from 'eclipse-hci-library';

// Delete single alias
const deleteOne = RequestAliasDelete.singleAlias(1, 1, 2); // System 1, Entity Type 1, Instance 2

// Delete port aliases (common use case)
const deletePort = RequestAliasDelete.forPort(1, 3); // System 1, Port 3

// Delete multiple port aliases
const deletePorts = RequestAliasDelete.forPorts(1, [3, 4, 5]); // System 1, Ports 3,4,5

client.addToQueue(deletePort);
```

### GPIO/SFO Control

#### RequestEHXControlActions
Control GPIO and SFO card pins.

```typescript
import { RequestEHXControlActions } from 'eclipse-hci-library';

// Add EHX control
const addControl = RequestEHXControlActions.addControl(5, 12, 'enable');
client.addToQueue(addControl);

// Delete EHX control
const deleteControl = RequestEHXControlActions.deleteControl(5, 12, 'enable');

// Multiple actions
const multiActions = RequestEHXControlActions.forActions([
    { direction: 'add', cardNumber: 5, pinNumber: 12, mapType: 'enable' },
    { direction: 'add', cardNumber: 5, pinNumber: 13, mapType: 'inhibit' },
    { direction: 'delete', cardNumber: 3, pinNumber: 8, mapType: 'enable' }
]);
```

#### RequestEHXControlCardStatus
Query EHX control card status.

```typescript
import { RequestEHXControlCardStatus } from 'eclipse-hci-library';

const cardStatus = RequestEHXControlCardStatus.create();
client.addToQueue(cardStatus);

client.on('onReplyEHXControlCardStatus', (status) => {
    const presentCards = ReplyEHXControlCardStatus.getPresentCards(status);
    const gpioCards = ReplyEHXControlCardStatus.getPresentGPIOCards(status);
    const sfoCards = ReplyEHXControlCardStatus.getPresentSFOCards(status);
    
    console.log(`Present cards: ${presentCards.length}`);
    console.log(`GPIO cards: ${gpioCards.length}, SFO cards: ${sfoCards.length}`);
});
```

### GPIO/SFO Status Monitoring

Listen for GPIO/SFO pin state changes:

```typescript
client.on('onReplyGPIOSFOStatus', (gpioStatus) => {
    console.log(`Card ${gpioStatus.cardNumber} (${ReplyGPIOSFOStatus.getCardType(gpioStatus)}):`);
    
    const activeInputs = ReplyGPIOSFOStatus.getActiveInputPins(gpioStatus);
    const activeOutputs = ReplyGPIOSFOStatus.getActiveOutputPins(gpioStatus);
    
    if (activeInputs.length > 0) {
        console.log('Active inputs:', activeInputs.map(p => p.pinNumber).join(', '));
    }
    
    if (activeOutputs.length > 0) {
        console.log('Active outputs:', activeOutputs.map(p => p.pinNumber).join(', '));
    }
});
```

## Utility Classes

### LevelConversion
Convert between level values (0-255) and dB values.

```typescript
import { LevelConversion } from 'eclipse-hci-library';

// Convert level to dB
const db = LevelConversion.levelToDB(204); // 0 dB (unity gain)
const dbFormatted = LevelConversion.formatDB(db); // "0.0 dB"

// Convert dB to level
const level = LevelConversion.dBToLevel(-6); // Level for -6 dB

// Level ranges
console.log(`Minimum level: ${LevelConversion.MIN_LEVEL}`); // 0
console.log(`Maximum level: ${LevelConversion.MAX_LEVEL}`); // 255
console.log(`Unity gain level: ${LevelConversion.UNITY_LEVEL}`); // 204
```

## Event Handling

The library uses an event-driven architecture. Here are the main events:

```typescript
// Connection events
client.on('connected', () => console.log('Connected to matrix'));
client.on('disconnected', () => console.log('Disconnected from matrix'));
client.on('error', (error) => console.error('Connection error:', error));

// Status response events
client.on('onReplyCrosspointStatus', (status) => { /* Handle crosspoint status */ });
client.on('conferenceStatus', (status) => { /* Handle conference status */ });
client.on('onReplyCrosspointLevelStatus', (status) => { /* Handle crosspoint levels */ });
client.on('onReplyUnicodeAliasStatus', (status) => { /* Handle alias status */ });
client.on('onReplyEHXControlCardStatus', (status) => { /* Handle EHX card status */ });
client.on('onReplyGPIOSFOStatus', (status) => { /* Handle GPIO/SFO status */ });
client.on('onReplyInputLevelStatus', (status) => { /* Handle input levels */ });
client.on('onReplyOutputLevelStatus', (status) => { /* Handle output levels */ });
```

## Advanced Usage

### Custom Request Building

```typescript
// Build complex crosspoint actions
const request = new RequestCrosspointActions([]);
request.addCrosspoint({ input: 3, output: 5, action: 'connect' });
request.addCrosspoint({ input: 4, output: 6, action: 'connect' });

// Check before sending
console.log(request.getCrosspointSummary());
console.log(`Payload size: ${request.getPayloadSize()} bytes`);

client.addToQueue(request);
```

### Status Analysis

```typescript
client.on('onReplyInputLevelStatus', (status) => {
    // Get comprehensive statistics
    const stats = ReplyInputLevelStatus.getLevelStats(status);
    
    // Find problematic levels
    const problems = ReplyInputLevelStatus.getProblematicPorts(status);
    
    // Display formatted table
    console.log(ReplyInputLevelStatus.formatLevelTable(status));
    
    // Compare with previous status
    if (previousStatus) {
        const changes = ReplyInputLevelStatus.compareLevels(status, previousStatus);
        console.log(`${changes.changed.length} levels changed`);
    }
});
```

### Error Handling

```typescript
try {
    const request = RequestCrosspointActions.singleCrosspoint(3, 5, 'connect');
    client.addToQueue(request);
} catch (error) {
    console.error('Invalid request parameters:', error.message);
}

// Handle connection errors
client.on('error', (error) => {
    console.error('Matrix connection error:', error);
    // Implement reconnection logic
});
```

## Protocol Support

- **HCI v1**: Basic protocol support with broadcast messages
- **HCI v2**: Full protocol support with all message types
- **Message IDs**: Supports all documented Eclipse HCI message types
- **Protocol Tags**: Automatic protocol tag handling (0xABBACEDE)
- **Schema Versions**: Protocol schema version management

## Dependencies

- Node.js 14+
- TypeScript 4+
- No external runtime dependencies

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Support

For questions and support, please refer to the Eclipse HX documentation or create an issue in the repository.