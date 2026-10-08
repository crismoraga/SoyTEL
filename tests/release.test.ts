/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

// Herramientas de compilación y publicación (REL-01, 02, 04, 08, 09, 10, 11, 15 y 17).
// Son scripts de Node (CommonJS): se prueban sus funciones, sin compilar ni publicar nada.

const root = path.resolve(__dirname, '..');
const signing = require('../plugins/withAndroidReleaseSigning') as { addSigning(gradle: string): string; SIGNING_KEYS: string[] };
const android = require('../scripts/build-android') as {
  parseArchitectures(raw: unknown): string[];
  parseCertificate(output: string): { dn: string; sha256: string } | null;
  certificateProblem(certificate: { dn: string; sha256: string } | null, options: { debugSigning: boolean; expectedSha256?: string }): string | null;
  gradleArguments(architectures: string[], debugSigning: boolean): string[];
  toolCommand(directory: string, name: string, args: string[], platform?: string): { file: string; args: string[] };
};
const publicConfig = require('../scripts/public-config') as {
  buildEnv(env?: Record<string, string | undefined>): Record<string, string | undefined>;
  publicConfigProblem(env: Record<string, string | undefined>): string | null;
  findLeakedSecrets(directory: string, env: Record<string, string | undefined>): { secret: string; file: string }[];
  describePublicConfig(env: Record<string, string | undefined>): { brokers: string[]; mqttCredentials: boolean };
};
const csp = require('../scripts/csp') as { buildCsp(env?: Record<string, string | undefined>): string; readVercelCsp(): string | null };
const budget = require('../scripts/web-budget') as {
  BUDGET: { scriptGzipBytes: number; fontBytes: number };
  budgetProblems(measured: { scriptGzipBytes: number; fontBytes: number; fonts: string[] }): string[];
};
const deploy = require('../scripts/deploy-web') as { planProblem(argv: string[], state: { dirty: boolean }): string | null };

