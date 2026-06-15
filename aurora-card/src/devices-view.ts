import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { getRoleEntities, getSettings, setSettings } from "./api";
import { auroraStyles } from "./theme";
import {
  ROLE_LABELS,
  type HomeAssistant,
  type Profiles,
  type RoleEntities,
} from "./types";

const SINGLE_ROLES = ["audio_sink", "wake_light", "display_surface", "conversation", "tts"];
const MULTI_ROLES = ["notify_channel", "sleep_signal", "presence_signal"];

/** Per-user device bindings editor. Edits options.profiles[userId].bindings. */
@customElement("aurora-devices-view")
export class AuroraDevicesView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) userId = "";
  @property({ attribute: false }) userName = "";

  @state() private _entities?: RoleEntities;
  @state() private _bindings: Record<string, unknown> = {};
  @state() private _saving = false;
  @state() private _saved = false;
  private _profiles: Profiles = {};
  private _loadedFor = "";

  updated(): void {
    if (this.hass && this.userId && this._loadedFor !== this.userId) {
      this._loadedFor = this.userId;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    const [entities, settings] = await Promise.all([
      getRoleEntities(this.hass),
      getSettings(this.hass),
    ]);
    this._entities = entities;
    this._profiles = (settings.options.profiles as Profiles) ?? {};
    this._bindings = { ...(this._profiles[this.userId]?.bindings ?? {}) };
    this._saved = false;
  }

  private _set(key: string, value: unknown): void {
    this._bindings = { ...this._bindings, [key]: value };
    this._saved = false;
  }

  private _toggleMulti(key: string, entity: string): void {
    const cur = new Set((this._bindings[key] as string[]) ?? []);
    if (cur.has(entity)) cur.delete(entity);
    else cur.add(entity);
    this._set(key, [...cur]);
  }

  private async _save(): Promise<void> {
    this._saving = true;
    try {
      const bindings = Object.fromEntries(
        Object.entries(this._bindings).filter(
          ([, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
        )
      );
      const profiles: Profiles = {
        ...this._profiles,
        [this.userId]: { name: this.userName || this.userId, bindings },
      };
      const res = await setSettings(this.hass, { profiles });
      this._profiles = (res.options.profiles as Profiles) ?? profiles;
      this._saved = true;
    } finally {
      this._saving = false;
    }
  }

  static styles = [
    auroraStyles,
    css`
      .intro {
        color: var(--aurora-dim);
        margin: 0 0 18px;
        line-height: 1.5;
      }
      .who {
        font-weight: 700;
        color: var(--aurora-text);
      }
      .role {
        padding: 14px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .role .field {
        margin-bottom: 8px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        padding: 8px 12px;
        border-radius: 999px;
        background: transparent;
        color: var(--aurora-dim);
      }
      .chip.on {
        color: #fff;
        background: var(--aurora-grad);
        border-color: transparent;
      }
      .none {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        font-style: italic;
      }
      .savebar {
        position: sticky;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 16px;
      }
      .ok {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
  ];

  render(): TemplateResult {
    if (!this._entities) {
      return html`<div class="intro">Caricamento dispositivi…</div>`;
    }
    return html`
      <p class="intro">
        Dispositivi di <span class="who">${this.userName || "questo profilo"}</span>.
        Ogni campo è opzionale — lascia vuoto un ruolo e Aurora salta quella
        funzione. L'orario esatto è sempre garantito.
      </p>
      ${SINGLE_ROLES.map((role) => this._single(role))}
      ${MULTI_ROLES.map((role) => this._multi(role))}
      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? "Salvataggio…" : "Salva i miei dispositivi"}
        </button>
        ${this._saved ? html`<span class="ok">✓ Salvato</span>` : nothing}
      </div>
    `;
  }

  private _single(role: string): TemplateResult {
    const opts = this._entities!.roles[role] ?? [];
    const value = (this._bindings[role] as string) ?? "";
    return html`
      <div class="role">
        <label class="field">${ROLE_LABELS[role] ?? role}</label>
        ${opts.length === 0
          ? html`<div class="none">Nessuna entità compatibile trovata.</div>`
          : html`<select
              .value=${value}
              @change=${(e: Event) => this._set(role, (e.target as HTMLSelectElement).value)}
            >
              <option value="" ?selected=${value === ""}>— Nessuno —</option>
              ${opts.map(
                (e) => html`<option value=${e} ?selected=${e === value}>${e}</option>`
              )}
            </select>`}
      </div>
    `;
  }

  private _multi(role: string): TemplateResult {
    const opts = this._entities!.roles[role] ?? [];
    const value = new Set((this._bindings[role] as string[]) ?? []);
    return html`
      <div class="role">
        <label class="field">${ROLE_LABELS[role] ?? role}</label>
        ${opts.length === 0
          ? html`<div class="none">Nessuna entità compatibile trovata.</div>`
          : html`<div class="chips">
              ${opts.map(
                (e) => html`<button
                  class="chip ${value.has(e) ? "on" : ""}"
                  @click=${() => this._toggleMulti(role, e)}
                >
                  ${e}
                </button>`
              )}
            </div>`}
      </div>
    `;
  }
}
