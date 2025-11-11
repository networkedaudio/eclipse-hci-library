import RequestCrosspointLevelStatus from '../src/Requests/RequestCrosspointLevelStatus';
import RequestCrosspointLevelActions from '../src/Requests/RequestCrosspointLevelActions';
import EclipseHCI from '../src/EclipseHCI';
import LevelConversion from '../src/Utilities/LevelConversion';

// Constants for the test
const TEST_DESTINATION_PORT = 3;
const TEST_SOURCE_PORT = 4;
const TEST_LEVEL_DB = -6; // New level to set (in dB)

// Test crosspoint level - get current, change it, verify change, restore original
async function testCrosspointLevel() {
    console.log('=== Crosspoint Level Test ===');

    // Create Eclipse HCI client connection
    const client = new EclipseHCI('192.168.1.106');

    let originalLevel: number | null = null;
    let testComplete = false;

    try {
        // Wait for connection (EclipseHCI connects automatically)
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Connected to Eclipse HCI\n');

        // Step 1: Get current level
        console.log(`Step 1: Getting current level for port ${TEST_SOURCE_PORT} → ${TEST_DESTINATION_PORT}`);
        const initialStatusRequest = new RequestCrosspointLevelStatus([TEST_DESTINATION_PORT]);

        console.log('Initial Status Request:');
        console.log('Request ID:', `0x${initialStatusRequest.RequestID.toString(16).toUpperCase()}`);
        console.log('Port Count:', initialStatusRequest.getPortCount());
        console.log('Ports Description:', initialStatusRequest.getPortsDescription());
        console.log('Data (hex):', initialStatusRequest.toHexString());

        client.addToQueue(initialStatusRequest);
        console.log('Initial STATUS request added to queue\n');

        // Listen for initial level status response
        client.on('onReplyCrosspointLevelStatus', async (levelStatus) => {
            console.log('Received crosspoint level status reply (JSON):');
            console.log(JSON.stringify(levelStatus, null, 2));

            if (!testComplete) {
                // Find the level for our specific source/destination pair
                const currentLevel = levelStatus.levelData.find(
                    (level: any) => level.sourcePort === TEST_SOURCE_PORT && level.destinationPort === TEST_DESTINATION_PORT
                );

                if (currentLevel && originalLevel === null) {
                    // Step 1 complete - store original level
                    originalLevel = currentLevel.levelValue;
                    if (originalLevel === undefined || originalLevel === null) {
                        originalLevel = 0;
                    }
                    const originalDB = LevelConversion.levelToDB(originalLevel);
                    console.log(`\n✓ Current level: ${originalLevel} (${LevelConversion.formatDB(originalDB)})`);

                    // Step 2: Change the level
                    const newLevelValue = LevelConversion.dBToLevel(TEST_LEVEL_DB);
                    console.log(`\nStep 2: Changing level to ${LevelConversion.formatDB(TEST_LEVEL_DB)} (Level ${newLevelValue})`);

                    const levelAction = RequestCrosspointLevelActions.singleActionDB(
                        TEST_DESTINATION_PORT,
                        TEST_SOURCE_PORT,
                        TEST_LEVEL_DB
                    );

                    console.log('Level Change Request:');
                    console.log('Request ID:', `0x${levelAction.RequestID.toString(16).toUpperCase()}`);
                    console.log('Action Count:', levelAction.getActionCount());
                    console.log('Actions Description:');
                    console.log(levelAction.getActionsDescription());
                    console.log('Data (hex):', levelAction.toHexString());

                    client.addToQueue(levelAction);
                    console.log('LEVEL ACTION request added to queue\n');

                    // Wait a bit for the action to complete, then check the new level
                    setTimeout(async () => {
                        console.log('Step 3: Verifying level change');
                        const verifyStatusRequest = new RequestCrosspointLevelStatus([TEST_DESTINATION_PORT]);
                        client.addToQueue(verifyStatusRequest);
                        console.log('Verification STATUS request added to queue\n');
                    }, 2000);

                } else if (currentLevel && originalLevel !== null) {
                    // Step 3 complete - verify the change
                    const currentLevelValue = currentLevel.levelValue;
                    const expectedLevelValue = LevelConversion.dBToLevel(TEST_LEVEL_DB);

                    if (currentLevelValue === expectedLevelValue) {
                        console.log(`\n✓ Level change verified: ${currentLevelValue} (${LevelConversion.formatDB(TEST_LEVEL_DB)})`);

                        // Step 4: Restore original level
                        const originalDB = LevelConversion.levelToDB(originalLevel);
                        console.log(`\nStep 4: Restoring original level: ${originalLevel} (${LevelConversion.formatDB(originalDB)})`);

                        const restoreAction = new RequestCrosspointLevelActions([{
                            destinationPort: TEST_DESTINATION_PORT,
                            sourcePort: TEST_SOURCE_PORT,
                            levelValue: originalLevel
                        }]);

                        console.log('Restore Level Request:');
                        console.log('Request ID:', `0x${restoreAction.RequestID.toString(16).toUpperCase()}`);
                        console.log('Actions Description:');
                        console.log(restoreAction.getActionsDescription());

                        client.addToQueue(restoreAction);
                        console.log('RESTORE ACTION request added to queue\n');

                        // Wait a bit, then do final verification
                        setTimeout(async () => {
                            console.log('Step 5: Final verification');
                            const finalStatusRequest = new RequestCrosspointLevelStatus([TEST_DESTINATION_PORT]);
                            client.addToQueue(finalStatusRequest);
                            console.log('Final STATUS request added to queue\n');

                            // Mark test as complete after this verification
                            setTimeout(() => {
                                testComplete = true;
                            }, 1000);
                        }, 2000);

                    } else {
                        console.log(`\n✗ Level change failed: expected ${expectedLevelValue}, got ${currentLevelValue}`);
                        testComplete = true;
                    }

                } else if (testComplete) {
                    // Step 5 complete - final verification
                    const finalLevelValue = currentLevel ? currentLevel.levelValue : null;
                    if (finalLevelValue === originalLevel) {
                        console.log(`\n✓ Original level restored: ${originalLevel} (${LevelConversion.formatDB(LevelConversion.levelToDB(originalLevel))})`);
                        console.log('\n🎉 Test completed successfully!');
                    } else {
                        console.log(`\n✗ Failed to restore original level: expected ${originalLevel}, got ${finalLevelValue}`);
                    }
                } else {
                    console.log(`\n✗ Could not find level data for source port ${TEST_SOURCE_PORT} → destination port ${TEST_DESTINATION_PORT}`);
                    console.log('Available level data:');
                    levelStatus.levelData.forEach((level: any, index: number) => {
                        console.log(`  ${index + 1}. Port ${level.sourcePort} → ${level.destinationPort}: Level ${level.levelValue}`);
                    });
                }
            }
        });

        // Wait for test to complete
        console.log('Waiting for test to complete...');
        await new Promise(resolve => {
            const checkComplete = () => {
                if (testComplete) {
                    resolve(void 0);
                } else {
                    setTimeout(checkComplete, 1000);
                }
            };
            checkComplete();
        });

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
testCrosspointLevel();