#!/usr/bin/env python3
"""Derive every Yere brand image from the supplied PNG (no redraw or new artwork).
Run with Pillow installed: python scripts/generate-branding.py [--check]
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/branding/app-icon.png'
source_bytes = SOURCE.read_bytes()
source = Image.open(io.BytesIO(source_bytes)).convert('RGBA')
art = source.crop(source.getbbox())
outputs = {}


def png(path, image):
    stream = io.BytesIO()
    image.save(stream, format='PNG', optimize=True)
    outputs[path] = stream.getvalue()


def canvas(size, fraction=.82, background='white', mono=False):
    if isinstance(size, int):
        size = (size, size)
    image = Image.new('RGBA', size, background)
    limit = round(min(size) * fraction)
    # Resize directly so even large platform icons use the full available artwork.
    factor = limit / max(art.size)
    mark = art.resize((round(art.width * factor), round(art.height * factor)), Image.Resampling.LANCZOS)
    if mono:
        silhouette = Image.new('RGBA', mark.size, 'white')
        silhouette.putalpha(mark.getchannel('A'))
        mark = silhouette
    image.alpha_composite(mark, ((size[0]-mark.width)//2, (size[1]-mark.height)//2))
    return image if background == (0, 0, 0, 0) else image.convert('RGB')


# Preserve the uploaded transparent logo byte-for-byte at the new cache-safe URL.
outputs['public/yere-logo-v2.png'] = source_bytes
for size in (192, 512):
    icon = canvas(size)
    png(f'public/icons/icon-{size}-v2.png', icon)
    png(f'public/icons/icon-{size}.png', icon)  # Old emails/installed manifests.
for name in ('public/icons/icon-maskable-512-v2.png', 'public/icons/icon-maskable-512.png'):
    png(name, canvas(512, .56))  # Entire mark fits inside the maskable safe circle.
png('public/icons/apple-touch-icon-v2.png', canvas(180))
png('public/icons/badge-v2-96.png', canvas(96, .82, (0, 0, 0, 0), mono=True))
for size in (32, 48):
    png(f'public/icons/favicon-v2-{size}.png', canvas(size, .90, (0, 0, 0, 0)))
ico = io.BytesIO()
canvas(64, .90, (0, 0, 0, 0)).save(ico, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
outputs['public/favicon.ico'] = ico.getvalue()

# Existing external links remain valid, but no old artwork survives in the SVG.
encoded = base64.b64encode(source_bytes).decode()
outputs['public/yere-mark.svg'] = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 302 302" role="img" aria-labelledby="title"><title id="title">Yere</title><image width="302" height="302" href="data:image/png;base64,{encoded}"/></svg>\n').encode()

res = 'android/app/src/main/res'
for density, size, foreground, status in [('mdpi',48,108,24), ('hdpi',72,162,36), ('xhdpi',96,216,48), ('xxhdpi',144,324,72), ('xxxhdpi',192,432,96)]:
    png(f'{res}/mipmap-{density}/ic_launcher.png', canvas(size))
    round_icon = canvas(size, .72).convert('RGBA')
    circle = Image.new('L', (size*4, size*4))
    ImageDraw.Draw(circle).ellipse((0, 0, size*4-1, size*4-1), fill=255)
    round_icon.putalpha(circle.resize((size, size), Image.Resampling.LANCZOS))
    png(f'{res}/mipmap-{density}/ic_launcher_round.png', round_icon)
    png(f'{res}/mipmap-{density}/ic_launcher_foreground.png', canvas(foreground, .46, (0, 0, 0, 0)))
    png(f'{res}/mipmap-{density}/ic_launcher_monochrome.png', canvas(foreground, .46, (0, 0, 0, 0), mono=True))
    png(f'{res}/drawable-{density}/ic_stat_yere.png', canvas(status, .82, (0, 0, 0, 0), mono=True))
for path in sorted((ROOT / res).glob('drawable*/splash.png')):
    with Image.open(path) as existing:
        png(str(path.relative_to(ROOT)), canvas(existing.size, .32, '#0e1220'))
png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', canvas(1024))
for path in sorted((ROOT / 'ios/App/App/Assets.xcassets/Splash.imageset').glob('*.png')):
    png(str(path.relative_to(ROOT)), canvas((2732, 2732), .24, '#0e1220'))

# Guard against clipping by circular launcher masks and accidental coloured status art.
for size, fraction in [(512, .56), (432, .46)]:
    check = canvas(size, fraction, (0, 0, 0, 0))
    for x in range(size):
        for y in range(size):
            if check.getpixel((x, y))[3] > 16:
                assert (x-size/2)**2 + (y-size/2)**2 <= (size*(.4 if size == 512 else 33/108))**2
for path, data in outputs.items():
    if 'ic_stat_yere' in path or 'monochrome' in path or 'badge-v2' in path:
        with Image.open(io.BytesIO(data)) as status:
            assert all(pixel[:3] == (255, 255, 255) for pixel in status.get_flattened_data() if pixel[3])

inventory = {
    'source': 'assets/branding/app-icon.png',
    'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
    'outputs': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(outputs.items())}
}
outputs['assets/branding/generated-assets.json'] = (json.dumps(inventory, indent=2) + '\n').encode()
if '--check' in sys.argv:
    mismatches = [path for path, data in outputs.items() if not (ROOT/path).exists() or (ROOT/path).read_bytes() != data]
    if mismatches:
        raise SystemExit('Branding assets differ: ' + ', '.join(mismatches))
    print(f'All {len(outputs)-1} generated images match the source.')
else:
    for path, data in outputs.items():
        target = ROOT/path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print(f'Generated {len(outputs)-1} brand images.')
