import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { getRoleEntities, getSettings, setSettings } from "./api";
import { auroraStyles } from "./theme";
import { ROLE_LABELS, type HomeAssistant, type RoleEntities } from "./types";

const SINGLE_ROLES = ["audio_sink", "wake_light", "display_surface", "conversation", "tts"];
const MULTI_ROLES = ["notify_channel", "sleep_signal", "presence_signal"];

@customElement("aurora-devices-view")
export class AuroraDevicesView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _entities?: RoleEntities;
  @state() private _options: Record<string, unknown> = {};
  @state() private _saving = false;
  @state() private _saved = false;
  private _loaded = false;

  updated(): void {
    if (this.hass && !this._loaded) {
      this._loaded = true;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    const [entities, settings] = await Promise.all([
      getRoleEntities(this.hass),
      getSettings(this.hass),
    ]);
    this._entities = entities;
    this._options = { ...settings.options };
  }

  private _set(key: string, value: unknown): void {
    this._options = { ...this._options, [key]: value };
    this._saved = false;
  }

  private _toggleMulti(key: string, entity: string): void {
    const cur = new Set((this._options[key] as string[]) ?? []);
    if (cur.has(entity)) cur.delete(entity);
    else cur.add(entity);
    this._set(key, [...cur]);
  }

  private async _save(): Promise<void> {
    this._saving = true;
    try {
      const res = await setSettings(this.hass, this._options);
      this._options = { ...res.options };
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
        margin-top: 8px;
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
    const ringMin = Math.round(Number(this._options["ring_max_duration"] ?? 600) / 60);
    return html`
      <p class="intro">
        Collega i ruoli astratti ai tuoi dispositivi. Ogni campo è opzionale —
        lascia vuoto un ruolo e Aurora salta quella funzione. L'orario esatto è
        sempre garantito.
      </p>

      ${SINGLE_ROLES.map((role) => this._single(role))}
      ${MULTI_ROLES.map((role) => this._multi(role))}

      <div class="role">
        <label class="field">Durata massima suoneria (min)</label>
        <input
          type="number"
          min="1"
          max="60"
          style="max-width:140px"
          .value=${String(ringMin)}
          @input=${(e: Event) =>
            this._set("ring_max_duration", Number((e.target as HTMLInputElement).value) * 60)}
        />
      </div>

      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? "Salvataggio…" : "Salva"}
        </button>
        ${this._saved ? html`<span class="ok">✓ Salvato</span>` : nothing}
      </div>
    `;
  }

  private _single(role: string): TemplateResult {
    const opts = this._entities!.roles[role] ?? [];
    const value = (this._options[role] as string) ?? "";
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
    const value = new Set((this._options[role] as string[]) ?? []);
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
