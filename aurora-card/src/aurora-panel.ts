import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "./alarm-list";
import "./ring-display";
import "./schedule-card";
import "./devices-view";
import "./globals-view";
import { getSettings } from "./api";
import { auroraStyles } from "./theme";
import { localize } from "./localize";
import type { HomeAssistant, Profiles } from "./types";

type Tab = "alarms" | "devices" | "globals";
const ALL = "__all__";

@customElement("aurora-panel")
export class AuroraPanel extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) route?: { path: string };
  // Set by ha-panel-custom; true when the sidebar is collapsed (mobile).
  @property({ type: Boolean }) narrow = false;

  @state() private _tab: Tab = "alarms";
  @state() private _selected = "";
  @state() private _profiles: Profiles = {};
  private _loaded = false;

  updated(): void {
    // The ring route renders only the info-only overlay; it never reads
    // profiles, so skip the settings fetch entirely on a pushed display.
    if (this.route?.path === "/ring") return;
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

  // Opens HA's sidebar. ha-panel-custom strips the app header, so on mobile the
  // only way back to other dashboards is this button firing the same event
  // HA's own ha-menu-button uses. composed:true crosses the shadow boundary.
  private _toggleMenu(): void {
    this.dispatchEvent(
      new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
    );
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
    if (this._selected === ALL) return localize(this.hass?.language, "panel.all");
    return this._names[this._selected] ?? this.hass.user?.name ?? localize(this.hass?.language, "panel.profile");
  }

  static styles = [
    auroraStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--primary-background-color, #f3f3f7);
      }
      /* Brand bar + tabs stick as ONE block — no magic per-element top offset,
         so nothing scrolls through a gap between them. */
      .header {
        position: sticky;
        top: 0;
        z-index: 4;
        background: var(--primary-background-color, #f3f3f7);
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 22px 6px;
      }
      .menu {
        appearance: none;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--aurora-text);
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        margin: -8px -2px -8px -10px;
        border-radius: 50%;
        flex: none;
      }
      .menu:hover {
        background: var(--aurora-surface);
      }
      .brand {
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .brand ha-icon {
        --mdc-icon-size: 26px;
        color: var(--aurora-accent);
      }
      /* Narrow: tighten the header so the brand + menu button stay compact. */
      @media (max-width: 480px) {
        .bar {
          padding: 12px 14px 4px;
          gap: 8px;
        }
        .brand {
          font-size: 1.2rem;
        }
        .tabs {
          padding: 8px 14px 0;
        }
        .content {
          padding: 14px 12px 80px;
        }
      }
      .tabs {
        display: flex;
        gap: 6px;
        padding: 8px 22px 8px;
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
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      /* The Alarms tab uses the full width on tablet/desktop. */
      .content.wide {
        width: 100%;
      }
      @media (min-width: 900px) {
        .content.wide {
          max-width: 1000px;
        }
      }
      @media (min-width: 1200px) {
        .content.wide {
          max-width: 1200px;
        }
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
    if (this.route?.path === "/ring") {
      return html`<aurora-ring-display .hass=${this.hass}></aurora-ring-display>`;
    }
    // Globals is admin-only; a non-admin never lands on it (e.g. stale state).
    const tab: Tab = this._tab === "globals" && !this._isAdmin ? "alarms" : this._tab;
    return html`
      <div class="header">
        <div class="bar">
          ${this.narrow
            ? html`<button
                class="menu"
                @click=${this._toggleMenu}
                aria-label=${localize(this.hass?.language, "panel.menu")}
              >
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
                </svg>
              </button>`
            : nothing}
          <div class="brand"><ha-icon icon="mdi:weather-sunset-up"></ha-icon><span class="grad-text">Aurora</span></div>
        </div>

        <div class="tabs">
          <button class="tab ${tab === "alarms" ? "on" : ""}" @click=${() => (this._tab = "alarms")}>
            ${localize(this.hass?.language, "panel.tab_alarms")}
          </button>
          <button class="tab ${tab === "devices" ? "on" : ""}" @click=${() => (this._tab = "devices")}>
            ${localize(this.hass?.language, "panel.tab_devices")}
          </button>
          ${this._isAdmin
            ? html`<button class="tab ${tab === "globals" ? "on" : ""}" @click=${() => (this._tab = "globals")}>
                ${localize(this.hass?.language, "panel.tab_globals")}
              </button>`
            : nothing}
        </div>
      </div>

      <div class="content wide">
        ${tab === "alarms"
          ? this._alarmsTab()
          : tab === "devices"
            ? this._setupTab()
            : html`<aurora-globals-view .hass=${this.hass}></aurora-globals-view>`}
      </div>
    `;
  }

  private _alarmsTab(): TemplateResult {
    const profileId = this._selected === ALL ? null : this._selected;
    const showAll = this._selected === ALL;
    return html`
      <aurora-schedule-card
        .hass=${this.hass}
        .profileId=${profileId}
        .showAll=${showAll}
      ></aurora-schedule-card>
      <aurora-alarm-list
        .hass=${this.hass}
        .profileId=${profileId}
        .showAll=${showAll}
      ></aurora-alarm-list>
    `;
  }

  private _setupTab(): TemplateResult {
    if (this._selected === ALL) {
      return html`<div class="panel-card">
        <div class="hint">${localize(this.hass?.language, "panel.select_profile")}</div>
      </div>`;
    }
    return html`<aurora-devices-view
      .hass=${this.hass}
      .userId=${this._selected}
      .userName=${this._selectedName}
    ></aurora-devices-view>`;
  }
}
