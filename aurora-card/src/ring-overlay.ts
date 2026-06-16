import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { ringAction } from "./api";
import { localize } from "./localize";
import "./mission-overlay";
import { needsChallenge } from "./missions";
import { auroraStyles } from "./theme";
import type { HassEntity, HomeAssistant, MissionType } from "./types";

@customElement("aurora-ring-overlay")
export class AuroraRingOverlay extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _now = new Date();
  @state() private _showMission = false;
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

  private get _mission(): {
    type: MissionType;
    params?: Record<string, unknown>;
    vision_prompt?: string | null;
  } {
    const m = this._sensor?.attributes?.mission as
      | { type: MissionType; params?: Record<string, unknown>; vision_prompt?: string | null }
      | undefined;
    return m ?? { type: "tap" };
  }

  private get _alarmId(): string | null {
    return (this._sensor?.attributes?.alarm_id as string | undefined) ?? null;
  }

  static styles = [
    auroraStyles,
    css`
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: grid;
        place-items: center;
        color: #fff;
        overflow: hidden;
        background: #14122a;
      }
      .sky {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(120% 80% at 50% 118%, #ffd27a 0%, #f0883e 22%, #a44a86 48%, #3a2a6b 72%, #14122a 100%);
        animation: rise 7s ease-out both;
      }
      .sun {
        position: absolute;
        left: 50%;
        bottom: -34vh;
        width: 64vh;
        height: 64vh;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(circle, #fff3d0 0%, #ffd27a 38%, rgba(255, 210, 122, 0) 70%);
        animation: sunrise 7s ease-out both;
        filter: blur(2px);
      }
      .content {
        position: relative;
        text-align: center;
        padding: 24px;
        animation: fadein 0.6s ease both;
      }
      .big {
        font-size: clamp(4rem, 18vw, 11rem);
        text-shadow: 0 6px 40px rgba(0, 0, 0, 0.35);
      }
      .label {
        font-size: 1.3rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        opacity: 0.92;
        margin-top: 4px;
      }
      .actions {
        margin-top: 40px;
        display: flex;
        gap: 18px;
        justify-content: center;
      }
      .big-btn {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 1.1rem;
        padding: 18px 34px;
        border-radius: 999px;
        backdrop-filter: blur(6px);
        transition: transform 0.12s ease;
      }
      .big-btn:active {
        transform: scale(0.95);
      }
      .stop {
        color: #2a1840;
        background: #fff;
      }
      .snooze {
        color: #fff;
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.4);
      }
      @keyframes rise {
        from {
          filter: brightness(0.35) saturate(0.8);
        }
        to {
          filter: brightness(1) saturate(1);
        }
      }
      @keyframes sunrise {
        from {
          transform: translateX(-50%) translateY(34vh);
          opacity: 0.2;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      @keyframes fadein {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
      }
    `,
  ];

  private _dismiss(): void {
    this._showMission = false;
    ringAction(this.hass, "dismiss");
  }

  private _onStop(): void {
    // A real mission must be solved first; tap/none dismiss immediately.
    if (needsChallenge(this._mission.type)) {
      this._showMission = true;
    } else {
      this._dismiss();
    }
  }

  updated(): void {
    // Close the mission overlay once the ring is gone (don't mutate in render()).
    if (!this._ringing && this._showMission) this._showMission = false;
  }

  render(): TemplateResult | typeof nothing {
    if (!this._ringing) return nothing;
    const hh = String(this._now.getHours()).padStart(2, "0");
    const mm = String(this._now.getMinutes()).padStart(2, "0");
    const challenge = needsChallenge(this._mission.type);
    return html`
      <div class="overlay">
        <div class="sky"></div>
        <div class="sun"></div>
        <div class="content">
          ${this._showMission
            ? html`<aurora-mission-overlay
                .hass=${this.hass}
                .mission=${this._mission}
                .alarmId=${this._alarmId}
                @solved=${this._dismiss}
              ></aurora-mission-overlay>`
            : html`
                <div class="big clock">${hh}:${mm}</div>
                <div class="label">${localize(this.hass?.language, "ring.label")}</div>
                <div class="actions">
                  <button class="big-btn snooze" @click=${() => ringAction(this.hass, "snooze")}>
                    ${localize(this.hass?.language, "ring.snooze")}
                  </button>
                  <button class="big-btn stop" @click=${this._onStop}>
                    ${challenge
                      ? localize(this.hass?.language, "ring.start_mission")
                      : localize(this.hass?.language, "ring.stop")}
                  </button>
                </div>
              `}
          ${this._showMission
            ? html`<div class="actions">
                <button class="big-btn snooze" @click=${() => (this._showMission = false)}>
                  ${localize(this.hass?.language, "missionui.back")}
                </button>
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }
}
