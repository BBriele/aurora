import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { AuroraCardConfig } from "./aurora-card";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HomeAssistant } from "./types";

/**
 * Visual editor for the Aurora dashboard card. Exposes the card title and the
 * "ring animation" opt-in: whether this card shows the in-card ringing
 * animation when an alarm rings (off by default).
 */
@customElement("aurora-card-editor")
export class AuroraCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config: AuroraCardConfig = { type: "custom:aurora-card" };

  setConfig(config: AuroraCardConfig): void {
    this._config = config;
  }

  private _emit(patch: Partial<AuroraCardConfig>): void {
    const next = { ...this._config, ...patch };
    this._config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next },
        bubbles: true,
        composed: true,
      })
    );
  }

  static styles = [
    auroraStyles,
    css`
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 4px 2px;
      }
      .togglerow {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .togglerow .t {
        flex: 1;
      }
      .togglerow .sub {
        font-size: 0.8rem;
        color: var(--aurora-dim);
        margin-top: 2px;
        line-height: 1.4;
      }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.hass) return nothing;
    const lang = this.hass.language;
    return html`
      <div class="form">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ text: {} }}
          .label=${localize(lang, "carded.title")}
          .value=${this._config.title ?? ""}
          @value-changed=${(e: CustomEvent) => this._emit({ title: (e.detail.value as string) ?? "" })}
        ></ha-selector>

        <div class="togglerow">
          <ha-switch
            .checked=${this._config.ring_animation ?? this._config.ring_screen ?? false}
            @change=${(e: Event) =>
              this._emit({ ring_animation: (e.target as HTMLInputElement).checked })}
          ></ha-switch>
          <div class="t">
            ${localize(lang, "carded.ring_animation")}
            <div class="sub">${localize(lang, "carded.ring_animation_desc")}</div>
          </div>
        </div>
      </div>
    `;
  }
}
