// E2E de la Ruta en la web, con varias sesiones reales.
//
// Compila la web apuntando a dos brokers MQTT locales, la sirve con las cabeceras de seguridad de
// producción (la política de contenido solo permite esos brokers) y abre Chrome con sesiones
// aisladas: la pantalla del stand, una segunda pantalla del stand y cuatro teléfonos. Recorre la ruta
// completa (alguien recarga la página, alguien llega tarde, alguien abre la ruta en otra pestaña, se
// cae un broker entero) y comprueba que todas las pantallas terminen mostrando lo mismo.
//
// Nada sale de este equipo: los brokers y el servidor web escuchan solo en 127.0.0.1.
//
// Uso:
//   npm run e2e:web                 compila y prueba
//   npm run e2e:web -- --skip-build reutiliza dist/e2e-web
//   CHROME_PATH=/ruta/a/chrome      si Chrome no está en una ubicación habitual
/* global document, window, navigator, WebSocket, setTimeout, clearTimeout, URL */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createInterface } = require('readline');

const root = path.resolve(__dirname, '..');
const BROKER_PORTS = [18883, 18884];
const WEB_PORT = 18080;
const OUT = 'dist/e2e-web';
const BASE = `http://127.0.0.1:${WEB_PORT}`;
const ARTIFACTS = path.join(root, 'dist', 'e2e-artifacts');
const PROBE = 'soytel-csp-probe.invalid';
const QUESTIONS = 8;

process.env.EXPO_PUBLIC_MQTT_URLS = BROKER_PORTS.map((port) => `ws://127.0.0.1:${port}`).join(',');
process.env.SOYTEL_WEB_OUT = OUT;
process.env.SOYTEL_E2E = '1';
delete process.env.EXPO_PUBLIC_WEB_URL;
delete process.env.EXPO_PUBLIC_API_URL;
delete process.env.EXPO_PUBLIC_MQTT_USERNAME;
delete process.env.EXPO_PUBLIC_MQTT_PASSWORD;

const { createServer } = require('./serve-web');
const { buildCsp } = require('./csp');

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('No se encontró Chrome. Indica su ruta en CHROME_PATH.');
  return found;
}

// Broker local (proceso aparte). Devuelve cómo pedirle estadísticas y cómo apagarlo.
function startBroker(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'tests', 'support', 'mqttBroker.mjs')], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, PORT: String(port) } });
    const waiting = [];
    let ready = false;
    let exited = false;
    child.once('exit', () => {
      exited = true;
    });
    const timer = setTimeout(() => reject(new Error(`El broker local ${port} no partió`)), 15000);
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (!ready) {
        ready = true;
        clearTimeout(timer);
        resolve({
          port,
          stats: () =>
            new Promise((done) => {
              waiting.push(done);
              child.stdin.write('stats\n');
            }),
          stop: () =>
            new Promise((done) => {
              if (exited) {
                done();
                return;
              }
              child.once('exit', done);
              child.stdin.write('quit\n');
              setTimeout(() => child.kill(), 1500).unref();
            }),
        });
        return;
      }
      const next = waiting.shift();
      if (next) next(JSON.parse(line));
    });
    child.once('error', reject);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const steps = [];
const timings = [];

function log(message) {
  steps.push(message);
  console.log(`  ✓ ${message}`);
}

// Las etiquetas en versalitas llegan en mayúsculas al texto de la página: se compara sin distinguirlas.
async function waitForText(page, text, timeout = 15000) {
  try {
    await page.waitForFunction((needle) => document.body.innerText.toLowerCase().includes(needle), { timeout, polling: 50 }, text.toLowerCase());
  } catch {
    const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 700)).catch(() => '');
    throw new Error(`[${page.__name}] no apareció "${text}" en ${timeout} ms. En pantalla: ${seen}`);
  }
}

async function waitForNoText(page, text, timeout = 15000) {
  try {
    await page.waitForFunction((needle) => !document.body.innerText.toLowerCase().includes(needle), { timeout, polling: 50 }, text.toLowerCase());
  } catch {
    throw new Error(`[${page.__name}] "${text}" sigue en pantalla después de ${timeout} ms`);
  }
}

