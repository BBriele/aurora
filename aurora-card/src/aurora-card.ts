import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "./alarm-list";
import "./ring-overlay";
import { auroraStyles } from "./theme";
import type { HassEntity, HomeAssistant } from "./types";

interface AuroraCardConfig {
  type: string;
  title?: string;
  compact?: boolean;
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
    return { title: "Aurora" };
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
    let sub = "Nessuna sveglia programmata";
    if (valid) {
      const dt = new Date(next.state);
      time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      sub = this._relative(dt);
      const label = next.attributes?.["label"] as string | undefined;
      if (label) sub = `${label} · ${sub}`;
    }
    return html`
      <div class="hero">
        <div class="hero-k">Prossima sveglia</div>
        <div class="hero-time clock">${time}</div>
        <div class="hero-sub">${sub}</div>
      </div>
    `;
  }

  private _relative(dt: Date): string {
    const diff = dt.getTime() - Date.now();
    if (diff <= 0) return "ora";
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `tra ${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs < 24) return `tra ${hrs}h${rem ? ` ${rem}m` : ""}`;
    const days = Math.round(hrs / 24);
    return `tra ${days} ${days === 1 ? "giorno" : "giorni"}`;
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
            <a class="open" href="/aurora">Apri l'app Aurora →</a>
          </div>
        </div>
      </ha-card>
      <aurora-ring-overlay .hass=${this.hass}></aurora-ring-overlay>
    `;
  }
}
