const WebSocket = require('ws');

let wss;
let clients = [];

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });
  
  wss.on('connection', ws => {
    console.log('🖥️  Operador conectado (WebSocket)');
    clients.push(ws);
    
    ws.on('close', () => { 
      clients = clients.filter(c => c !== ws); 
    });
  });
}

function broadcast(data) {
  clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify(data));
    }
  });
}

module.exports = { initWebSocket, broadcast };
