# Aurora — working notes for Claude

## Deploy & live-test: ALWAYS via Chrome. Never ask the user to do it.

This is a personal, local project. The user's Chrome is **already logged into
Home Assistant** at `http://192.168.1.49:8123` (Aurora panel at `/aurora`). Use
the `claude-in-chrome` browser tools to deploy and live-test yourself — do **not**
ask the user to log in, restart, or update HACS.

There is **no SSH to the HA box**. The only SSH-configured server (`server_hw`,
192.168.1.170) is the GPU box (LLM/Frigate/transcoding), *not* Home Assistant.
So the deploy path is GitHub release → HACS → restart, driven through Chrome.

**Full deploy loop after code changes:**
1. `cd aurora-card && npm run build` (if the card changed) → emits
   `custom_components/aurora/www/aurora-card.js`. Commit it.
2. Bump `manifest.json` `version` **and** `__init__.py` `_CARD_VERSION` to the
   same value; add a `CHANGELOG.md` entry. Commit, `git push`.
3. Create the release HACS updates on: `git tag vX.Y.Z && git push origin vX.Y.Z`
   then `gh release create vX.Y.Z --title "X.Y.Z" --notes "<changelog section>"`.
   (`gh` lives at the WinGet path:
   `/c/Users/gabri/AppData/Local/Microsoft/WinGet/Packages/GitHub.cli_*/bin/gh`.)
4. In Chrome on HA: `/hacs/dashboard` → Aurora row kebab → **Update information**
   (makes HACS see the new release) → open Aurora → kebab → **Redownload** →
   **Download** (defaults to the newest version).
5. `/developer-tools/yaml` → **Restart** → **Restart Home Assistant** (a code
   change in `custom_components/` needs a full restart, not Quick reload).
6. Wait ~45s, then live-test in the Aurora panel (`/aurora`). After a card
   update, hard-refresh (Ctrl+F5) to bust the cached bundle.

Release titles are the **bare version** (`0.18.0`), tags are `vX.Y.Z`.

## Tests & lint

- Local box is **Python 3.12**: only pure (HA-free) tests run, via the
  `tests/conftest.py` namespace shim. Run them explicitly, e.g.
  `python -m pytest tests/test_vision.py tests/test_models.py ... -q`.
- HA-dependent tests (anything importing `homeassistant`) **and mypy are
  CI-only** — don't try to run them locally; just author them.
- `python -m ruff check <files>` works locally.

## Conventions

- No hardcoded user-facing strings or entity_ids. UI strings go through
  `localize`/`translations.ts` (English default + Italian). Backend resolves
  entities dynamically (e.g. by `translation_key` via the entity registry).
- Changelog/release notes: Keep a Changelog style, English, no emoji.
- Never stage `AURORA_DEV_PROMPT.md` (contains PII), `design/`, `docs/UX-IA.md`,
  or `tools/wf_tests.js`.
- Product spec: `AURORA_DEV_PROMPT.md`. Locked decisions: `docs/DECISIONS.md`.
  Panel IA study: `docs/UX-IA.md`.
