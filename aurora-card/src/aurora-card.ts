import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "./alarm-list";
import "./ring-overlay";
import "./aurora-card-editor";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HassEntity, HomeAssistant } from "./types";

export interface AuroraCardConfig {
  type: string;
  title?: string;
  /** Show the ringing animation inside this card (opt-in). Legacy key:
   * ring_screen. Off by default. */
  ring_animation?: boolean;
  /** @deprecated use ring_animation */
  ring_screen?: boolean;
}

@customElement("aurora-card")
export class AuroraCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config: AuroraCardConfig = { type: "" };

  setConfig(config: AuroraCardConfig): void {
    this._config = config;
  }

  getCardSize(): number {
    return 6;
  }

  static getStubConfig(): Partial<AuroraCardConfig> {
    return { title: "Aurora", ring_animation: false };
  }

  private get _ringAnimation(): boolean {
    return this._config.ring_animation ?? this._config.ring_screen ?? false;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("aurora-card-editor");
  }

  /**
   * The next-alarm sensor's entity_id is locale-dependent (has_entity_name +
   * translation_key → e.g. sensor.aurora_prossima_sveglia in Italian), so we
   * never hardcode the English slug. Match the timestamp sensor under Aurora.
   */
  private _nextAlarmState(): HassEntity | undefined {
    const states = this.hass?.states ?? {};
    return Object.values(states).find(
      (s) =>
        s.entity_id.startsWith("sensor.aurora") &&
        s.attributes?.device_class === "timestamp"
    );
  }

  private _hero(): TemplateResult {
    const next = this._nextAlarmState();
    const valid = next && next.state && !["unknown", "unavailable"].includes(next.state);
    let time = "—";
    let sub = localize(this.hass?.language, "card.no_alarm");
    if (valid) {
      const dt = new Date(next.state);
      time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      sub = this._relative(dt);
      const label = next.attributes?.["label"] as string | undefined;
      if (label) sub = `${label} · ${sub}`;
    }
    return html`
      <div class="hero">
        <div class="hero-k">${localize(this.hass?.language, "card.next_alarm")}</div>
        <div class="hero-time clock">${time}</div>
        <div class="hero-sub">${sub}</div>
      </div>
    `;
  }

  private _relative(dt: Date): string {
    const lang = this.hass?.language;
    const diff = dt.getTime() - Date.now();
    if (diff <= 0) return localize(lang, "rel.now");
    const mins = Math.round(diff / 60000);
    if (mins < 60) return localize(lang, "rel.in_min", { n: mins });
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs < 24) return rem
      ? localize(lang, "rel.in_hm", { h: hrs, m: rem })
      : localize(lang, "rel.in_h", { h: hrs });
    const days = Math.round(hrs / 24);
    return days === 1
      ? localize(lang, "rel.in_day")
      : localize(lang, "rel.in_days", { n: days });
  }

  static styles = [
    auroraStyles,
    css`
      ha-card {
        overflow: hidden;
      }
      .wrap {
        padding: 0 0 16px;
      }
      .hero {
        position: relative;
        padding: 26px 22px 30px;
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        overflow: hidden;
      }
      .hero::after {
        content: "";
        position: absolute;
        right: -40px;
        top: -60px;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--aurora-on-accent) 16%, transparent),
          transparent 70%
        );
      }
      .hero-k {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.72rem;
        opacity: 0.85;
      }
      .hero-time {
        font-size: 4rem;
        margin: 2px 0 2px;
      }
      .hero-sub {
        opacity: 0.92;
        font-weight: 500;
      }
      .card-title {
        padding: 14px 18px 0;
        font-weight: 700;
        font-size: 1.05rem;
      }
      .body {
        padding: 18px 16px 0;
      }
      .open {
        display: block;
        text-align: center;
        margin-top: 16px;
        text-decoration: none;
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.hass) return nothing;
    return html`
      <ha-card>
        <div class="wrap">
          ${this._config.title
            ? html`<div class="card-title">${this._config.title}</div>`
            : nothing}
          ${this._hero()}
          <div class="body">
            <aurora-alarm-list
              .hass=${this.hass}
              .profileId=${this.hass.user?.id ?? null}
            ></aurora-alarm-list>
            <a class="open" href="/aurora">${localize(this.hass?.language, "card.open_app")}</a>
          </div>
        </div>
        ${this._ringAnimation
          ? html`<aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>`
          : nothing}
      </ha-card>
    `;
  }
}
