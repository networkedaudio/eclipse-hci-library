import RequestCPUReset, { ResetType } from '../src/Requests/RequestCPUReset';
import EclipseHCI from '../src/EclipseHCI';

// Test CPU reset - send a red CPU reset command
async function testCPUReset() {
    console.log('=== CPU Reset Test ===');

    // Create Eclipse HCI client connection
    const client = new EclipseHCI('192.168.1.106');

    try {
        // Wait for connection (EclipseHCI connects automatically)
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Connected to Eclipse HCI\n');

        // Create a red CPU reset request
        const resetRequest = RequestCPUReset.redCPUReset();

        // Add request to Eclipse queue
        client.addToQueue(resetRequest);
        console.log('🔴 RED CPU RESET request added to queue');
        console.log('⚠️  WARNING: This will reset the Eclipse matrix!');
        console.log('');

        // Wait a bit to allow the request to be sent
        console.log('Waiting for request to be processed...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('✓ CPU reset request has been sent to the matrix');
        console.log('Note: The matrix may take some time to complete the reset operation');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Close the connection
        client.disconnect();
        console.log('\nConnection closed');
        console.log('=== Test Complete ===');
    }
}

// Run the test
testCPUReset();