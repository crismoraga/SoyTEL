// Postgres de verdad para las pruebas: PGlite (el motor de Postgres compilado a WebAssembly), en
// memoria y en su propio proceso. No es un simulador de SQL: restricciones, disparadores, funciones,
// transacciones y `update … returning` se comportan como en el servidor.
//
// Recibe órdenes por la entrada estándar (una por línea, JSON) y responde igual por la salida:
//   {id, op: 'query', text, params}        → {id, rows}
//   {id, op: 'transaction', statements}    → {id, rows: []}   (todo o nada)
//   {id, op: 'reset'}                      → {id, rows: []}   (base vacía)
//   {id, op: 'quit'}
// Un error responde {id, error: {message, code}}.
import { createInterface } from 'node:readline';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.waitReady;

function plain(value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

function reply(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

// Las órdenes se atienden de a una, en el orden en que llegan.
let queue = Promise.resolve();

createInterface({ input: process.stdin }).on('line', (line) => {
  let command;
  try {
    command = JSON.parse(line);
  } catch {
    return;
  }
  queue = queue.then(async () => {
    try {
      if (command.op === 'quit') {
        await db.close();
        process.exit(0);
      }
      if (command.op === 'reset') {
        await db.exec('drop schema public cascade; create schema public;');
        reply({ id: command.id, rows: [] });
        return;
      }
      if (command.op === 'transaction') {
        await db.transaction(async (tx) => {
          for (const statement of command.statements) await tx.query(statement);
        });
        reply({ id: command.id, rows: [] });
        return;
      }
      const result = await db.query(command.text, command.params ?? []);
      reply({ id: command.id, rows: plain(result.rows) });
    } catch (error) {
      reply({ id: command.id, error: { message: String(error?.message ?? error), code: error?.code ?? null } });
    }
  });
});

process.stdin.on('end', () => process.exit(0));
reply({ ready: true });
