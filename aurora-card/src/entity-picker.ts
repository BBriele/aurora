import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { auroraStyles } from "./theme";
import type { HomeAssistant } from "./types";

/**
 * Friendly entity picker used for role bindings.
 * - single: a dropdown of friendly names (+ "Nessuno").
 * - multiple: chosen entities as removable pills + a searchable "Aggiungi…"
 *   dropdown of the remaining candidates (so long lists never overwhelm).
 * Emits a `change` event with the new value (string or string[]).
 */
@customElement("aurora-entity-picker")
export class AuroraEntityPicker extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) options: string[] = [];
  @property({ attribute: false }) value: string | string[] = "";
  @property({ type: Boolean }) multiple = false;

  private _name(id: string): string {
    return (this.hass?.states[id]?.attributes.friendly_name as string) || id;
  }

  private _sorted(ids: string[]): string[] {
    return [...ids].sort((a, b) => this._name(a).localeCompare(this._name(b)));
  }

  private _emit(value: string | string[]): void {
    this.dispatchEvent(new CustomEvent("change", { detail: value }));
  }

  static styles = [
    auroraStyles,
    css`
      select {
        width: 100%;
      }
      .none {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        font-style: italic;
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px 7px 13px;
        border-radius: 999px;
        color: #fff;
        background: var(--aurora-grad);
        font-size: 0.85rem;
        font-weight: 600;
        max-width: 100%;
      }
      .pill span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pill button {
        appearance: none;
        border: none;
        cursor: pointer;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.25);
        color: #fff;
        font-size: 13px;
        line-height: 1;
        flex: none;
      }
      .add {
        position: relative;
      }
      .add select {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
  ];

  render(): TemplateResult {
    if (!this.options.length) {
      return html`<div class="none">Nessuna entità compatibile trovata.</div>`;
    }
    return this.multiple ? this._renderMulti() : this._renderSingle();
  }

  private _renderSingle(): TemplateResult {
    const value = (this.value as string) || "";
    return html`
      <select
        .value=${value}
        @change=${(e: Event) => this._emit((e.target as HTMLSelectElement).value)}
      >
        <option value="" ?selected=${value === ""}>— Nessuno —</option>
        ${this._sorted(this.options).map(
          (id) => html`<option value=${id} ?selected=${id === value} title=${id}>
            ${this._name(id)}
          </option>`
        )}
      </select>
    `;
  }

  private _renderMulti(): TemplateResult {
    const value = (this.value as string[]) ?? [];
    const remaining = this._sorted(this.options.filter((id) => !value.includes(id)));
    return html`
      ${value.length
        ? html`<div class="pills">
            ${value.map(
              (id) => html`<div class="pill" title=${id}>
                <span>${this._name(id)}</span>
                <button @click=${() => this._emit(value.filter((x) => x !== id))}>✕</button>
              </div>`
            )}
          </div>`
        : nothing}
      ${remaining.length
        ? html`<div class="add">
            <select
              @change=${(e: Event) => {
                const sel = e.target as HTMLSelectElement;
                if (sel.value) {
                  this._emit([...value, sel.value]);
                  sel.value = "";
                }
              }}
            >
              <option value="">＋ Aggiungi…</option>
              ${remaining.map(
                (id) => html`<option value=${id} title=${id}>${this._name(id)}</option>`
              )}
            </select>
          </div>`
        : nothing}
    `;
  }
}
