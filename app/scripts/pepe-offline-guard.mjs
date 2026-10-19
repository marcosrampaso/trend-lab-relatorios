// Test-process-only guard. No Wi-Fi settings or live collectors are changed.
import net from 'node:net';import http from 'node:http';import https from 'node:https';import dns from 'node:dns';
const deny=()=>{throw Error('External networking disabled for offline training check');};
net.Socket.prototype.connect=deny;net.connect=deny;net.createConnection=deny;http.request=deny;http.get=deny;https.request=deny;https.get=deny;dns.lookup=deny;dns.resolve=deny;globalThis.fetch=deny;
