import EclipseHCI from '../src/EclipseHCI';

async function testConnection() {
    console.log('Testing connection to 192.168.1.106...');
    
    const eclipse = new EclipseHCI('192.168.1.106');
    
    try {

        console.log(`Connection status: ${eclipse.getStatus()}`);
        console.log(`Connected on port: ${eclipse.getConnectedPort()}`);
        
        // Wait a bit to see if we receive any messages
        console.log('Waiting 10 seconds for incoming messages...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log(`Final status: ${eclipse.getStatus()}`);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Connection failed: ${errorMessage}`);
    } finally {
        eclipse.disconnect();
    }
}

testConnection();