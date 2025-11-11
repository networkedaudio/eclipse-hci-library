import RequestCrosspointActions from '../src/Requests/RequestCrosspointActions';
import EclipseHCI from '../src/EclipseHCI'; // Import the Eclipse HCI class

// Test crosspoint action with port 2 as source, port 3 as destination
async function testCrosspointAction() {
    console.log('=== Crosspoint Action Test ===');

    // Create Eclipse HCI client connection
    const client = new EclipseHCI('192.168.1.106');

    try {
        // Wait for connection (EclipseHCI connects automatically)
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Connected to Eclipse HCI\n');

        // Create RequestCrosspointActions instance
        const addRequest = new RequestCrosspointActions();

        // Add crosspoint: port 2 as source, port 8 as destination
        addRequest.addCrosspoint(2, 8, true, 1);

        console.log('Adding crosspoint connection:');
        console.log('Source Port: 2');
        console.log('Destination Port: 8');
        console.log('Request ID:', `0x${addRequest.RequestID.toString(16).toUpperCase()}`);
        console.log('Data (hex):', addRequest.toHexString());

        // Add request to Eclipse queue
        client.addToQueue(addRequest);
        console.log('ADD request added to queue\n');

        // Wait 5 seconds
        console.log('Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Create remove request
        const removeRequest = new RequestCrosspointActions();
        removeRequest.removeCrosspoint(2, 8, 1);

        console.log('Removing crosspoint connection:');
        console.log('Source Port: 2');
        console.log('Destination Port: 8');
        console.log('Data (hex):', removeRequest.toHexString());

        // Add remove request to Eclipse queue
        client.addToQueue(removeRequest);
        console.log('REMOVE request added to queue\n');

        // Wait a bit before closing
        await new Promise(resolve => setTimeout(resolve, 1000));

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
testCrosspointAction();