const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('REL-01 · firma de Android', () => {
  const template = read('tests/fixtures/android-app-build.sdk57.gradle');

  it('sobre la plantilla de Expo SDK 57 deja el build de release protegido', () => {
    const output = signing.addSigning(template);
    // Las cuatro propiedades se exigen juntas, y una vacía cuenta como ausente.
    signing.SIGNING_KEYS.forEach((key) => expect(output).toContain(`'${key}'`));
    expect(signing.SIGNING_KEYS).toHaveLength(4);
    expect(output).toContain("project.property(it).toString().trim().isEmpty()");
    // Sin la llave completa un build de release se detiene, salvo permiso explícito.
    expect(output).toMatch(/throw new GradleException\("SoyTEL: la firma de release esta incompleta/);
    expect(output).toContain("project.findProperty('soytelAllowDebugSigning')");
    // La firma de release ya no depende de una sola propiedad ni cae en silencio a la de depuración.
    expect(output).toContain('signingConfig soytelMissingKeys.isEmpty() ? signingConfigs.release : signingConfigs.debug');
    expect(output).not.toContain("project.hasProperty('SOYTEL_UPLOAD_STORE_FILE') ? signingConfigs.release");
    // El build de depuración queda como estaba.
    expect(output).toMatch(/debug \{\s+signingConfig signingConfigs\.debug/);
    // Aplicarlo dos veces no duplica nada.
    expect(signing.addSigning(output)).toBe(output);
  });

  it('si la plantilla de Gradle cambia, falla en vez de dejar pasar un build sin protección', () => {
    expect(() => signing.addSigning(template.replace('signingConfigs {', 'firmas {'))).toThrow(/plantilla de Gradle cambió/);
    expect(() => signing.addSigning(template.replace(/^android \{/m, 'androide {'))).toThrow(/plantilla de Gradle cambió/);
    expect(() => signing.addSigning(template.replace(/(release \{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig otraCosa'))).toThrow(/plantilla de Gradle cambió/);
  });

  it('el APK solo se entrega con el certificado que corresponde', () => {
    const release = android.parseCertificate('Signer #1 certificate DN: CN=SoyTEL, O=USM\nSigner #1 certificate SHA-256 digest: AB12cd34\nSigner #1 certificate SHA-1 digest: ff')!;
    const debug = android.parseCertificate('Signer #1 certificate DN: C=US, O=Android, CN=Android Debug\nSigner #1 certificate SHA-256 digest: 0f0f')!;
    expect(release).toEqual({ dn: 'CN=SoyTEL, O=USM', sha256: 'ab12cd34' });
    expect(android.parseCertificate('salida inesperada')).toBeNull();
    expect(android.certificateProblem(release, { debugSigning: false })).toBeNull();
    expect(android.certificateProblem(debug, { debugSigning: false })).toMatch(/llave de depuración/);
    expect(android.certificateProblem(null, { debugSigning: false })).toMatch(/No se pudo leer/);
    // Con la huella esperada definida, tiene que calzar (con o sin dos puntos, mayúsculas o minúsculas).
    expect(android.certificateProblem(release, { debugSigning: false, expectedSha256: 'AB:12:CD:34' })).toBeNull();
    expect(android.certificateProblem(release, { debugSigning: false, expectedSha256: 'ffff' })).toMatch(/no es el esperado/);
    // Un APK de prueba es el único que puede llevar la llave de depuración.
    expect(android.certificateProblem(debug, { debugSigning: true })).toBeNull();
    expect(android.certificateProblem(release, { debugSigning: true })).toMatch(/APK de prueba/);
  });
});

describe('REL-17 · arquitecturas de Android', () => {
  it('acepta solo arquitecturas conocidas', () => {
    expect(android.parseArchitectures('arm64-v8a,armeabi-v7a')).toEqual(['arm64-v8a', 'armeabi-v7a']);
    expect(android.parseArchitectures(' x86_64 , x86 , x86_64 ')).toEqual(['x86_64', 'x86']);
  });

  it.each(['arm64-v8a; rm -rf /', 'arm64-v8a & calc', 'x86 | cat', '"arm64-v8a"', '$(whoami)', 'mips', '', ' , ', 'arm64-v8a\nx86'])('rechaza %j antes de lanzar ningún proceso', (value) => {
    expect(() => android.parseArchitectures(value)).toThrow(/ANDROID_ARCHS/);
  });

  it('las arquitecturas viajan como un solo argumento de Gradle, sin intérprete de por medio', () => {
    expect(android.gradleArguments(['arm64-v8a', 'x86_64'], false)).toEqual(['assembleRelease', '-PreactNativeArchitectures=arm64-v8a,x86_64', '--no-daemon']);
    expect(android.gradleArguments(['arm64-v8a'], true)).toContain('-PsoytelAllowDebugSigning=true');
    const script = read('scripts/build-android.js');
    expect(script).not.toMatch(/execSync\(/);
    expect(script).not.toMatch(/shell:\s*true/);
  });

  it('en Windows llama a gradlew y apksigner con ruta explícita: funciona aunque el equipo no busque programas en la carpeta actual', () => {
    expect(android.toolCommand('C:\\proyecto\\android', 'gradlew.bat', ['assembleRelease'], 'win32')).toEqual({ file: 'cmd.exe', args: ['/d', '/c', '.\\gradlew.bat', 'assembleRelease'] });
    const unix = android.toolCommand('/proyecto/android', 'gradlew', ['assembleRelease'], 'linux');
    expect(unix.args).toEqual(['assembleRelease']);
    expect(path.basename(unix.file)).toBe('gradlew');
    expect(path.isAbsolute(unix.file) || unix.file.startsWith('/')).toBe(true);
  });
});

describe('REL-04 · lo público de una compilación', () => {
  it('compilar no carga los archivos .env del proyecto (ahí quedan los secretos del servidor)', () => {
    const env = publicConfig.buildEnv({ PATH: 'x', EXPO_PUBLIC_API_URL: 'https://soytel.example' });
    expect(env).toMatchObject({ EXPO_NO_DOTENV: '1', NODE_ENV: 'production', PATH: 'x', EXPO_PUBLIC_API_URL: 'https://soytel.example' });
    for (const script of ['scripts/build-web.js', 'scripts/build-android.js']) {
      const source = read(script);
      expect(source).toMatch(/buildEnv\(\)/);
      expect(source).not.toMatch(/env:\s*\{\s*\.\.\.process\.env/);
    }
  });

  it('una credencial de broker solo entra a la app si se confirma que es de permisos mínimos', () => {
    expect(publicConfig.publicConfigProblem({})).toBeNull();
    expect(publicConfig.publicConfigProblem({ EXPO_PUBLIC_MQTT_URLS: 'wss://broker.propio.cl:443/mqtt' })).toBeNull();
    expect(publicConfig.publicConfigProblem({ EXPO_PUBLIC_MQTT_PASSWORD: 'clave' })).toMatch(/cualquiera puede leerlos/);
    expect(publicConfig.publicConfigProblem({ EXPO_PUBLIC_MQTT_USERNAME: 'usuario' })).toMatch(/cualquiera puede leerlos/);
    expect(publicConfig.publicConfigProblem({ EXPO_PUBLIC_MQTT_USERNAME: 'usuario', EXPO_PUBLIC_MQTT_PASSWORD: 'clave', SOYTEL_PUBLIC_MQTT_CREDENTIALS: 'low-privilege' })).toBeNull();
    // Un secreto del servidor copiado a una variable pública.
    expect(publicConfig.publicConfigProblem({ SOYTEL_ADMIN_KEY: 'llave-de-administracion-123', EXPO_PUBLIC_ALGO: 'llave-de-administracion-123' })).toMatch(/secreto del servidor/);
  });

  it('un secreto del servidor dentro de lo compilado se detecta por su nombre, sin mostrar su valor', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'soytel-web-'));
    try {
      const canary = 'canario-que-no-es-un-secreto-0123456789';
      fs.mkdirSync(path.join(directory, '_expo', 'static', 'js'), { recursive: true });
      fs.writeFileSync(path.join(directory, 'index.html'), '<html></html>');
      fs.writeFileSync(path.join(directory, '_expo', 'static', 'js', 'app.js'), `var a="${canary}";`);
      const env = { SOYTEL_PEPPER: canary, SOYTEL_ADMIN_KEY: 'otra-llave-que-no-aparece-000' };
      const leaks = publicConfig.findLeakedSecrets(directory, env);
      expect(leaks).toEqual([{ secret: 'SOYTEL_PEPPER', file: path.join('_expo', 'static', 'js', 'app.js') }]);
      expect(JSON.stringify(leaks)).not.toContain(canary);
      expect(publicConfig.findLeakedSecrets(directory, {})).toEqual([]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('lo que se anota de la compilación no incluye credenciales', () => {
    const described = publicConfig.describePublicConfig({ EXPO_PUBLIC_MQTT_URLS: 'wss://a.cl/mqtt, wss://b.cl/mqtt', EXPO_PUBLIC_MQTT_PASSWORD: 'clave-publica' });
    expect(described).toMatchObject({ brokers: ['wss://a.cl/mqtt', 'wss://b.cl/mqtt'], mqttCredentials: true });
    expect(JSON.stringify(described)).not.toContain('clave-publica');
  });
});

describe('REL-09 / REL-10 / REL-15 · política de seguridad de la web', () => {
  it('permite conectar solo al propio sitio y a los brokers configurados, por nombre', () => {
    const policy = csp.buildCsp({});
    const connect = /connect-src ([^;]+)/.exec(policy)![1].split(' ');
    const brokers = JSON.parse(read('src/realtime/brokers.json')) as string[];
    expect(connect).toEqual(["'self'", ...brokers.map((url) => `wss://${new URL(url).host}`)]);
    // Ningún comodín: ni "wss:" a secas ni "*".
    expect(connect.some((item) => item === 'wss:' || item === 'ws:' || item.includes('*'))).toBe(false);
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it('sigue a la configuración: otros brokers y una API en otro origen cambian la política', () => {
    const policy = csp.buildCsp({ EXPO_PUBLIC_MQTT_URLS: 'wss://broker.propio.cl:443/mqtt', EXPO_PUBLIC_API_URL: 'https://api.propia.cl/api/v1' });
    expect(policy).toContain("connect-src 'self' wss://broker.propio.cl https://api.propia.cl;");
    expect(() => csp.buildCsp({ EXPO_PUBLIC_MQTT_URLS: 'javascript:alert(1)' })).toThrow();
  });

  it('lo publicado en vercel.json es exactamente la política de los brokers por defecto', () => {
    expect(csp.readVercelCsp()).toBe(csp.buildCsp({}));
  });

  it('la compilación falla si la plantilla HTML de Expo cambia', () => {
    const script = read('scripts/build-web.js');
    expect(script).toContain('se esperaba una sola coincidencia');
    expect(script.match(/replaceOnce\(/g)!.length).toBeGreaterThanOrEqual(5);
  });
});

describe('REL-11 · tamaño de la web', () => {
  it('pasarse del presupuesto detiene la compilación', () => {
    expect(budget.budgetProblems({ scriptGzipBytes: budget.BUDGET.scriptGzipBytes, fontBytes: 100_000, fonts: ['a.woff2'] })).toEqual([]);
    expect(budget.budgetProblems({ scriptGzipBytes: budget.BUDGET.scriptGzipBytes + 1, fontBytes: 100_000, fonts: [] })[0]).toMatch(/JavaScript comprimido/);
    expect(budget.budgetProblems({ scriptGzipBytes: 1, fontBytes: budget.BUDGET.fontBytes + 1, fonts: [] })[0]).toMatch(/Fuentes/);
    // Una fuente completa en la web significa que se dejó de usar la recortada.
    expect(budget.budgetProblems({ scriptGzipBytes: 1, fontBytes: 1, fonts: ['Montserrat_700Bold.ttf'] })[0]).toMatch(/fuentes completas/);
  });

  it('las fuentes web corresponden a las instaladas y pesan una fracción', () => {
    const manifest = JSON.parse(read('assets/fonts-web/manifest.json')) as { totalBytes: number; sourceTotalBytes: number; fonts: Record<string, { bytes: number; source: string }> };
    expect(Object.keys(manifest.fonts)).toHaveLength(7);
    for (const [name, info] of Object.entries(manifest.fonts)) {
      expect(fs.statSync(path.join(root, 'assets', 'fonts-web', `${name}.woff2`)).size).toBe(info.bytes);
      expect(fs.existsSync(path.join(root, 'node_modules', info.source))).toBe(true);
    }
    expect(manifest.totalBytes).toBeLessThan(budget.BUDGET.fontBytes);
    expect(manifest.totalBytes).toBeLessThan(manifest.sourceTotalBytes / 5);
    // La web carga esas, no las TTF completas.
    const web = read('src/theme/fontAssets.web.ts');
    Object.keys(manifest.fonts).forEach((name) => expect(web).toContain(`assets/fonts-web/${name}.woff2`));
  });

  it('todo carácter que la app muestra está en las fuentes web (o no existía en la fuente original)', () => {
    const manifest = JSON.parse(read('assets/fonts-web/manifest.json')) as { fonts: Record<string, { covered: number[]; missingInSource: number[] }> };
    const used = new Set<number>();
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|json)$/.test(entry.name)) for (const char of fs.readFileSync(full, 'utf8')) if (char.codePointAt(0)! > 0x7e) used.add(char.codePointAt(0)!);
      }
    };
    walk(path.join(root, 'app'));
    walk(path.join(root, 'src'));
    for (const [name, info] of Object.entries(manifest.fonts)) {
      const known = new Set([...info.covered, ...info.missingInSource]);
      const absent = [...used].filter((code) => !known.has(code)).map((code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(code)}`);
      // Si falla: se agregó un texto con un signo nuevo. Ejecuta `npm run fonts:web`.
      expect({ font: name, absent }).toEqual({ font: name, absent: [] });
    }
  });
});

describe('REL-02 / REL-08 · publicación', () => {
  it('publicar exige un destino, un árbol limpio y, para producción, confirmación', () => {
    expect(deploy.planProblem([], { dirty: false })).toMatch(/--preview o --production/);
    expect(deploy.planProblem(['--preview', '--production'], { dirty: false })).toMatch(/--preview o --production/);
    expect(deploy.planProblem(['--preview'], { dirty: true })).toMatch(/cambios sin confirmar/);
    expect(deploy.planProblem(['--preview'], { dirty: false })).toBeNull();
    expect(deploy.planProblem(['--production'], { dirty: false })).toMatch(/--confirm/);
    expect(deploy.planProblem(['--production', '--confirm'], { dirty: false })).toBeNull();
  });

  it('las comprobaciones son parte de publicar, en el script y en la compilación del proveedor', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; engines: Record<string, string>; packageManager: string; devDependencies: Record<string, string> };
    expect(pkg.scripts['deploy:web']).toBe('node scripts/deploy-web.js');
    expect(pkg.scripts['verify:web']).toBe('npm run check && npm run build:web');
    expect(JSON.parse(read('vercel.json')).buildCommand).toBe('npm run verify:web');
    const script = read('scripts/deploy-web.js');
    expect(script.indexOf("npm('check')")).toBeGreaterThan(-1);
    expect(script.indexOf("npm('check')")).toBeLessThan(script.indexOf("'deploy'"));
    expect(read('scripts/build-android.js')).toMatch(/'run', 'check'/);
    // Hay CI de la aplicación: instala limpio, comprueba, compila y corre el E2E.
    const ci = read('.github/workflows/ci.yml');
    ['npm ci', 'npm run check', 'npm run build:web', 'npm run e2e:web', 'npx expo-doctor'].forEach((step) => expect(ci).toContain(step));
    // Y no publica nada por su cuenta.
    expect(ci).not.toMatch(/vercel|deploy:web/);
  });

  it('las herramientas de publicación están fijadas', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; engines: Record<string, string>; packageManager: string; devDependencies: Record<string, string> };
    // Ninguna invocación a "lo último que haya".
    expect(JSON.stringify(pkg.scripts)).not.toContain('@latest');
    expect(read('scripts/deploy-web.js')).not.toContain('@latest');
    expect(pkg.devDependencies.vercel).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.engines.node).toBeTruthy();
    expect(pkg.packageManager).toMatch(/^npm@\d+\.\d+\.\d+$/);
    expect(read('.nvmrc').trim()).toMatch(/^\d+\.\d+\.\d+$/);
    const eas = JSON.parse(read('eas.json')) as { build: Record<string, { node?: string }> };
    Object.values(eas.build).forEach((profile) => expect(profile.node).toBe(read('.nvmrc').trim()));
  });
});