async function waitForButton(page, label, timeout = 15000) {
  const started = Date.now();
  while (!(await clickable(page, label, false))) {
    if (Date.now() - started > timeout) {
      const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 700)).catch(() => '');
      throw new Error(`[${page.__name}] no apareció el botón "${label}" en ${timeout} ms. En pantalla: ${seen}`);
    }
    await sleep(50);
  }
}

// Botón visible y habilitado cuyo texto o etiqueta contiene `label` (el último: la pantalla del frente).
// Lo busca dentro de la página y lo toca si `press`.
function clickable(page, label, press) {
  return page
    .evaluate(
      (needle, shouldPress) => {
        const usable = (element) => element.offsetParent !== null && element.getAttribute('aria-disabled') !== 'true';
        const buttons = [...document.querySelectorAll('[role="button"], [role="tab"], [role="radio"], button')].filter(usable);
        const match = buttons.reverse().find((element) => (element.getAttribute('aria-label') ?? '').includes(needle) || element.innerText.includes(needle));
        if (!match) return false;
        if (shouldPress) match.click();
        return true;
      },
      label,
      press,
    )
    .catch(() => false);
}

async function tap(page, label, timeout = 15000) {
  const started = Date.now();
  while (!(await clickable(page, label, true))) {
    if (Date.now() - started > timeout) {
      const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 700)).catch(() => '');
      throw new Error(`[${page.__name}] no se pudo tocar el botón "${label}" en ${timeout} ms. En pantalla: ${seen}`);
    }
    await sleep(50);
  }
}

// Mide cuánto tardan las pantallas en mostrar lo esperado desde una acción (incluye el dibujo).
async function measure(step, action, expectations, timeout = 15000) {
  const started = Date.now();
  await action();
  await Promise.all(expectations.map(([page, text]) => waitForText(page, text, timeout)));
  const ms = Date.now() - started;
  timings.push({ step, ms, screens: expectations.length });
  return ms;
}

const on = (pages, text) => pages.map((page) => [page, text]);

