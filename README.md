# Eclipse HCI Library

A TypeScript library for communicating with Eclipse HCI (Host Control Interface) systems.

## Features

- **HCI v1 and v2 Support**: Full support for both HCI protocol versions
- **Conference Management**: Request and manage conference status and actions
- **Crosspoint Control**: Handle crosspoint connections and status
- **Type Safety**: Full TypeScript definitions for all messages and responses
- **Event-Driven**: EventEmitter-based architecture for real-time communication
- **Queue Management**: Automatic message queuing with priority handling

## Installation

```bash
npm install
```

## Quick Start

```typescript
import EclipseHCI from './src/EclipseHCI';
import RequestConferenceStatus from './src/Requests/RequestConferenceStatus';

// Connect to Eclipse HCI
const eclipse = new EclipseHCI('192.168.1.106', 100);

// Listen for events
eclipse.on('connect', () => {
    console.log('Connected to Eclipse HCI');
});

eclipse.on('conferenceStatus', (data) => {
    console.log('Conference status received:', data);
});

// Request conference status
const request = new RequestConferenceStatus(6);
eclipse.addToQueue(request);
```

## Message Types

### Requests
- `RequestConferenceStatus` - Get status of a specific conference
- `RequestConferenceActions` - Add/remove conference members
- `RequestCrosspointStatus` - Get crosspoint status for ports
- `RequestCrosspointActions` - Create/delete crosspoint connections

### Responses
- `ReplyConferenceStatus` - Conference status information
- `ReplyCrosspointStatus` - Crosspoint connection information

## API Documentation

### EclipseHCI Class

Main class for HCI communication.

#### Constructor
```typescript
new EclipseHCI(host: string, rateLimit?: number)
```

#### Events
- `connect` - Connected to HCI system
- `disconnect` - Disconnected from HCI system
- `broadcastMessage` - Received broadcast message
- `conferenceStatus` - Received conference status reply
- `crosspointStatus` - Received crosspoint status reply

### Request Classes

All request classes extend `HCIRequest` and include:
- Proper message formatting
- Payload validation
- Helper methods for common operations

## Development

```bash
# Run TypeScript directly
npm run dev

# Build the project
npm run build

# Run tests
npm run test
```

## Testing

```bash
# Test conference status requests
npm run test

# Test crosspoint status (when available)
npm run test:crosspoint
```

## Protocol Support

- **HCI v1**: Basic message structure
- **HCI v2**: Enhanced with protocol tags and versioning
- **Message IDs**: 13, 17, 19, 20 (crosspoint/conference operations)
- **Flags**: Automatic G-bit setting (bit 3)

## License

MIT

## Author

Erik Devane