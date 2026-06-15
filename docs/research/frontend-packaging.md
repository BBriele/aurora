# Frontend Packaging Research — Aurora Custom Card + Integration

**Target:** HA 2026.3.0 minimum, tested against ~2026.6.3, Python 3.14  
**Researched:** 2026-06-15

---

## Table of Contents

1. [LitElement + TypeScript Custom Card Anatomy](#1-litelement--typescript-custom-card-anatomy)
2. [HA Frontend Elements and custom-card-helpers](#2-ha-frontend-elements-and-custom-card-helpers)
3. [Backend Calls from the Card](#3-backend-calls-from-the-card)
4. [Build Tooling (2026)](#4-build-tooling-2026)
5. [Integration Auto-Registration of Lovelace Resources](#5-integration-auto-registration-of-lovelace-resources)
6. [HACS Distribution — Integration + Card from Same Repo](#6-hacs-distribution--integration--card-from-same-repo)
7. [Known Gaps](#7-known-gaps)
8. [Sources](#8-sources)

---

## 1. LitElement + TypeScript Custom Card Anatomy

### Core Interface Contract

A custom Lovelace card is a standard custom element registered under `custom:your-card-name`. HA expects these lifecycle methods/properties:

| Method/Prop | Required | Notes |
|---|---|---|
| `setConfig(config)` | Yes | Called whenever config changes; throw on invalid config |
| `set hass(hass)` | Yes | HA pushes state updates here; **do not** make it a reactive property |
| `render()` | Yes (if LitElement) | Returns `TemplateResult` |
| `getCardSize()` | Recommended | Returns number (1 unit = 50 px); used by masonry layout |
| `getGridOptions()` | Recommended | Used by sections view (12-column grid) |
| `static getConfigElement()` | Optional | Returns editor element for GUI editing |
| `static getStubConfig()` | Optional | Returns default config JSON for card picker |
| `static getConfigForm()` | Optional | Alternative to custom editor — returns schema for built-in ha-form |

### Minimal TypeScript Skeleton

```typescript
import { LitElement, html, css, TemplateResult, CSSResultGroup } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardConfig } from "custom-card-helpers";

interface AuroraCardConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
}

@customElement("aurora-alarm-card")
export class AuroraAlarmCard extends LitElement {
  // DO NOT use @property for hass — prevents unnecessary re-renders
  @state() private _hass!: HomeAssistant;
  @state() private _config!: AuroraAlarmConfig;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: AuroraCardConfig): void {
    if (!config.entity) {
      throw new Error("You must define an entity");
    }
    this._config = config;
  }

  getCardSize(): number {
    return 3;
  }

  getGridOptions() {
    return {
      rows: 3,
      columns: 6,
      min_rows: 3,
      max_rows: 6,
    };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("aurora-alarm-card-editor");
  }

  static getStubConfig(): AuroraCardConfig {
    return { type: "custom:aurora-alarm-card", entity: "alarm_control_panel.home" };
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) {
      return html``;
    }
    const stateObj = this._hass.states[this._config.entity];
    return html`
      <ha-card .header=${"Aurora Alarm"}>
        <div class="card-content">
          <p>State: ${stateObj?.state ?? "unavailable"}</p>
        </div>
      </ha-card>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      ha-card { padding: 16px; }
    `;
  }
}

// Self-registration for UI discovery
window.customCards = window.customCards || [];
window.customCards.push({
  type: "custom:aurora-alarm-card",
  name: "Aurora Alarm Card",
  description: "Control panel card for the Aurora alarm integration",
  documentationURL: "https://github.com/your-org/aurora",
  preview: true,
  // New in 2026.6: suggest card for specific entity types
  getEntitySuggestion: (hass, entityId) => {
    if (entityId.split(".")[0] !== "alarm_control_panel") return null;
    return { config: { type: "custom:aurora-alarm-card", entity: entityId } };
  },
});
```

### Visual Editor with `getConfigForm()` (Simpler — No Custom Element Needed)

Added as a static method on the card class; HA renders the form automatically using `ha-form`:

```typescript
static getConfigForm() {
  return {
    schema: [
      {
        name: "entity",
        required: true,
        selector: { entity: { domain: "alarm_control_panel" } },
      },
      {
        name: "name",
        selector: { text: {} },
      },
      {
        name: "show_keypad",
        selector: { boolean: {} },
      },
    ],
    computeLabel: (schema: { name: string }) => schema.name,
    computeHelper: (_schema: { name: string }) => undefined,
    assertConfig: (config: AuroraCardConfig) => {
      if (!config.entity) throw new Error("entity is required");
    },
  };
}
```

### Visual Editor with Custom Element (`getConfigElement()`) — Full Control

When richer UI is needed, create a separate custom element:

```typescript
@customElement("aurora-alarm-card-editor")
export class AuroraAlarmCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public lovelace?: object; // dashboard config
  @state() private _config?: AuroraCardConfig;

  setConfig(config: AuroraCardConfig): void {
    this._config = config;
  }

  private _valueChanged(ev: CustomEvent): void {
    const newConfig = ev.detail.value;
    const event = new Event("config-changed", { bubbles: true, composed: true });
    (event as any).detail = { config: newConfig };
    this.dispatchEvent(event);
  }

  protected render(): TemplateResult {
    if (!this._config) return html``;
    return html`
      <ha-form
        .hass=${this._hass}
        .data=${this._config}
        .schema=${[
          { name: "entity", required: true, selector: { entity: { domain: "alarm_control_panel" } } },
        ]}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}
```

**Key**: changes are communicated back via a `config-changed` CustomEvent with `detail.config` containing the new config object.

### `window.customCards` Registration

Must run at module evaluation time (top-level, after class definition):

```typescript
declare global {
  interface Window {
    customCards: Array<Record<string, unknown>>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "custom:aurora-alarm-card",
  name: "Aurora Alarm Card",
  description: "...",
  documentationURL: "https://...",
  preview: false, // set true only if stub config renders without live entity
});
```

---

## 2. HA Frontend Elements and custom-card-helpers

### `custom-card-helpers` Package

Install: `npm install custom-card-helpers`  
Docs: https://custom-cards.github.io/custom-card-helpers/  
Repo: https://github.com/custom-cards/custom-card-helpers

Key exports:
- `HomeAssistant` — main interface (states, services, connection, callService, callWS, etc.)
- `LovelaceCardConfig` — base interface for card configs
- `fireEvent()` — helper to dispatch DOM events
- `navigate()` — navigation helper
- `computeStateName()`, `computeStateDisplay()`, etc.

**Status in 2026**: The package is still widely used for types. However, for the most current HA frontend TypeScript types, you can also directly reference the HA frontend source or use `@ha/types` imports (advanced). `custom-card-helpers` remains the pragmatic choice for standalone cards.

### HA Built-In Web Components (use freely in card templates)

These are globally registered in HA's frontend and can be used directly in LitElement templates without importing:

| Element | Purpose |
|---|---|
| `<ha-card>` | Standard card shell with header/footer |
| `<ha-form>` | Schema-driven form (for config editors) |
| `<ha-dialog>` | Modal dialog container |
| `<ha-icon>` | HA icon with `icon` attribute (e.g. `mdi:home`) |
| `<ha-icon-button>` | Icon-only button |
| `<ha-circular-progress>` | Loading spinner |
| `<ha-alert>` | Alert/warning banner |
| `<ha-selector>` | Generic selector that maps to all HA selector types |
| `<ha-entity-picker>` | Entity selection widget |
| `<ha-code-editor>` | CodeMirror-based editor |
| `<ha-chip>` | Tag/badge chip |
| `<state-badge>` | Entity state badge |

**Caveat**: These are internal HA elements with no stability guarantee between versions. Always test on the minimum supported HA version.

### Importing Lit from HA Bundle (Advanced — Avoid for Cards)

HA itself uses Lit internally. It's technically possible to import Lit from the HA frontend bundle to avoid shipping it twice. However, this is fragile because HA's Lit version can change. For standalone integration cards, **bundle your own Lit** (it is small: ~15KB minified+gzipped).

---

## 3. Backend Calls from the Card

### Calling Services

```typescript
// Simple service call
await this._hass.callService("alarm_control_panel", "alarm_arm_home", {
  entity_id: this._config.entity,
  code: "1234",
});

// With return value (HA 2023.4+)
const response = await this._hass.callService(
  "aurora",
  "get_alarm_state",
  { entity_id: this._config.entity },
  undefined, // target
  true        // returnResponse
);
```

### WebSocket Commands (callWS)

For custom websocket commands registered in the integration:

```typescript
// Typed helper
interface AuroraVersionResult {
  version: string;
}

const result = await this._hass.callWS<AuroraVersionResult>({
  type: "aurora/version",
});
console.log(result.version);

// Or using the lower-level connection directly
const result2 = await this._hass.connection.sendMessagePromise({
  type: "aurora/get_config",
});
```

### Subscribing to WebSocket Collections / State Changes

```typescript
import { subscribeEntityRegistry } from "custom-card-helpers";

// State-based reactivity: hass setter is called on any state change.
// Filter inside the setter for performance:
set hass(hass: HomeAssistant) {
  const oldState = this._hass?.states[this._config.entity];
  const newState = hass.states[this._config.entity];
  this._hass = hass;
  if (oldState?.state !== newState?.state) {
    this.requestUpdate();
  }
}

// WebSocket subscription (e.g., listen for integration events)
private _unsubscribe?: () => void;

connectedCallback(): void {
  super.connectedCallback();
  this._subscribe();
}

disconnectedCallback(): void {
  super.disconnectedCallback();
  this._unsubscribe?.();
}

private _subscribe(): void {
  this._unsubscribe = this._hass.connection.subscribeEvents(
    (event) => {
      this._handleAuroraEvent(event);
    },
    "aurora_alarm_changed"
  );
}
```

### Data Context API (2026+ HA Pattern)

HA 2026 added a context-request mechanism for cards to pull reactive data:

```typescript
private _requestStateContext(): void {
  const event = new CustomEvent("context-request", {
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  (event as any).context = "states";
  (event as any).subscribe = true;
  (event as any).callback = (states: Record<string, unknown>) => {
    this._externalStates = states;
    this.requestUpdate();
  };
  this.dispatchEvent(event);
}
```

---

## 4. Build Tooling (2026)

### Landscape Summary

| Tool | Status in 2026 | Verdict for HA Cards |
|---|---|---|
| **Vite 8 + Rolldown** | Vite 8 stable (March 2026), uses Rolldown (Rust bundler) + Oxc transformer | Good for dev DX; slightly more setup for library/single-file output |
| **Rollup 4** | Mature, production-proven for library bundles | **Recommended** — best single-file JS output control |
| **esbuild** | Fast, minimal config, ESM output | Great for quick builds; less plugin ecosystem |
| **Webpack 5** | Works but heavy; the gist example uses Webpack | Functional but overkill for a card |

**Recommendation for Aurora**: Use **Rollup 4** (or Vite 8 in library mode) for production. Rollup gives the cleanest control over a single-bundle output that targets modern browsers (ES2020+), which is all HA supports.

### Minimal Rollup Config (Recommended)

Install:
```bash
npm install --save-dev rollup @rollup/plugin-typescript @rollup/plugin-node-resolve @rollup/plugin-replace rollup-plugin-terser
```

`rollup.config.js`:
```javascript
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";
import pkg from "./package.json" assert { type: "json" };

export default {
  input: "src/aurora-alarm-card.ts",
  output: {
    file: "dist/aurora-alarm-card.js",
    format: "es",                  // ES module — required for Lovelace resources
    sourcemap: false,
    inlineDynamicImports: true,    // ensures single-file output
  },
  plugins: [
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify("production"),
      __CARD_VERSION__: JSON.stringify(pkg.version),
    }),
    resolve(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    terser({
      compress: true,
      format: { comments: false },
    }),
  ],
  // Keep Lit external if you want to reference HA's copy (advanced — usually bundle it)
  // external: ["lit"],
};
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "strict": true,
    "outDir": "dist",
    "declaration": false
  },
  "include": ["src/**/*.ts"]
}
```

`package.json` scripts:
```json
{
  "scripts": {
    "build": "rollup -c rollup.config.js",
    "watch": "rollup -c rollup.config.js --watch",
    "dev": "rollup -c rollup.config.js --watch"
  }
}
```

### Output Location

Place the built JS inside the integration's Python package so it gets served via static paths:

```
custom_components/aurora/frontend/aurora-alarm-card.js
custom_components/aurora/frontend/__init__.py   # empty, needed for Python
```

---

## 5. Integration Auto-Registration of Lovelace Resources

### Architecture Overview

Three pillars must work together:

1. **`manifest.json`**: Declare `"frontend"` and `"http"` as dependencies
2. **`async_register_static_paths`**: Serve the JS file over HTTP
3. **Lovelace resource registration**: Add the URL to Lovelace's resource list (storage mode only)

### manifest.json

```json
{
  "domain": "aurora",
  "name": "Aurora Alarm System",
  "version": "1.0.0",
  "dependencies": ["frontend", "http"],
  "config_flow": true,
  "iot_class": "local_push",
  "documentation": "https://github.com/your-org/aurora",
  "issue_tracker": "https://github.com/your-org/aurora/issues",
  "codeowners": ["@your-handle"]
}
```

**Critical**: Without `"frontend"` and `"http"` in dependencies, resource registration will fail silently.

### const.py

```python
from pathlib import Path
import json
from typing import Final

DOMAIN: Final[str] = "aurora"
URL_BASE: Final[str] = "/aurora-frontend"

# Read version from manifest.json to keep in sync automatically
_manifest = json.loads((Path(__file__).parent / "manifest.json").read_text())
INTEGRATION_VERSION: Final[str] = _manifest.get("version", "0.0.0")

LOVELACE_MODULES: Final[list[dict[str, str]]] = [
    {
        "name": "Aurora Alarm Card",
        "filename": "aurora-alarm-card.js",
        "version": INTEGRATION_VERSION,
    },
]
```

### frontend/__init__.py — JSModuleRegistration

```python
"""Register JS frontend modules for Aurora."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

from ..const import DOMAIN, INTEGRATION_VERSION, LOVELACE_MODULES, URL_BASE

_LOGGER = logging.getLogger(__name__)

# Directory where built JS files live
FRONTEND_DIR = Path(__file__).parent


class JSModuleRegistration:
    """Register and manage Aurora's Lovelace JS resources."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.lovelace = hass.data.get("lovelace")

    async def async_register(self) -> None:
        """Register static path, then register Lovelace resources if storage mode."""
        await self._register_static_path()
        lovelace_mode = getattr(
            self.lovelace, "mode",
            getattr(self.lovelace, "resource_mode", "yaml")
        )
        if lovelace_mode == "storage":
            await self._wait_for_resources()
        else:
            _LOGGER.warning(
                "Aurora: Lovelace is in YAML mode — add resources manually:\n"
                "  resources:\n"
                "    - url: %s/aurora-alarm-card.js?v=%s\n"
                "      type: module",
                URL_BASE, INTEGRATION_VERSION,
            )

    async def _register_static_path(self) -> None:
        try:
            await self.hass.http.async_register_static_paths([
                StaticPathConfig(URL_BASE, str(FRONTEND_DIR), cache_headers=False)
            ])
            _LOGGER.debug("Aurora static path registered: %s", URL_BASE)
        except RuntimeError:
            # Already registered (e.g., config entry reload)
            _LOGGER.debug("Aurora static path already registered")

    async def _wait_for_resources(self) -> None:
        async def _check(_now: Any) -> None:
            if getattr(self.lovelace.resources, "loaded", False):
                await self._register_modules()
            else:
                async_call_later(self.hass, 5, _check)
        await _check(None)

    async def _register_modules(self) -> None:
        existing = {
            r["url"].split("?")[0]: r
            for r in self.lovelace.resources.async_items()
            if r["url"].startswith(URL_BASE)
        }
        for module in LOVELACE_MODULES:
            url = f"{URL_BASE}/{module['filename']}"
            versioned_url = f"{url}?v={module['version']}"
            if url in existing:
                resource = existing[url]
                current_version = (
                    resource["url"].split("?v=", 1)[-1]
                    if "?v=" in resource["url"] else "0"
                )
                if current_version != module["version"]:
                    _LOGGER.info(
                        "Updating Aurora resource %s: %s -> %s",
                        module["name"], current_version, module["version"]
                    )
                    await self.lovelace.resources.async_update_item(
                        resource["id"],
                        {"res_type": "module", "url": versioned_url},
                    )
            else:
                _LOGGER.info("Registering Aurora resource: %s", module["name"])
                await self.lovelace.resources.async_create_item(
                    {"res_type": "module", "url": versioned_url}
                )

    async def async_unregister(self) -> None:
        """Remove Aurora resources from Lovelace (call on integration unload)."""
        if getattr(self.lovelace, "mode", "yaml") == "storage":
            for module in LOVELACE_MODULES:
                url_prefix = f"{URL_BASE}/{module['filename']}"
                for resource in list(self.lovelace.resources.async_items()):
                    if resource["url"].startswith(url_prefix):
                        await self.lovelace.resources.async_delete_item(resource["id"])
```

### __init__.py — async_setup (NOT async_setup_entry)

```python
"""Aurora alarm system integration."""
from __future__ import annotations

from homeassistant.core import HomeAssistant, CoreState, EVENT_HOMEASSISTANT_STARTED
from homeassistant.components import websocket_api
from homeassistant.helpers import config_validation as cv
import voluptuous as vol

from .const import DOMAIN, INTEGRATION_VERSION
from .frontend import JSModuleRegistration

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up Aurora — register frontend ONCE at integration level."""
    _register_websocket_commands(hass)

    async def _setup_frontend(_event=None) -> None:
        registrar = JSModuleRegistration(hass)
        await registrar.async_register()

    if hass.state == CoreState.running:
        await _setup_frontend()
    else:
        # Defer until HA is fully started so Lovelace resources are available
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _setup_frontend)

    return True


def _register_websocket_commands(hass: HomeAssistant) -> None:
    @websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/version"})
    @websocket_api.async_response
    async def ws_get_version(hass, connection, msg):
        connection.send_result(msg["id"], {"version": INTEGRATION_VERSION})

    websocket_api.async_register_command(hass, ws_get_version)
```

**Critical caveat**: Registration **must** happen in `async_setup`, not `async_setup_entry`. `async_setup` runs once per integration domain; `async_setup_entry` runs per config entry and could register duplicates.

### frontend.add_extra_js_url vs. Current Pattern

`frontend.add_extra_js_url` (from `homeassistant.components.frontend`) was the older approach. As of 2024–2025, the recommended pattern is:

1. `async_register_static_paths` to serve the file
2. Manipulate `lovelace.resources` directly to add the URL

`add_extra_js_url` / `async_register_extra_module_url` still exist in the HA frontend component but are less predictable — they inject the script globally into HA's own JS bundle loading, which can conflict with Lovelace's resource management. **Prefer the lovelace.resources approach** shown above.

`hass.http.register_static_path` (the sync version) was removed in HA 2025.7. Always use `await hass.http.async_register_static_paths([StaticPathConfig(...)])`.

### Storage Mode vs YAML Mode

| Mode | Auto-registration works? | Notes |
|---|---|---|
| Storage (default) | Yes | Use `lovelace.resources.async_create_item` |
| YAML (`lovelace:` in config) | No | Log a warning with manual YAML snippet |

For YAML mode users, they must add to `ui-lovelace.yaml` or `configuration.yaml`:
```yaml
lovelace:
  resources:
    - url: /aurora-frontend/aurora-alarm-card.js?v=1.0.0
      type: module
```

### Version Cache-Busting — Important Caveats

The `?v=X.Y.Z` query string does solve browser caching for most cases, but:

- Mobile companion apps cache JS modules aggressively — the old URL is cached in the service worker
- Implement a websocket version-check in the card and show a `hass-notification` when frontend/backend versions mismatch, with a one-click cache-clear-and-reload button

```typescript
// In connectedCallback() of the card:
private async _checkVersion(): Promise<void> {
  try {
    const result = await this._hass.callWS<{ version: string }>({
      type: "aurora/version",
    });
    if (result.version !== CARD_VERSION) {
      this._dispatchVersionMismatchNotification(result.version);
    }
  } catch {
    // Integration not loaded — fail silently
  }
}

private _dispatchVersionMismatchNotification(backendVersion: string): void {
  this.dispatchEvent(
    new CustomEvent("hass-notification", {
      detail: {
        message: `Aurora version mismatch — Backend: ${backendVersion}, Card: ${CARD_VERSION}. Please reload.`,
        duration: -1,
        dismissable: true,
        action: {
          text: "Reload",
          action: () => {
            if ("caches" in window) {
              caches.keys().then(names => names.forEach(n => caches.delete(n)))
                .then(() => window.location.reload());
            } else {
              window.location.reload();
            }
          },
        },
      },
      bubbles: true,
      composed: true,
    })
  );
}
```

---

## 6. HACS Distribution — Integration + Card from Same Repo

### Repository Layout (Recommended)

```
aurora/                                    # GitHub repo root
├── custom_components/
│   └── aurora/
│       ├── __init__.py
│       ├── manifest.json
│       ├── config_flow.py
│       ├── const.py
│       ├── frontend/
│       │   ├── __init__.py
│       │   └── aurora-alarm-card.js       # built output
│       └── ...
├── src/                                   # TypeScript source (not shipped by HACS)
│   └── aurora-alarm-card.ts
├── dist/
│   └── aurora-alarm-card.js               # also put here for HACS plugin category
├── hacs.json
├── info.md                                # HACS display README (or set render_readme: true)
├── package.json
├── rollup.config.js
└── .github/
    └── workflows/
        ├── hassfest.yaml
        └── validate.yaml
```

### hacs.json

```json
{
  "name": "Aurora Alarm System",
  "render_readme": false,
  "zip_release": false,
  "filename": "aurora-alarm-card.js",
  "content_in_root": false
}
```

Field reference:
| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Display name in HACS UI |
| `render_readme` | No | `true` = render README.md in HACS instead of info.md |
| `zip_release` | No | `true` = HACS downloads from release ZIP asset instead of repo files |
| `filename` | No | Explicit JS filename override for plugin/dashboard detection |
| `content_in_root` | No | `true` = allow files in repo root (non-standard layout) |

### HACS Single-Category Constraint

HACS only supports **one category per repository**. You cannot submit the same repo as both Integration and Dashboard (Plugin) in the HACS default store. Options:

1. **Submit as Integration only** (recommended for Aurora) — users install via HACS as an integration; the card is bundled inside the integration package and auto-registered. No separate HACS card install needed.

2. **Separate repos** — one repo for the Python integration, one for the card. More maintenance overhead.

3. **Submit as both via custom repo** — users can add your repo twice in HACS custom repositories with different categories. Works but is not user-friendly.

**Best practice for Aurora**: Submit as Integration. The auto-registration mechanism in `async_setup` handles the card. Document clearly in README that no separate card installation is needed.

### Required GitHub Topics

For listing in the HACS default store:
- `home-assistant` (required)
- `hacs` (required)
- `homeassistant-custom-component` (for integration category)
- `lovelace-card` (for plugin/dashboard category — if submitting as plugin)

### info.md

This file is shown in the HACS UI (unless `render_readme: true`). Keep it concise:

```markdown
## Aurora Alarm System

A smart alarm integration for Home Assistant with a built-in Lovelace card.

### Installation

1. Install via HACS (Integration category)
2. Restart Home Assistant
3. Go to Settings → Integrations → Add Aurora
4. The Lovelace card is automatically registered — no separate card install needed!

### Card Usage

Add to your dashboard:
```yaml
type: custom:aurora-alarm-card
entity: alarm_control_panel.home
```
```

### GitHub Actions

`.github/workflows/hassfest.yaml`:
```yaml
name: Validate with hassfest
on:
  push:
  pull_request:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: home-assistant/actions/hassfest@master
```

`.github/workflows/validate.yaml`:
```yaml
name: Validate with HACS
on:
  push:
  pull_request:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: HACS validation
        uses: hacs/action@main
        with:
          category: integration
```

### Release / Tag Conventions

- Use semantic versioning: `v1.0.0`, `v1.2.3`
- GitHub Releases (not just tags) are preferred by HACS
- Keep `manifest.json` version in sync with Git tag version
- If using `zip_release: true`, the release ZIP must contain the expected files at root level

---

## 7. Known Gaps

- **`frontend.add_extra_js_url` exact deprecation timeline**: The search results confirm it exists and is less preferred; the exact HA version when it will be removed was not found. Use the `lovelace.resources` pattern instead to be safe.
- **`getConfigForm()` exact HA version introduced**: Confirmed present in 2026.6 docs; minimum HA version for this API (vs. `getConfigElement`) not precisely confirmed. Add a guard or document the minimum version.
- **HACS Plugin page details**: The HACS plugin publish page (`hacs.xyz/docs/publish/plugin/`) could not be fetched due to fetch restrictions. Information on plugin-specific hacs.json fields comes from search snippets and examples.
- **HA TypeScript type source**: The `custom-card-helpers` package types lag slightly behind HA's internal types. For cutting-edge HA 2026.x types, consider referencing `homeassistant/frontend` source directly or using ambient type declarations.
- **`subscribeEntityRegistry` and other `custom-card-helpers` subscribe helpers**: Confirmed they exist; exact signatures not verified against 2026.x. Test against your target HA version.

---

## 8. Sources

- [Custom card | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/)
- [Making HTTP path registration async safe (async_register_static_paths) | HA Dev Blog](https://developers.home-assistant.io/blog/2024/06/18/async_register_static_paths/)
- [Developer Guide: Embedded Lovelace Card in a HA Integration (KipK gist)](https://gist.github.com/KipK/3cf706ac89573432803aaa2f5ca40492)
- [Developer Guide: Embedded Lovelace Card — HA Community](https://community.home-assistant.io/t/developer-guide-embedded-lovelace-card-in-a-home-assistant-integration/974909)
- [custom-card-helpers GitHub](https://github.com/custom-cards/custom-card-helpers)
- [custom-card-helpers API docs](https://custom-cards.github.io/custom-card-helpers/)
- [ha-custom-card-rollup-ts-lit-starter (Rollup + TS + Lit starter)](https://github.com/grillp/ha-custom-card-rollup-ts-lit-starter)
- [Simplest custom card gist (thomasloven)](https://gist.github.com/thomasloven/1de8c62d691e754f95b023105fe4b74b)
- [HACS General publish requirements](https://www.hacs.xyz/docs/publish/start/)
- [HACS Integrations publish docs](https://www.hacs.xyz/docs/publish/integration/)
- [HACS Plugin (Dashboard) publish docs](https://hacs.xyz/docs/publish/plugin/)
- [HACS GitHub Action](https://www.hacs.xyz/docs/publish/action/)
- [home-assistant-js-websocket](https://github.com/home-assistant/home-assistant-js-websocket)
- [getConfigForm() community thread](https://community.home-assistant.io/t/getconfigform-configure-editor-for-custom-card/845004)
- [Vite 8 + Rolldown migration guide (2026)](https://www.nexgismo.com/blog/vite-8-rolldown-migration-guide-2026)
- [hacs/action GitHub repository](https://github.com/hacs/action)
