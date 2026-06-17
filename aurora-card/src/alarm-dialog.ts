import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { createAlarm, updateAlarm } from "./api";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import "./weekday-chips";
import {
  BRIEFING_BLOCKS,
  MISSION_TYPES,
  type Alarm,
  type BriefingBlock,
  type HomeAssistant,
  type MissionType,
  type RepeatMode,
} from "./types";

const REPEATS: RepeatMode[] = ["once", "daily", "weekly"];

// mdi:close — inlined so the bundle needs no mdi import.
const MDI_CLOSE =
  "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";

@customElement("aurora-alarm-dialog")
export class AuroraAlarmDialog extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) alarm: Alarm | null = null;
  @property({ attribute: false }) profileId: string | null = null;
  @property({ type: Boolean }) open = false;

  @state() private _time = "07:00";
  @state() private _label = "";
  @state() private _repeat: RepeatMode = "daily";
  @state() private _days: number[] = [0, 1, 2, 3, 4];
  @state() private _mission: MissionType = "tap";
  @state() private _missionParams: Record<string, unknown> = {};
  @state() private _snoozeMax = 3;
  @state() private _snoozeMin = 9;
  @state() private _audioSource = "";
  @state() private _audioFade = true;
  @state() private _light = false;
  @state() private _lightMin = 30;
  @state() private _smart = false;
  @state() private _smartMin = 30;
  @state() private _briefing = false;
  @state() private _briefingBlocks: string[] = [...BRIEFING_BLOCKS];
  @state() private _enabled = true;
  @state() private _saving = false;

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("open") && this.open) {
      this._populate();
    }
  }

  private _populate(): void {
    const a = this.alarm;
    this._time = a?.time ?? "07:00";
    this._label = a?.label ?? "";
    this._repeat = a?.schedule.repeat_mode ?? "daily";
    this._days = a?.schedule.weekdays?.length ? [...a.schedule.weekdays] : [0, 1, 2, 3, 4];
    this._mission = a?.features.mission.type ?? "tap";
    this._missionParams = { ...(a?.features.mission.params ?? {}) };
    this._snoozeMax = a?.features.snooze.max ?? 3;
    this._snoozeMin = a ? Math.round((a.features.snooze.duration ?? 540) / 60) : 9;
    this._audioSource = a?.features.audio.source ?? "";
    this._audioFade = a ? a.features.audio.volume_profile === "fade_in" : true;
    this._light = a?.features.light.enabled ?? false;
    this._lightMin = a?.features.light.duration_min ?? 30;
    this._smart = a?.features.smart_window.enabled ?? false;
    this._smartMin = a?.features.smart_window.minutes ?? 30;
    this._briefing = a?.features.briefing.enabled ?? false;
    this._briefingBlocks = a?.features.briefing.blocks?.length
      ? [...a.features.briefing.blocks]
      : [...BRIEFING_BLOCKS];
    this._enabled = a?.enabled ?? true;
    this._saving = false;
  }

  private _close(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.dispatchEvent(new CustomEvent("closed"));
  }

  private _toggleBlock(block: BriefingBlock): void {
    this._briefingBlocks = this._briefingBlocks.includes(block)
      ? this._briefingBlocks.filter((b) => b !== block)
      : [...this._briefingBlocks, block];
  }

  private _setParam(key: string, value: unknown): void {
    this._missionParams = { ...this._missionParams, [key]: value };
  }

  private _missionParamsBlock(): TemplateResult | typeof nothing {
    const lang = this.hass?.language;
    const p = this._missionParams;
    if (this._mission === "math") {
      const cur = String(p["difficulty"] ?? "medium");
      return html`<div class="block">
        <label class="field">${localize(lang, "mparam.difficulty")}</label>
        <div class="seg">
          ${["easy", "medium", "hard"].map(
            (d) => html`<button
              class=${cur === d ? "on" : ""}
              @click=${() => this._setParam("difficulty", d)}
            >
              ${localize(lang, "mparam." + d)}
            </button>`
          )}
        </div>
      </div>`;
    }
    if (this._mission === "shake") {
      return html`<div class="block">
        <ha-textfield
          type="number"
          min="3"
          max="50"
          .label=${localize(lang, "mparam.shake_count")}
          .value=${String(p["count"] ?? 12)}
          @input=${(e: Event) =>
            this._setParam("count", Number((e.target as HTMLInputElement).value))}
        ></ha-textfield>
      </div>`;
    }
    if (this._mission === "qr") {
      return html`<div class="block">
        <ha-textfield
          .label=${localize(lang, "mparam.qr_value")}
          placeholder=${localize(lang, "common.optional")}
          .value=${String(p["value"] ?? "")}
          @input=${(e: Event) =>
            this._setParam("value", (e.target as HTMLInputElement).value)}
        ></ha-textfield>
      </div>`;
    }
    if (this._mission === "open_door") {
      return html`<div class="block">
        <ha-entity-picker
          .hass=${this.hass}
          .label=${localize(lang, "mparam.door_entity")}
          .value=${String(p["entity_id"] ?? "")}
          .includeDomains=${["binary_sensor"]}
          allow-custom-entity
          @value-changed=${(e: CustomEvent) => this._setParam("entity_id", e.detail.value)}
        ></ha-entity-picker>
      </div>`;
    }
    return nothing;
  }

  private async _save(): Promise<void> {
    this._saving = true;
    // The backend replaces the whole `features` dict on update, so we spread the
    // existing alarm's features (and each sub-object) to preserve fields this
    // dialog does not edit — per-alarm target overrides, mission params/vision
    // prompt, smart-window signals, the briefing template, etc.
    const prev = this.alarm?.features;
    const input = {
      time: this._time,
      label: this._label,
      profile_id: this.alarm?.profile_id ?? this.profileId,
      enabled: this._enabled,
      schedule: { ...this.alarm?.schedule, repeat_mode: this._repeat, weekdays: this._days },
      features: {
        ...prev,
        mission: { ...prev?.mission, type: this._mission, params: this._missionParams },
        snooze: { ...prev?.snooze, max: this._snoozeMax, duration: this._snoozeMin * 60 },
        audio: {
          ...prev?.audio,
          enabled: this._audioSource !== "",
          source: this._audioSource || null,
          volume_profile: this._audioFade ? "fade_in" : "fixed",
        },
        light: { ...prev?.light, enabled: this._light, duration_min: this._lightMin },
        smart_window: { ...prev?.smart_window, enabled: this._smart, minutes: this._smartMin },
        briefing: {
          ...prev?.briefing,
          enabled: this._briefing,
          blocks: this._briefing
            ? BRIEFING_BLOCKS.filter((b) => this._briefingBlocks.includes(b))
            : [],
        },
      },
    };
    try {
      if (this.alarm) {
        await updateAlarm(this.hass, this.alarm.id, input);
      } else {
        await createAlarm(this.hass, input);
      }
      this._close();
    } catch (err) {
      this._saving = false;
      this.dispatchEvent(
        new CustomEvent("error", { detail: String(err), bubbles: true, composed: true })
      );
    }
  }

  private _renderHeading(): TemplateResult {
    const title = this.alarm
      ? localize(this.hass?.language, "dialog.edit_title")
      : localize(this.hass?.language, "dialog.new_title");
    return html`<span class="header_title">
      <span class="title">${title}</span>
      <ha-icon-button
        .label=${localize(this.hass?.language, "common.cancel")}
        .path=${MDI_CLOSE}
        dialogAction="close"
        class="header_button"
      ></ha-icon-button>
    </span>`;
  }

  static styles = [
    auroraStyles,
    css`
      ha-dialog {
        --mdc-dialog-min-width: min(560px, 95vw);
        --mdc-dialog-max-width: 580px;
        --dialog-content-padding: 4px 24px 16px;
        --justify-action-buttons: space-between;
      }
      .header_title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .header_title .title {
        flex: 1;
        font-size: 1.2rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .header_button {
        color: var(--secondary-text-color);
      }
      .dlg-btn {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--primary-color, var(--aurora-accent));
        background: transparent;
        padding: 10px 14px;
        border-radius: 8px;
      }
      .dlg-btn[disabled] {
        opacity: 0.5;
        cursor: default;
      }
      .dlg-btn:hover {
        background: color-mix(in srgb, var(--primary-color, var(--aurora-accent)) 12%, transparent);
      }
      /* HA form components fill the dialog width and theme themselves. */
      ha-textfield,
      ha-select,
      ha-entity-picker {
        display: block;
        width: 100%;
      }
      input.big-time {
        width: 100%;
        font-size: 3.2rem;
        text-align: center;
        border: none;
        background: transparent;
        padding: 4px 0 14px;
        color: var(--primary-text-color, var(--aurora-text));
      }
      .big-time:focus {
        outline: none;
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        align-items: start;
      }
      .seg {
        display: flex;
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
        border-radius: 999px;
        padding: 4px;
        gap: 4px;
      }
      .seg button {
        flex: 1;
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        padding: 8px;
        border-radius: 999px;
        color: var(--aurora-dim);
        background: transparent;
      }
      .seg button.on {
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
      }
      .block {
        margin-top: 18px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .chips button {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        padding: 7px 14px;
        border-radius: 999px;
        color: var(--aurora-dim);
        background: transparent;
      }
      .chips button.on {
        color: var(--aurora-on-accent);
        border-color: transparent;
        background: var(--aurora-accent-grad);
      }
      .togglerow {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .togglerow .sub {
        font-size: 0.78rem;
        color: var(--aurora-dim);
        margin-top: 2px;
      }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.open) {
      return nothing;
    }
    const lang = this.hass?.language;
    return html`
      <ha-dialog open .heading=${this._renderHeading()} @closed=${this._close}>
        <input
          class="big-time clock"
          type="time"
          .value=${this._time}
          @input=${(e: Event) => (this._time = (e.target as HTMLInputElement).value)}
        />

        <ha-textfield
          class="block"
          .label=${localize(lang, "dialog.label")}
          placeholder=${localize(lang, "dialog.label_placeholder")}
          .value=${this._label}
          @input=${(e: Event) => (this._label = (e.target as HTMLInputElement).value)}
        ></ha-textfield>

        <div class="block">
          <label class="field">${localize(lang, "dialog.repeat")}</label>
          <div class="seg">
            ${REPEATS.map(
              (r) => html`
                <button class=${this._repeat === r ? "on" : ""} @click=${() => (this._repeat = r)}>
                  ${localize(lang, "repeat." + r)}
                </button>
              `
            )}
          </div>
        </div>

        ${this._repeat === "weekly"
          ? html`<div class="block">
              <label class="field">${localize(lang, "dialog.days")}</label>
              <aurora-weekday-chips
                .value=${this._days}
                .language=${lang}
                @change=${(e: CustomEvent<number[]>) => (this._days = e.detail)}
              ></aurora-weekday-chips>
            </div>`
          : nothing}

        <div class="block grid2">
          <ha-select
            .label=${localize(lang, "dialog.mission")}
            .value=${this._mission}
            fixedMenuPosition
            naturalMenuWidth
            @selected=${(e: Event) =>
              (this._mission = (e.target as HTMLSelectElement).value as MissionType)}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            ${MISSION_TYPES.map(
              (m) => html`<ha-list-item .value=${m}>${localize(lang, "mission." + m)}</ha-list-item>`
            )}
          </ha-select>
          <ha-textfield
            .label=${localize(lang, "dialog.sound")}
            placeholder=${localize(lang, "common.optional")}
            .value=${this._audioSource}
            @input=${(e: Event) => (this._audioSource = (e.target as HTMLInputElement).value)}
          ></ha-textfield>
        </div>

        ${this._missionParamsBlock()}

        <div class="block grid2">
          <ha-textfield
            type="number"
            min="0"
            max="10"
            .label=${localize(lang, "dialog.snooze_max")}
            .value=${String(this._snoozeMax)}
            @input=${(e: Event) =>
              (this._snoozeMax = Number((e.target as HTMLInputElement).value))}
          ></ha-textfield>
          <ha-textfield
            type="number"
            min="1"
            max="60"
            .label=${localize(lang, "dialog.snooze_duration")}
            .value=${String(this._snoozeMin)}
            @input=${(e: Event) =>
              (this._snoozeMin = Number((e.target as HTMLInputElement).value))}
          ></ha-textfield>
        </div>

        <div class="togglerow">
          <ha-switch
            .checked=${this._audioFade}
            @change=${(e: Event) => (this._audioFade = (e.target as HTMLInputElement).checked)}
          ></ha-switch>
          <div class="spacer">${localize(lang, "dialog.fade_in")}</div>
        </div>

        <div class="togglerow">
          <ha-switch
            .checked=${this._light}
            @change=${(e: Event) => (this._light = (e.target as HTMLInputElement).checked)}
          ></ha-switch>
          <div class="spacer">${localize(lang, "dialog.sunrise")}</div>
          ${this._light
            ? html`<ha-textfield
                style="width:96px"
                type="number"
                min="1"
                max="60"
                .value=${String(this._lightMin)}
                @input=${(e: Event) =>
                  (this._lightMin = Number((e.target as HTMLInputElement).value))}
              ></ha-textfield>`
            : nothing}
        </div>

        <div class="togglerow">
          <ha-switch
            .checked=${this._smart}
            @change=${(e: Event) => (this._smart = (e.target as HTMLInputElement).checked)}
          ></ha-switch>
          <div class="spacer">
            ${localize(lang, "dialog.smart")}
            <div class="sub">${localize(lang, "dialog.smart_desc")}</div>
          </div>
          ${this._smart
            ? html`<ha-textfield
                style="width:96px"
                type="number"
                min="5"
                max="60"
                .value=${String(this._smartMin)}
                @input=${(e: Event) =>
                  (this._smartMin = Number((e.target as HTMLInputElement).value))}
              ></ha-textfield>`
            : nothing}
        </div>

        <div class="togglerow">
          <ha-switch
            .checked=${this._briefing}
            @change=${(e: Event) => (this._briefing = (e.target as HTMLInputElement).checked)}
          ></ha-switch>
          <div class="spacer">
            ${localize(lang, "dialog.briefing")}
            <div class="sub">${localize(lang, "dialog.briefing_desc")}</div>
          </div>
        </div>
        ${this._briefing
          ? html`<div class="chips">
              ${BRIEFING_BLOCKS.map(
                (b) => html`<button
                  class=${this._briefingBlocks.includes(b) ? "on" : ""}
                  @click=${() => this._toggleBlock(b)}
                >
                  ${localize(lang, "briefing.block." + b)}
                </button>`
              )}
            </div>`
          : nothing}

        <button class="dlg-btn" slot="secondaryAction" dialogAction="cancel">
          ${localize(lang, "common.cancel")}
        </button>
        <button
          class="dlg-btn"
          slot="primaryAction"
          ?disabled=${this._saving}
          @click=${this._save}
        >
          ${this._saving ? localize(lang, "common.saving") : localize(lang, "common.save")}
        </button>
      </ha-dialog>
    `;
  }
}
