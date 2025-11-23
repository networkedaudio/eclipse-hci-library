// test-eclipse.ts
// Run with: npx tsx test-eclipse.ts   (or compile and run)

import EclipseHCI from './EclipseHCI';

const hci = new EclipseHCI({
  address: '172.16.42.131',   // CHANGE TO YOUR ECLIPSE IP
  // port: 52010,             // Uncomment if you know the port
  username: 'admin',
  password: '',               // or your password
  showDebug: true,
});

hci.on('statechange', state => {
  console.log(`\n=== State → ${state.toUpperCase()} ===`);
});

hci.on('authenticated', token => {
  console.log(`\nSUCCESS! Session Token: 0x${token.toString(16).padStart(8, '0')}\n`);
  runTestCommands();
});

hci.on('response:0010', payload => {
  console.log('Key status update:', payload.toString('utf8'));
});

hci.on('response:8001', () => { /* login ack already handled */ });

function runTestCommands() {
  console.log('Sending test commands...\n');

  hci.sendText('GET SYSTEM INFO');
  hci.sendText('GET LABEL 101');
  hci.sendText('SET LABEL 999 "StreamDeck Test"');
  hci.sendText('ACTIVATE KEY 201');
  setTimeout(() => hci.sendText('DEACTIVATE KEY 201'), 2000);

  // Spam test
  for (let i = 1; i <= 20; i++) {
    setTimeout(() => {
      hci.sendText(`SET LABEL 500 "Button ${i}"`);
    }, i * 100);
  }

  console.log('All commands queued!');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  hci.disconnect();
  setTimeout(() => process.exit(0), 1000);
});