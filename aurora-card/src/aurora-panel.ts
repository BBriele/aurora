import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "./alarm-list";
import "./devices-view";
import "./ring-overlay";
import { auroraStyles } from "./theme";
import type { HomeAssistant } from "./types";

type Tab = "alarms" | "devices";

@customElement("aurora-panel")
export class AuroraPanel extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ type: Boolean }) narrow = false;
  @state() private _tab: Tab = "alarms";

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
        padding: 18px 22px 0;
        background: var(--primary-background-color, #f3f3f7);
      }
      .brand {
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tabs {
        display: flex;
        gap: 6px;
        padding: 14px 22px 0;
        position: sticky;
        top: 56px;
        background: var(--primary-background-color, #f3f3f7);
        z-index: 4;
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
    `,
  ];

  render(): TemplateResult {
    return html`
      <div class="bar">
        <div class="brand"><span>🌅</span><span class="grad-text">Aurora</span></div>
      </div>
      <div class="tabs">
        <button class="tab ${this._tab === "alarms" ? "on" : ""}" @click=${() => (this._tab = "alarms")}>
          Sveglie
        </button>
        <button class="tab ${this._tab === "devices" ? "on" : ""}" @click=${() => (this._tab = "devices")}>
          Dispositivi
        </button>
      </div>
      <div class="content">
        <div class="panel-card">
          ${this._tab === "alarms"
            ? html`<aurora-alarm-list .hass=${this.hass}></aurora-alarm-list>`
            : html`<aurora-devices-view .hass=${this.hass}></aurora-devices-view>`}
        </div>
      </div>
      <aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>
    `;
  }
}
