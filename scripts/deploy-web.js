// Publica la web y la API en Vercel. NO se ejecuta solo: es el comando que usa quien publica.
//
//   npm run deploy:web -- --preview                publica una vista previa (URL propia, no toca producción)
//   npm run deploy:web -- --production --confirm   publica producción
//
// Qué exige antes de publicar:
//   · un árbol sin cambios pendientes (lo publicado corresponde a un commit);
//   · `npm run check` y `npm run e2e:web` en verde (se ejecutan aquí);
//   · para producción, que la base ya tenga las migraciones (`npm run db:migrate -- --target production --dry-run`
//     debe decir "al día": esto lo revisa quien publica; el script lo recuerda y pide --confirm).
//
// Usa la CLI de Vercel fijada en package.json (la versión instalada con `npm ci`), no la más reciente que exista.
const { execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function planProblem(argv, state) {
  const production = argv.includes('--production');
  const preview = argv.includes('--preview');
  if (production === preview) return 'Indica el destino: --preview o --production.';
  if (state.dirty) return 'Hay cambios sin confirmar. Se publica desde un commit.';
  if (production && !argv.includes('--confirm')) {
    return 'Producción requiere --confirm. Antes: aplica las migraciones pendientes de la base (npm run db:migrate -- --target production --dry-run) y ten listo el APK de la misma versión.';
  }
  return null;
}

function run(file, args) {
  console.log(`\n> ${path.basename(file)} ${args.join(' ')}`);
  execFileSync(file, args, { cwd: root, stdio: 'inherit' });
}

function main() {
  const argv = process.argv.slice(2);
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
  const problem = planProblem(argv, { dirty });
  if (problem) {
    console.error(`\n✖ ${problem}`);
    process.exit(1);
  }
  const production = argv.includes('--production');
  const windows = process.platform === 'win32';
  const npm = (script) => (windows ? run('cmd.exe', ['/d', '/c', 'npm', 'run', script]) : run('npm', ['run', script]));
  npm('check');
  npm('e2e:web');
  // `vercel build` ejecuta el buildCommand de vercel.json (compila la web y sus comprobaciones).
  const vercel = path.join(root, 'node_modules', 'vercel', 'dist', 'vc.js');
  run(process.execPath, [vercel, 'build', ...(production ? ['--prod'] : []), '--yes']);
  run(process.execPath, [vercel, 'deploy', '--prebuilt', ...(production ? ['--prod'] : []), '--yes']);
}

module.exports = { planProblem };

if (require.main === module) main();
