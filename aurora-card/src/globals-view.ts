import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { getRoleEntities, getSettings, setSettings } from "./api";
import "./entity-picker";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HomeAssistant, RoleEntities } from "./types";

/** Shared, installation-wide settings (not per-user). */
@customElement("aurora-globals-view")
export class AuroraGlobalsView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _entities?: RoleEntities;
  @state() private _options: Record<string, unknown> = {};
  @state() private _saving = false;
  @state() private _saved = false;
  private _loaded = false;

  updated(): void {
    if (this.hass && !this._loaded) {
      this._loaded = true;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    const [entities, settings] = await Promise.all([
      getRoleEntities(this.hass),
      getSettings(this.hass),
    ]);
    this._entities = entities;
    this._options = { ...settings.options };
  }

  private _setOption(key: string, value: unknown): void {
    this._options = { ...this._options, [key]: value };
    this._saved = false;
  }

  private async _save(): Promise<void> {
    this._saving = true;
    try {
      const res = await setSettings(this.hass, {
        ring_max_duration: this._options["ring_max_duration"] ?? 600,
        skip_calendars: this._options["skip_calendars"] ?? [],
        holiday_calendars: this._options["holiday_calendars"] ?? [],
        weather: this._options["weather"] ?? "",
        briefing_calendars: this._options["briefing_calendars"] ?? [],
        todo_lists: this._options["todo_lists"] ?? [],
      });
      this._options = { ...res.options };
      this._saved = true;
    } catch (err) {
      this._saved = false;
      throw err;
    } finally {
      this._saving = false;
    }
  }

  static styles = [
    auroraStyles,
    css`
      .intro {
        color: var(--aurora-dim);
        margin: 0 0 18px;
        line-height: 1.5;
      }
      .block {
        padding: 14px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .block .field {
        margin-bottom: 8px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        padding: 8px 12px;
        border-radius: 999px;
        background: transparent;
        color: var(--aurora-dim);
      }
      .chip.on {
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        border-color: transparent;
      }
      .none {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        font-style: italic;
      }
      .savebar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 16px;
      }
      .ok {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
  ];

  render(): TemplateResult {
    if (!this._entities) {
      return html`<div class="intro">${localize(this.hass?.language, "common.loading")}</div>`;
    }
    const ringMin = Math.round(Number(this._options["ring_max_duration"] ?? 600) / 60);
    return html`
      <p class="intro">${localize(this.hass?.language, "globals.intro")}</p>

      <div class="block">
        <label class="field">${localize(this.hass?.language, "globals.ring_max")}</label>
        <input
          type="number"
          min="1"
          max="60"
          style="max-width:140px"
          .value=${String(ringMin)}
          @input=${(e: Event) => {
            this._options = {
              ...this._options,
              ring_max_duration: Number((e.target as HTMLInputElement).value) * 60,
            };
            this._saved = false;
          }}
        />
      </div>

      ${this._calendars("skip_calendars", localize(this.hass?.language, "globals.skip_calendars"))}
      ${this._calendars("holiday_calendars", localize(this.hass?.language, "globals.holiday_calendars"))}

      <p class="intro" style="margin-top:22px">
        ${localize(this.hass?.language, "globals.briefing_intro")}
      </p>
      ${this._picker(
        "weather",
        localize(this.hass?.language, "globals.weather"),
        this._entities.weather ?? [],
        false
      )}
      ${this._picker(
        "briefing_calendars",
        localize(this.hass?.language, "globals.briefing_calendars"),
        this._entities.calendars ?? [],
        true
      )}
      ${this._picker("todo_lists", localize(this.hass?.language, "globals.todo_lists"), this._entities.todo ?? [], true)}

      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? localize(this.hass?.language, "common.saving") : localize(this.hass?.language, "globals.save")}
        </button>
        ${this._saved ? html`<span class="ok">${localize(this.hass?.language, "common.saved")}</span>` : nothing}
      </div>
    `;
  }

  private _calendars(key: string, label: string): TemplateResult {
    return this._picker(key, label, this._entities!.calendars ?? [], true);
  }

  private _picker(
    key: string,
    label: string,
    options: string[],
    multiple: boolean
  ): TemplateResult {
    return html`
      <div class="block">
        <label class="field">${label}</label>
        <aurora-entity-picker
          .hass=${this.hass}
          .options=${options}
          .value=${multiple
            ? ((this._options[key] as string[]) ?? [])
            : ((this._options[key] as string) ?? "")}
          .multiple=${multiple}
          @change=${(e: CustomEvent<string | string[]>) =>
            this._setOption(key, e.detail)}
        ></aurora-entity-picker>
      </div>
    `;
  }
}
