import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { auroraStyles } from "./theme";
import { WEEKDAY_LETTERS } from "./types";

@customElement("aurora-weekday-chips")
export class AuroraWeekdayChips extends LitElement {
  @property({ attribute: false }) value: number[] = [];

  static styles = [
    auroraStyles,
    css`
      .chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .chip {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: var(--aurora-dim);
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
        transition: transform 0.12s ease, background 0.2s ease, color 0.2s ease;
      }
      .chip:active {
        transform: scale(0.9);
      }
      .chip.on {
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        box-shadow: var(--aurora-shadow);
      }
    `,
  ];

  private _toggle(day: number): void {
    const set = new Set(this.value);
    if (set.has(day)) {
      set.delete(day);
    } else {
      set.add(day);
    }
    this.value = [...set].sort((a, b) => a - b);
    this.dispatchEvent(new CustomEvent("change", { detail: this.value }));
  }

  render(): TemplateResult {
    return html`
      <div class="chips">
        ${WEEKDAY_LETTERS.map(
          (letter, i) => html`
            <button
              type="button"
              class="chip ${this.value.includes(i) ? "on" : ""}"
              @click=${() => this._toggle(i)}
            >
              ${letter}
            </button>
          `
        )}
      </div>
    `;
  }
}
