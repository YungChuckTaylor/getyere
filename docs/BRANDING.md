# Yere brand assets

The user-supplied `assets/branding/app-icon.png` is the source of truth. It is a 302 × 302 transparent PNG. Artwork and colours are preserved: generated sizes use high-quality raster resizing, not an invented vector redraw. A larger source can improve the sharpness of future 1024px exports.

## Regenerate

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-branding.txt
.venv/bin/python scripts/generate-branding.py
.venv/bin/python scripts/generate-branding.py --check
```

Pillow is only needed for regeneration; normal web, CI, Android, and iOS builds use the checked-in files and do not need Python. `assets/branding/generated-assets.json` records output hashes; `tests/branding.test.js` checks them and the platform dimensions.

- Web logo: `/yere-logo-v2.png`, byte-identical to the upload.
- Web favicons: versioned 32/48px PNGs and fallback `/favicon.ico`.
- PWA: 192px, 512px, maskable 512px, and 180px Apple touch icon. Maskable art is padded to fit the central safe circle.
- Android: all five launcher densities, genuinely round legacy icons, transparent adaptive foregrounds, themed monochrome foregrounds, white/alpha notification symbols, and every portrait/landscape splash size. The default Android robot/grid drawables are also replaced.
- iOS: opaque RGB 1024px launcher and all three launch-image assets. No rounded corners are baked into the iOS launcher.
- Old public icon paths and `/yere-mark.svg` contain the new artwork as compatibility assets. The SVG is an embedded PNG wrapper, not a vector master.

App chrome, auth, onboarding, admin, legal/support pages, notification previews, and repository email templates use the new brand. Functional UI symbols (mic, password reveal, navigation, etc.) are intentionally unchanged.

## Delivery and caches

The service-worker cache version is bumped, and current logo/PWA URLs are versioned to bypass the long-lived icon cache. Existing installed PWAs may still need their browser's next manifest update, or removal/reinstallation, before the home-screen icon changes. Already-delivered notifications and emails cannot be changed.

Rebuild/install the Android APK and rebuild iOS in Xcode to see native launcher/splash changes; a website deploy does not replace an already-installed native binary. Supabase-hosted email templates are managed separately: copy the updated templates from `supabase/email-templates/` to the dashboard when needed. Old template URLs now also resolve to the replacement logo, subject to mail-client image caching.

Vercel production should rebuild this commit with the existing production public Supabase environment variables, rather than promote a preview built without them. Google Auth Platform's separately uploaded consent-screen logo and app-store listing artwork must be changed in their respective dashboards; this repository cannot update those external uploads.
