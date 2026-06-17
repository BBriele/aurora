import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HassEntity, HomeAssistant } from "./types";

/**
 * Info-only wake overlay rendered fullscreen on a pushed display (/aurora/ring).
 * It shows the time, the alarm label and a sunrise gradient — NO buttons, no
 * mission, no interaction. It is a software sunrise lamp, not an alarm control.
 */
@customElement("aurora-ring-display")
export class AuroraRingDisplay extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _now = new Date();
  private _timer?: number;

  connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => (this._now = new Date()), 1000);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) window.clearInterval(this._timer);
  }

  private get _sensor(): HassEntity | undefined {
    return Object.values(this.hass?.states ?? {}).find((e) =>
      e.entity_id.startsWith("binary_sensor.aurora")
    );
  }
  private get _ringing(): boolean {
    return this._sensor?.state === "on";
  }
  private get _label(): string {
    return (this._sensor?.attributes?.["label"] as string | undefined) ?? "";
  }

  static styles = [
    auroraStyles,
    css`
      .screen {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        color: #fff;
        overflow: hidden;
        background: #14122a;
      }
      .sky {
        position: absolute;
        inset: 0;
        background: radial-gradient(120% 80% at 50% 118%,
          #ffd27a 0%, #f0883e 22%, #a44a86 48%, #3a2a6b 72%, #14122a 100%);
        animation: rise 7s ease-out both;
      }
      .content { position: relative; text-align: center; }
      .big { font-size: clamp(5rem, 22vw, 14rem); text-shadow: 0 6px 40px rgba(0,0,0,.35); }
      .label { font-size: 1.4rem; letter-spacing: .16em; text-transform: uppercase; opacity: .9; }
      .idle { opacity: .5; font-size: 1.1rem; }
      @keyframes rise { from { filter: brightness(.3) saturate(.8); } to { filter: brightness(1); } }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.hass) return nothing;
    const hh = String(this._now.getHours()).padStart(2, "0");
    const mm = String(this._now.getMinutes()).padStart(2, "0");
    if (!this._ringing) {
      return html`<div class="screen"><div class="content">
        <div class="big clock">${hh}:${mm}</div>
      </div></div>`;
    }
    return html`<div class="screen">
      <div class="sky"></div>
      <div class="content">
        <div class="big clock">${hh}:${mm}</div>
        <div class="label">${this._label || localize(this.hass?.language, "ring.label")}</div>
      </div>
    </div>`;
  }
}
