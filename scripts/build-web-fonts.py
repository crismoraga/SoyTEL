"""Genera las fuentes de la versión web: WOFF2 con solo los caracteres que la app puede mostrar.

Las fuentes completas (TTF de @expo-google-fonts) pesan ~1,4 MB entre las siete; un teléfono con datos
móviles las descarga antes de ver el primer texto. Aquí se recortan al alfabeto latino (con tildes,
ñ y los signos que usa la app) y se comprimen como WOFF2. Android e iOS siguen usando las TTF completas.

Uso (herramienta de mantención; requiere Python 3 con `fonttools` y `brotli`):
    python scripts/build-web-fonts.py            regenera assets/fonts-web/
    python scripts/build-web-fonts.py --check    comprueba que lo guardado corresponde a las fuentes instaladas

Qué queda dentro: ASCII, Latin-1, Latin Extendido-A, la puntuación tipográfica habitual, flechas,
y además TODO carácter que aparezca en el código de app/ y src/ (si alguien agrega un texto con un
signo nuevo y regenera, ese signo entra). El script falla si un carácter usado por la app existe en la
fuente original y no quedó en la recortada.
"""

import hashlib
import io
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'fonts-web')

FONTS = {
    'Montserrat_600SemiBold': 'montserrat/600SemiBold/Montserrat_600SemiBold.ttf',
    'Montserrat_700Bold': 'montserrat/700Bold/Montserrat_700Bold.ttf',
    'Montserrat_800ExtraBold': 'montserrat/800ExtraBold/Montserrat_800ExtraBold.ttf',
    'NunitoSans_400Regular': 'nunito-sans/400Regular/NunitoSans_400Regular.ttf',
    'NunitoSans_600SemiBold': 'nunito-sans/600SemiBold/NunitoSans_600SemiBold.ttf',
    'NunitoSans_700Bold': 'nunito-sans/700Bold/NunitoSans_700Bold.ttf',
    'NunitoSans_800ExtraBold': 'nunito-sans/800ExtraBold/NunitoSans_800ExtraBold.ttf',
}

BASE_RANGES = [
    (0x0020, 0x007E),  # ASCII
    (0x00A0, 0x00FF),  # Latin-1 (tildes, ñ, ¿ ¡ º ° · « »)
    (0x0100, 0x017F),  # Latin Extendido-A (nombres con otros diacríticos)
    (0x2010, 0x2015),  # guiones y rayas
    (0x2018, 0x201E),  # comillas tipográficas
    (0x2020, 0x2022),  # † ‡ •
    (0x2026, 0x2026),  # …
    (0x2030, 0x2030),  # ‰
    (0x2032, 0x2033),  # ′ ″
    (0x2039, 0x203A),  # ‹ ›
    (0x2044, 0x2044),  # ⁄
    (0x20AC, 0x20AC),  # €
    (0x2122, 0x2122),  # ™
    (0x2190, 0x2193),  # ← ↑ → ↓
    (0x2212, 0x2212),  # −
    (0x2248, 0x2248),  # ≈
    (0x2260, 0x2260),  # ≠
    (0x2264, 0x2265),  # ≤ ≥
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def app_characters():
    """Todo carácter no ASCII presente en el código de la app (textos, signos, flechas)."""
    found = set()
    for folder in ('app', 'src'):
        for directory, _, names in os.walk(os.path.join(ROOT, folder)):
            for name in names:
                if not name.endswith(('.ts', '.tsx', '.json')):
                    continue
                with io.open(os.path.join(directory, name), encoding='utf-8') as handle:
                    found.update(ord(char) for char in handle.read() if ord(char) > 0x7E)
    return found


def charset():
    wanted = set()
    for start, end in BASE_RANGES:
        wanted.update(range(start, end + 1))
    return wanted, app_characters()


def build(name, relative, wanted, used):
    source = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', relative)
    with open(source, 'rb') as handle:
        original_bytes = handle.read()
    original = TTFont(io.BytesIO(original_bytes))
    available = set(original.getBestCmap().keys())

    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']  # kerning, ligaduras y números tabulares (tnum)
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = [1, 2, 3, 4, 6, 13, 14]
    options.notdef_outline = True
    font = TTFont(io.BytesIO(original_bytes))
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted((wanted | used) & available))
    subsetter.subset(font)
    buffer = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buffer)
    data = buffer.getvalue()

    kept = set(TTFont(io.BytesIO(data)).getBestCmap().keys())
    missing = sorted((used & available) - kept)
    if missing:
        raise SystemExit('%s: la app usa caracteres que no quedaron en la fuente recortada: %s' % (name, ' '.join('U+%04X' % code for code in missing)))
    return data, {
        'source': '@expo-google-fonts/' + relative,
        'sourceSha256': sha256(original_bytes),
        'sourceBytes': len(original_bytes),
        'bytes': len(data),
        'sha256': sha256(data),
        'characters': len(kept),
        # Caracteres (fuera de ASCII) que la app usa y esta fuente trae.
        'covered': sorted(code for code in kept if code > 0x7E and code in used),
        # Caracteres que la app usa y la fuente original no tiene: se dibujan con una fuente del
        # sistema en todas las plataformas, igual que antes de recortar.
        'missingInSource': sorted(used - available),
    }


def main():
    check = '--check' in sys.argv
    wanted, used = charset()
    manifest = {'generator': 'scripts/build-web-fonts.py', 'fonts': {}}
    outputs = {}
    for name, relative in FONTS.items():
        data, info = build(name, relative, wanted, used)
        outputs[name] = data
        manifest['fonts'][name] = info
    manifest['totalBytes'] = sum(info['bytes'] for info in manifest['fonts'].values())
    manifest['sourceTotalBytes'] = sum(info['sourceBytes'] for info in manifest['fonts'].values())
    text = json.dumps(manifest, indent=2, sort_keys=True) + '\n'

    if check:
        path = os.path.join(OUT, 'manifest.json')
        saved = json.load(io.open(path, encoding='utf-8')) if os.path.exists(path) else None
        problems = []
        for name, info in manifest['fonts'].items():
            previous = (saved or {}).get('fonts', {}).get(name)
            file = os.path.join(OUT, name + '.woff2')
            if not previous or not os.path.exists(file):
                problems.append('%s: falta' % name)
            elif previous['sourceSha256'] != info['sourceSha256']:
                problems.append('%s: la fuente original cambió' % name)
            elif sha256(open(file, 'rb').read()) != previous['sha256']:
                problems.append('%s: el archivo no corresponde a lo anotado' % name)
            elif previous['characters'] < info['characters']:
                problems.append('%s: la app usa caracteres nuevos' % name)
        if problems:
            raise SystemExit('Fuentes web desactualizadas (ejecuta python scripts/build-web-fonts.py):\n  ' + '\n  '.join(problems))
        print('Fuentes web al día: %d archivos, %.0f kB (las originales pesan %.0f kB).' % (len(FONTS), saved['totalBytes'] / 1024, saved['sourceTotalBytes'] / 1024))
        return

    os.makedirs(OUT, exist_ok=True)
    for name, data in outputs.items():
        with open(os.path.join(OUT, name + '.woff2'), 'wb') as handle:
            handle.write(data)
    with io.open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(text)
    print('Fuentes web: %d archivos, %.0f kB (las originales pesan %.0f kB).' % (len(FONTS), manifest['totalBytes'] / 1024, manifest['sourceTotalBytes'] / 1024))


if __name__ == '__main__':
    main()
