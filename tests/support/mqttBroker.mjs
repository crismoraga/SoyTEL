// Broker MQTT local para pruebas: Aedes escuchando WebSocket en 127.0.0.1 (nunca sale de este equipo).
// Corre como proceso aparte; lo usan la prueba de integración (tests/route-mqtt-local.test.ts) y el
// E2E web (scripts/e2e-web.js).
//
// Al partir imprime una línea JSON con el puerto. Acepta órdenes por la entrada estándar, una por línea:
//   drop <prefijo>   corta las conexiones de los clientes cuyo id empieza con ese prefijo
//   stats            imprime {"published": n, "clients": n}
//   quit             termina
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { Aedes } from 'aedes';
import { createWebSocketStream, WebSocketServer } from 'ws';

const broker = await Aedes.createBroker();
const server = createServer();
const sockets = new WebSocketServer({ server });
sockets.on('connection', (socket) => broker.handle(createWebSocketStream(socket)));

let published = 0;
broker.on('publish', (packet) => {
  if (packet.topic.startsWith('soytel/')) published += 1;
});

function shutdown() {
  sockets.close();
  server.close();
  broker.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

createInterface({ input: process.stdin }).on('line', (line) => {
  const [command, argument = ''] = line.trim().split(/\s+/);
  if (command === 'drop') {
    Object.entries(broker.clients).forEach(([id, client]) => {
      if (id.startsWith(argument)) client.close();
    });
  } else if (command === 'stats') {
    console.log(JSON.stringify({ published, clients: Object.keys(broker.clients).length }));
  } else if (command === 'quit') {
    shutdown();
  }
});
process.stdin.on('end', shutdown);

server.listen(Number(process.env.PORT ?? 0), '127.0.0.1', () => {
  console.log(JSON.stringify({ port: server.address().port }));
});
