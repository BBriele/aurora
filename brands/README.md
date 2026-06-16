# Aurora brand assets

Ready-to-submit icon/logo for the [home-assistant/brands](https://github.com/home-assistant/brands)
repository, so Aurora shows a proper icon in the Integrations list and in HACS.

## Files (`brands/aurora/`)

| File | Size | Purpose |
|---|---|---|
| `icon.svg` | vector | Source for the square app icon |
| `logo.svg` | vector | Source for the wordmark logo |
| `icon.png` | 256×256 | Square icon |
| `icon@2x.png` | 512×512 | Square icon (hi-dpi) |
| `logo.png` | ≤512 wide | Wordmark logo (trimmed) |
| `logo@2x.png` | ≤1024 wide | Wordmark logo (hi-dpi, trimmed) |

PNGs are generated from the SVGs and trimmed of transparent borders by
`tools/gen-brands.mjs`:

```bash
cd tools && npm install && node gen-brands.mjs
```

## How to submit (one-time, requires a GitHub PR)

Aurora is a **custom** integration, so its brand lives under `custom_integrations/`.

1. Fork and clone `home-assistant/brands`.
2. Create `custom_integrations/aurora/` and copy the four PNGs into it:
   `icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png`.
3. Open a PR. The brands CI checks exact icon sizes (256/512), transparency,
   trimming, and PNG optimization. If it flags optimization, run the PNGs through
   `oxipng -o max` (or `pngquant`) and re-commit.
4. Once merged, the icon/logo appear automatically — no Aurora release needed.

> The `quality_scale.yaml` `brands` rule stays `todo` until that PR is **merged**.
