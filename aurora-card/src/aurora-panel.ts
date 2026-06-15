import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "./alarm-list";
import "./devices-view";
import "./globals-view";
import "./ring-overlay";
import { getSettings } from "./api";
import { auroraStyles } from "./theme";
import type { HomeAssistant, Profiles } from "./types";

type Tab = "alarms" | "devices" | "globals";
const ALL = "__all__";

@customElement("aurora-panel")
export class AuroraPanel extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ type: Boolean }) narrow = false;

  @state() private _tab: Tab = "alarms";
  @state() private _selected = "";
  @state() private _profiles: Profiles = {};
  private _loaded = false;

  updated(): void {
    if (this.hass && !this._loaded) {
      this._loaded = true;
      this._selected = this.hass.user?.id ?? "";
      void this._loadProfiles();
    }
  }

  private async _loadProfiles(): Promise<void> {
    try {
      const settings = await getSettings(this.hass);
      this._profiles = (settings.options.profiles as Profiles) ?? {};
    } catch {
      this._profiles = {};
    }
  }

  private get _isAdmin(): boolean {
    return this.hass.user?.is_admin ?? false;
  }

  private get _names(): Record<string, string> {
    const me = this.hass.user;
    const names: Record<string, string> = {};
    for (const [id, p] of Object.entries(this._profiles)) names[id] = p.name || id;
    if (me) names[me.id] = me.name;
    return names;
  }

  private get _selectedName(): string {
    if (this._selected === ALL) return "Tutti";
    return this._names[this._selected] ?? this.hass.user?.name ?? "Profilo";
  }

  static styles = [
    auroraStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--primary-background-color, #f3f3f7);
      }
      .bar {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 22px 6px;
        background: var(--primary-background-color, #f3f3f7);
      }
      .brand {
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .who {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--aurora-dim);
        font-weight: 600;
      }
      .who select {
        width: auto;
        padding: 6px 10px;
      }
      .avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--aurora-grad);
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 0.85rem;
      }
      .tabs {
        display: flex;
        gap: 6px;
        padding: 8px 22px 0;
        position: sticky;
        top: 60px;
        background: var(--primary-background-color, #f3f3f7);
        z-index: 4;
        flex-wrap: wrap;
      }
      .tab {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        padding: 10px 16px;
        border-radius: 999px;
        color: var(--aurora-dim);
        background: transparent;
      }
      .tab.on {
        color: var(--aurora-text);
        background: var(--aurora-surface);
        box-shadow: var(--aurora-shadow);
      }
      .content {
        max-width: 760px;
        margin: 0 auto;
        padding: 18px 18px 80px;
      }
      .panel-card {
        background: var(--aurora-surface);
        border-radius: var(--aurora-radius);
        padding: 20px;
        border: 1px solid var(--aurora-divider);
      }
      .hint {
        color: var(--aurora-dim);
        padding: 8px 2px;
      }
    `,
  ];

  render(): TemplateResult {
    if (!this.hass) return html`${nothing}`;
    const initial = (this._selectedName[0] ?? "A").toUpperCase();
    return html`
      <div class="bar">
        <div class="brand"><span>🌅</span><span class="grad-text">Aurora</span></div>
        <div class="who">
          ${this._isAdmin
            ? html`<select
                .value=${this._selected}
                @change=${(e: Event) =>
                  (this._selected = (e.target as HTMLSelectElement).value)}
              >
                ${Object.entries(this._names).map(
                  ([id, name]) => html`<option value=${id} ?selected=${id === this._selected}>
                    ${name}
                  </option>`
                )}
                <option value=${ALL} ?selected=${this._selected === ALL}>Tutti</option>
              </select>`
            : html`<span>${this._selectedName}</span>`}
          <div class="avatar">${initial}</div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab ${this._tab === "alarms" ? "on" : ""}" @click=${() => (this._tab = "alarms")}>
          Sveglie
        </button>
        <button class="tab ${this._tab === "devices" ? "on" : ""}" @click=${() => (this._tab = "devices")}>
          Dispositivi
        </button>
        <button class="tab ${this._tab === "globals" ? "on" : ""}" @click=${() => (this._tab = "globals")}>
          Globali
        </button>
      </div>

      <div class="content">
        <div class="panel-card">${this._tabContent()}</div>
      </div>
      <aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>
    `;
  }

  private _tabContent(): TemplateResult {
    if (this._tab === "globals") {
      return html`<aurora-globals-view .hass=${this.hass}></aurora-globals-view>`;
    }
    if (this._tab === "devices") {
      if (this._selected === ALL) {
        return html`<div class="hint">Seleziona un profilo per configurarne i dispositivi.</div>`;
      }
      return html`<aurora-devices-view
        .hass=${this.hass}
        .userId=${this._selected}
        .userName=${this._selectedName}
      ></aurora-devices-view>`;
    }
    // alarms
    return html`<aurora-alarm-list
      .hass=${this.hass}
      .profileId=${this._selected === ALL ? null : this._selected}
      .showAll=${this._selected === ALL}
    ></aurora-alarm-list>`;
  }
}