async function main() {
  const skipBuild = process.argv.includes('--skip-build') && fs.existsSync(path.join(root, OUT, 'index.html'));
  if (!skipBuild) {
    console.log('Compilando la web para el E2E…');
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build-web.js')], { cwd: root, stdio: 'inherit', env: process.env });
  }
  fs.rmSync(ARTIFACTS, { recursive: true, force: true });
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const puppeteer = (await import('puppeteer-core')).default;
  const brokers = [];
  const server = createServer(path.join(root, OUT));
  let browser = null;
  const pages = [];
  const problems = [];
  let failure = null;

  try {
    for (const port of BROKER_PORTS) brokers.push(await startBroker(port));
    await new Promise((resolve, reject) => server.once('error', reject).listen(WEB_PORT, '127.0.0.1', resolve));
    console.log(`Web en ${BASE} · brokers locales en los puertos ${BROKER_PORTS.join(' y ')}`);
    console.log(`CSP: ${buildCsp()}\n`);

    browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

    const open = async (context, name, url, viewport) => {
      const page = await context.newPage();
      page.__name = name;
      await page.setViewport(viewport);
      // Cada pestaña se comporta como si estuviera al frente (sin esto, las de fondo se duermen).
      const session = await page.createCDPSession();
      await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await page.evaluateOnNewDocument(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (event) => window.__csp.push(`${event.violatedDirective} → ${event.blockedURI}`));
        // "Copiar diagnóstico" deja el texto aquí (sin navegador visible no hay portapapeles).
        window.__clip = null;
        try {
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => void (window.__clip = text) } });
        } catch {
          // Sin portapapeles simulado, el diagnóstico simplemente no se adjunta.
        }
      });
      page.on('console', (message) => {
        const text = message.text();
        if (/Content Security Policy|Refused to/i.test(text)) problems.push(`[${name}] ${text}`);
      });
      page.on('pageerror', (error) => problems.push(`[${name}] error de página: ${error.message}`));
      await page.goto(url, { waitUntil: 'load' });
      pages.push(page);
      return page;
    };

    const phoneView = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
    const joinAs = async (alias, url) => {
      const context = await browser.createBrowserContext();
      const page = await open(context, alias, url, phoneView);
      await waitForText(page, 'Código del stand');
      // La invitación a crear cuenta se puede saltar: se juega igual.
      await tap(page, 'Ahora no, jugar sin cuenta', 10000);
      await waitForNoText(page, 'Ahora no, jugar sin cuenta');
      const input = 'input[aria-label="Tu alias"]';
      await page.waitForSelector(input, { visible: true });
      await page.focus(input);
      await page.type(input, alias);
      const typed = await page.$eval(input, (element) => element.value);
      if (typed !== alias) throw new Error(`[${alias}] el alias quedó como "${typed}"`);
      const started = Date.now();
      await tap(page, 'Unirme a la ruta');
      return { page, started };
    };

    // ——— El stand crea la ruta ———
    const standContext = await browser.createBrowserContext();
    const stand = await open(standContext, 'stand', `${BASE}/ruta/stand`, { width: 1280, height: 900 });
    await waitForText(stand, 'Conduce una ruta');
    await tap(stand, `${QUESTIONS} preguntas`);
    await tap(stand, 'Crear ruta');
    await waitForText(stand, 'Código de la ruta', 30000);
    const joinUrl = await stand.evaluate(() => {
      const prefix = 'Código QR para unirse: ';
      const label = [...document.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label')).find((value) => value && value.startsWith(prefix));
      return label ? label.slice(prefix.length) : null;
    });
    if (!joinUrl || !joinUrl.startsWith(`${BASE}/ruta?codigo=`)) throw new Error(`El QR del stand no apunta a este sitio: ${joinUrl}`);
    const code = new URL(joinUrl).searchParams.get('codigo');
    if (!new URL(joinUrl).searchParams.get('k')) throw new Error('El QR del stand no trae la huella de verificación');
    await waitForText(stand, 'En línea · 2/2', 20000);
    log(`El stand creó la ruta ${code} y quedó en línea en los dos brokers`);

    // ——— Tres teléfonos se unen: dos con el enlace del QR y uno con el código (sin huella) ———
    const phones = [];
    for (const alias of ['Ana', 'Beto', 'Caro']) {
      const typed = alias === 'Caro';
      const { page, started } = await joinAs(alias, typed ? `${BASE}/ruta?codigo=${code}` : joinUrl);
      await waitForText(page, `¡Estás dentro, ${alias}!`, 25000);
      const ms = Date.now() - started;
      timings.push({ step: `unirse (${alias})`, ms, screens: 1, kind: 'join' });
      log(`${alias} se unió ${typed ? 'solo con el código' : 'con el enlace del QR'} en ${ms} ms`);
      phones.push(page);
    }
    await waitForButton(stand, 'Iniciar ruta (3)');
    const verification = await stand.evaluate(() => {
      const prefix = 'Código de verificación: ';
      const label = [...document.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label')).find((value) => value && value.startsWith(prefix));
      return label ? label.slice(prefix.length).replace(/\s+/g, '') : null;
    });
    if (!verification) throw new Error('El stand no muestra su código de verificación');
    for (const page of phones) await waitForText(page, verification);
    log(`Los tres teléfonos muestran la misma verificación del stand (${verification})`);

    // ——— Segunda pantalla del stand (mismo equipo): solo lectura, en vivo ———
    const second = await open(standContext, 'stand-2', `${BASE}/ruta/stand?codigo=${code}`, { width: 1100, height: 800 });
    await waitForText(second, 'Solo lectura', 25000);
    await waitForText(second, 'Esperando participantes');
    if (await clickable(second, 'Iniciar ruta', false)) throw new Error('La segunda pantalla del stand ofrece conducir la ruta');
    log('Una segunda pantalla del stand abre la misma ruta en solo lectura');

    // ——— Parada 1: sala B215 ———
    let ms = await measure('iniciar la ruta', () => tap(stand, 'Iniciar ruta (3)'), [...on(phones, 'Vayan a la sala B215'), [second, 'Rumbo a la sala B215']]);
    log(`Inicio de la ruta visto en los 3 teléfonos y la segunda pantalla en ${ms} ms`);

    await Promise.all(phones.map((page) => waitForButton(page, 'Estoy en la sala B215')));
    ms = await measure('llegada a B215', () => Promise.all(phones.map((page) => tap(page, 'Estoy en la sala B215'))), [...on(phones, 'Operación Red B215 comienza en'), [stand, 'Operación Red B215 en curso'], [second, 'Operación Red B215 en curso']]);
    log(`Los tres confirman su llegada y parte la cuenta regresiva en todas las pantallas en ${ms} ms`);

    // El juego parte en cada teléfono al terminar la cuenta regresiva.
    await Promise.all(phones.map((page) => waitForNoText(page, 'Operación Red B215 comienza en', 20000)));
    await sleep(1500);
    ms = await measure('cerrar el juego de B215', () => tap(stand, 'Cerrar el juego ahora'), [...on(phones, '¡La red quedó operativa!'), [second, 'Resultados de B215']], 20000);
    log(`El stand cierra el juego: cada teléfono entrega lo logrado y ve los resultados en ${ms} ms`);

    // ——— Parada 2: sala B213 ———
    ms = await measure('avanzar a B213', () => tap(stand, 'Ir a B213 ahora'), [...on(phones, 'Avancen a la sala B213'), [second, 'Rumbo a la sala B213']]);
    log(`Rumbo a B213 en todas las pantallas en ${ms} ms`);
    await Promise.all(phones.map((page) => waitForButton(page, 'Estoy en la sala B213')));
    ms = await measure('llegada a B213', () => Promise.all(phones.map((page) => tap(page, 'Estoy en la sala B213'))), [...on(phones, 'Enciende los 5 pilares'), [stand, 'Proyectos de la sala B213'], [second, 'Proyectos de la sala B213']]);
    log(`Se abren los proyectos de B213 en todas las pantallas en ${ms} ms`);

    // ——— Un teléfono recarga la página a mitad de la ruta y recupera su lugar ———
    const beto = phones[1];
    let started = Date.now();
    await beto.reload({ waitUntil: 'load' });
    await waitForText(beto, 'Enciende los 5 pilares', 25000);
    timings.push({ step: 'recargar la página y recuperar el lugar', ms: Date.now() - started, screens: 1, kind: 'recovery' });
    log(`Beto recarga la página y vuelve a su lugar en ${Date.now() - started} ms`);

    // ——— Alguien llega tarde y entra con la ruta ya en curso ———
    const late = await joinAs('Dani', joinUrl);
    await waitForText(late.page, 'Enciende los 5 pilares', 25000);
    timings.push({ step: 'unirse con la ruta en curso (Dani)', ms: Date.now() - late.started, screens: 1, kind: 'join' });
    phones.push(late.page);
    await waitForText(stand, 'Dani');
    await waitForText(second, 'Dani');
    log(`Dani llega tarde y entra directo a la parada en curso en ${Date.now() - late.started} ms`);

    // ——— Ana abre la ruta en otra pestaña del mismo navegador (escaneó el QR otra vez) ———
    const ana = phones[0];
    started = Date.now();
    const anaTab = await open(ana.browserContext(), 'Ana-pestaña-2', joinUrl, phoneView);
    await waitForText(anaTab, 'Tienes una ruta en curso', 25000);
    await tap(anaTab, 'Volver a la ruta');
    await waitForText(anaTab, 'Enciende los 5 pilares', 25000);
    await waitForText(ana, 'La ruta sigue en otra pestaña', 10000);
    log(`Ana abre la ruta en otra pestaña: sigue jugando ahí (${Date.now() - started} ms) y la anterior avisa que quedó desconectada`);
    await sleep(1500);
    if (!(await clickable(stand, 'Quitar a Ana', false))) throw new Error('El stand dejó de mostrar a Ana');
    started = Date.now();
    await tap(ana, 'Seguir en esta pestaña');
    await waitForText(ana, 'Enciende los 5 pilares', 25000);
    await waitForText(anaTab, 'La ruta sigue en otra pestaña', 10000);
    timings.push({ step: 'retomar la ruta en la pestaña anterior', ms: Date.now() - started, screens: 1, kind: 'recovery' });
    log(`Ana vuelve a la primera pestaña y sigue ahí en ${Date.now() - started} ms; la otra queda desconectada`);
    await anaTab.close();
    pages.splice(pages.indexOf(anaTab), 1);

    // ——— Se cae un broker completo a mitad de la ruta ———
    // Se apaga el que tiene más teléfonos conectados (cada teléfono usa uno; las pantallas del stand, los dos).
    const counts = [];
    for (const broker of brokers) counts.push((await broker.stats()).clients);
    const victim = counts[0] >= counts[1] ? 0 : 1;
    const moved = Math.max(0, counts[victim] - 2);
    await brokers[victim].stop();
    await waitForText(stand, 'En línea · 1/2', 25000);
    ms = await measure('avanzar al pasillo con un broker caído', () => tap(stand, 'Pasar al pasillo ahora'), [...on(phones, 'Salgan al pasillo'), [second, 'Rumbo al pasillo']], 45000);
    timings[timings.length - 1].kind = 'failover';
    log(`Se apaga el broker ${BROKER_PORTS[victim]} (${moved} de 4 teléfonos estaban en él): todos siguen por el otro y ven el avance en ${ms} ms`);

    // El broker vuelve: el stand lo recupera solo.
    brokers[victim] = await startBroker(BROKER_PORTS[victim]);

    // ——— Parada 3: trivia en el pasillo ———
    await Promise.all(phones.map((page) => waitForButton(page, 'Estoy en el pasillo')));
    ms = await measure('llegada al pasillo', () => Promise.all(phones.map((page) => tap(page, 'Estoy en el pasillo'))), [...on(phones, `Pregunta 1 de ${QUESTIONS}`), [stand, `Pregunta 1 de ${QUESTIONS}`], [second, `Pregunta 1 de ${QUESTIONS}`]], 25000);
    log(`Parte la trivia en los 4 teléfonos y las dos pantallas del stand en ${ms} ms`);

    const shapes = ['Triángulo:', 'Rombo:', 'Círculo:', 'Cuadrado:'];
    for (let question = 1; question <= QUESTIONS; question += 1) {
      const everyone = [...phones, stand, second];
      await Promise.all(everyone.map((page) => waitForText(page, `Pregunta ${question} de ${QUESTIONS}`, 25000)));
      // Cada teléfono elige una alternativa distinta: en cada pregunta hay un acierto y tres errores.
      const choice = (index) => shapes[(index + question) % shapes.length];
      await Promise.all(phones.map((page, index) => waitForButton(page, choice(index), 25000)));
      // Con todos respondiendo, el stand revela la respuesta sin esperar el reloj.
      await measure(`responder la pregunta ${question}`, () => Promise.all(phones.map((page, index) => tap(page, choice(index)))), on(everyone, 'TOP 5'), 20000);
      await tap(stand, 'Siguiente pregunta');
    }
    const answers = timings.filter((item) => item.step.startsWith('responder'));
    log(`${QUESTIONS} preguntas: las 4 respuestas llegan al stand y la revelación aparece en las 6 pantallas (máx. ${Math.max(...answers.map((item) => item.ms))} ms)`);

    await Promise.all([...on(phones, 'Cierre de la ruta'), [stand, '¡Felicitaciones a los ganadores!'], [second, '¡Felicitaciones a los ganadores!']].map(([page, text]) => waitForText(page, text, 25000)));
    log('Podio en los 4 teléfonos y en las dos pantallas del stand');

    // ——— Todas las pantallas muestran el mismo resultado ———
    const results = [];
    for (const page of phones) {
      const text = await page.evaluate(() => document.body.innerText);
      const match = text.match(/(\d+)º lugar · ([\d.]+) pts/);
      if (!match) throw new Error(`[${page.__name}] no muestra su resultado`);
      results.push({ alias: page.__name, rank: Number(match[1]), points: match[2], value: Number(match[2].replace(/\./g, '')) });
    }
    for (const a of results) {
      for (const b of results) {
        if (a.value > b.value && a.rank >= b.rank) throw new Error(`Lugares incoherentes entre teléfonos: ${JSON.stringify(results)}`);
      }
    }
    if (!results.some((item) => item.rank === 1)) throw new Error(`Ningún teléfono quedó en primer lugar: ${JSON.stringify(results)}`);
    if (!results.some((item) => item.value > 0)) throw new Error(`Nadie sumó puntos: ${JSON.stringify(results)}`);
    for (const board of [stand, second, ...phones]) {
      const text = await board.evaluate(() => document.body.innerText);
      for (const result of results) {
        if (!text.includes(result.alias) || !text.includes(result.points)) throw new Error(`[${board.__name}] no muestra a ${result.alias} con ${result.points} pts`);
      }
    }
    results.sort((a, b) => a.rank - b.rank);
    log(`Mismo podio en las 6 pantallas: ${results.map((item) => `${item.rank}º ${item.alias} ${item.points}`).join(' · ')}`);

    // Cada teléfono guardó su resultado en su perfil (suma XP una vez).
    for (const page of phones) await waitForText(page, ' XP', 15000);
    log('Cada teléfono guardó su resultado y sumó su XP');

    await waitForText(stand, 'En línea · 2/2', 90000);
    log('El stand recuperó solo el broker que volvió (2/2)');

    // ——— La política de seguridad no bloqueó nada necesario ni deja pasar otros destinos ———
    for (const page of pages) {
      const blocked = await page.evaluate(() => window.__csp ?? []);
      blocked.forEach((item) => problems.push(`[${page.__name}] bloqueado por la política: ${item}`));
    }
    const refused = await stand.evaluate(async (host) => {
      try {
        const socket = new WebSocket(`wss://${host}/`);
        await new Promise((resolve) => {
          socket.onerror = resolve;
          socket.onopen = resolve;
          setTimeout(resolve, 1500);
        });
      } catch {
        return true;
      }
      return (window.__csp ?? []).some((item) => item.includes(host));
    }, PROBE);
    if (!refused) throw new Error('La política de seguridad permitió conectar a un servidor fuera de la lista');
    const unexpected = problems.filter((item) => !item.includes(PROBE));
    if (unexpected.length) throw new Error(`Violaciones de la política o errores de página:\n${unexpected.join('\n')}`);
    log('La política de seguridad permitió solo los brokers configurados (un destino ajeno quedó bloqueado) y no hubo errores de página');
  } catch (error) {
    failure = error;
    // Estado de la conexión de cada pantalla, tal como lo copia el botón "Copiar diagnóstico".
    for (const page of pages) {
      try {
        const isStand = page.__name.startsWith('stand');
        if (isStand) await tap(page, 'Estado de la conexión', 1500);
        else await tap(page, 'Salir de la ruta', 1500);
        await tap(page, 'Copiar diagnóstico', 1500);
        await sleep(100);
        const text = await page.evaluate(() => window.__clip);
        if (text) fs.writeFileSync(path.join(ARTIFACTS, `diagnostico-${page.__name}.json`), `${text}\n`);
      } catch {
        // Esa pantalla no ofrece el diagnóstico en este momento.
      }
    }
  } finally {
    // Una captura por pantalla, con la pestaña al frente (las de fondo no avanzan sus animaciones).
    for (const page of pages) {
      try {
        await page.bringToFront();
        await sleep(900);
        await page.screenshot({ path: path.join(ARTIFACTS, `${page.__name}.png`) });
      } catch {
        // La pantalla ya se cerró.
      }
    }
    await browser?.close().catch(() => undefined);
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    await Promise.all(brokers.map((broker) => broker.stop().catch(() => undefined)));
  }

  const live = timings.filter((item) => !item.kind).map((item) => item.ms).sort((a, b) => a - b);
  const percentile = (fraction) => (live.length ? live[Math.min(live.length - 1, Math.ceil(live.length * fraction) - 1)] : 0);
  const summary = {
    ok: !failure,
    steps,
    actionToAllScreensMs: { n: live.length, p50: percentile(0.5), p95: percentile(0.95), max: live[live.length - 1] ?? 0 },
    timings,
    error: failure ? String(failure.message ?? failure) : null,
  };
  fs.writeFileSync(path.join(ARTIFACTS, 'resultado.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nDe la acción a verla en todas las pantallas (incluye el dibujo): n=${live.length} · p50 ${summary.actionToAllScreensMs.p50} ms · p95 ${summary.actionToAllScreensMs.p95} ms · máx ${summary.actionToAllScreensMs.max} ms`);
  timings.filter((item) => item.kind).forEach((item) => console.log(`  ${item.step}: ${item.ms} ms`));
  if (failure) {
    console.error(`\n✖ E2E web falló: ${failure.message ?? failure}`);
    console.error(`Capturas en ${path.relative(root, ARTIFACTS)}`);
    process.exit(1);
  }
  console.log(`\n✔ E2E web completo (${steps.length} comprobaciones). Capturas y resultado en ${path.relative(root, ARTIFACTS)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
