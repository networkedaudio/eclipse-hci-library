import RequestCrosspointStatus from '../src/Requests/RequestCrosspointStatus';
import EclipseHCI from '../src/EclipseHCI';

// Constants for port numbers
const QUERIED_PORT = 3;

// Test crosspoint status to check if crosspoint 3 is connected to crosspoint 4
async function testCrosspointStatus() {
    console.log('=== Crosspoint Status Test ===');

    // Create Eclipse HCI client connection
    const client = new EclipseHCI('192.168.1.106');

    try {
        // Wait for connection (EclipseHCI connects automatically)
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Connected to Eclipse HCI\n');

        const statusRequest = new RequestCrosspointStatus([QUERIED_PORT]);

        console.log('Requesting crosspoint status for:');
        console.log('Source Port: ${SOURCE_PORT}');
        console.log('Destination Port: ${DESTINATION_PORT}');
        console.log('Port Count:', statusRequest.getPortCount());
        console.log('Ports Description:', statusRequest.getPortsDescription());
        console.log('Data (hex):', statusRequest.toHexString());

        // Add request to Eclipse queue
        client.addToQueue(statusRequest);
        console.log('STATUS request added to queue\n');

        // Listen for crosspoint status response
        client.on('onReplyCrosspointStatus', (crosspointStatus) => {
            console.log('Received crosspoint status reply (JSON):');
            console.log(JSON.stringify(crosspointStatus, null, 2));
        });

        // Wait for response
        console.log('Waiting for status response...');
        await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Close the connection
        client.disconnect();
        console.log('Connection closed');
        console.log('=== Test Complete ===');
    }
}

// Run the test
testCrosspointStatus();