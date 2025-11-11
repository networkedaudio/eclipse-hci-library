import EclipseHCI from '../src/EclipseHCI';
import RequestConferenceStatus from '../src/Requests/RequestConferenceStatus';

// Create Eclipse HCI connection
const eclipse = new EclipseHCI('192.168.1.106', 100); // 100ms rate limit

// Listen for connection events
eclipse.on('connect', () => {
    console.log('Connected to Eclipse HCI');
});

eclipse.on('disconnect', () => {
    console.log('Disconnected from Eclipse HCI');
});

// Listen for broadcast messages
eclipse.on('broadcastMessage', (data) => {
    console.log('Received broadcast message:');
    console.log(`Class: ${data.class.name} (${data.class.value})`);
    console.log(`Code: ${data.code.hex} (${data.code.value})`);
    console.log(`Text: "${data.text}"`);
    console.log('---');
});

// Wait a moment for connection, then send conference status request
setTimeout(() => {
    if (eclipse.getStatus() === 'Connected') {
        console.log('Sending conference status request for conference 6...');
        
        // Create request for conference number 6
        const conferenceRequest = new RequestConferenceStatus(6);
        
        // Display request details
        console.log(conferenceRequest.toString());
        console.log('Conference info:', conferenceRequest.getConferenceInfo());
        console.log('Payload size:', conferenceRequest.getPayloadSize(), 'bytes');
        
        // Get the complete message and display it
        const completeMessage = conferenceRequest.getRequest(0x00); // No flags
        console.log('Complete message hex:', completeMessage.toString('hex'));
        console.log('Complete message length:', completeMessage.length, 'bytes');
        
        // Add to queue for sending
        eclipse.addToQueue(conferenceRequest);
        
        console.log('Queue status:', eclipse.getQueueStatus());
        
    } else {
        console.log('Not connected - cannot send request');
    }
}, 2000); // Wait 2 seconds for connection

// Keep the process running
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    eclipse.disconnect();
    process.exit(0);
});

console.log('Starting Eclipse HCI test for conference status request...');
console.log('Press Ctrl+C to exit');