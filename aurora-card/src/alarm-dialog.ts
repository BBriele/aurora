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
        <label class="field">${localize(lang, "mparam.shake_count")}</label>
        <input
          type="number"
          min="3"
          max="50"
          .value=${String(p["count"] ?? 12)}
          @input=${(e: Event) =>
            this._setParam("count", Number((e.target as HTMLInputElement).value))}
        />
      </div>`;
    }
    if (this._mission === "qr") {
      return html`<div class="block">
        <label class="field">${localize(lang, "mparam.qr_value")}</label>
        <input
          type="text"
          placeholder=${localize(lang, "common.optional")}
          .value=${String(p["value"] ?? "")}
          @input=${(e: Event) =>
            this._setParam("value", (e.target as HTMLInputElement).value)}
        />
      </div>`;
    }
    if (this._mission === "open_door") {
      return html`<div class="block">
        <label class="field">${localize(lang, "mparam.door_entity")}</label>
        <input
          type="text"
          placeholder="binary_sensor.front_door"
          .value=${String(p["entity_id"] ?? "")}
          @input=${(e: Event) =>
            this._setParam("entity_id", (e.target as HTMLInputElement).value)}
        />
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
      // eslint-disable-next-line no-alert
      this.dispatchEvent(
        new CustomEvent("error", { detail: String(err), bubbles: true, composed: true })
      );
    }
  }

  static styles = [
    auroraStyles,
    css`
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(20, 18, 40, 0.55);
        backdrop-filter: blur(4px);
        display: grid;
        place-items: end center;
        z-index: 9;
        animation: fade 0.2s ease;
      }
      @media (min-width: 600px) {
        .backdrop {
          place-items: center;
        }
      }
      .sheet {
        width: min(560px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: var(--aurora-surface);
        border-radius: 26px 26px 0 0;
        padding: 8px 22px 22px;
        box-shadow: 0 -20px 60px -20px rgba(20, 18, 40, 0.6);
        animation: rise 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      @media (min-width: 600px) {
        .sheet {
          border-radius: 26px;
        }
      }
      .grip {
        width: 42px;
        height: 5px;
        border-radius: 3px;
        background: var(--aurora-divider);
        margin: 8px auto 14px;
      }
      h2 {
        margin: 0 0 4px;
        font-size: 1.25rem;
      }
      input.big-time {
        width: 100%;
        font-size: 3.2rem;
        text-align: center;
        border: none;
        background: transparent;
        padding: 4px 0 10px;
      }
      .big-time:focus {
        outline: none;
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
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
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 22px;
      }
      .actions .btn {
        flex: 1;
        padding: 14px;
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @keyframes rise {
        from {
          transform: translateY(40px);
          opacity: 0;
        }
      }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.open) {
      return nothing;
    }
    return html`
      <div class="backdrop" @click=${(e: Event) => e.target === e.currentTarget && this._close()}>
        <div class="sheet">
          <div class="grip"></div>
          <h2>${this.alarm ? localize(this.hass?.language, "dialog.edit_title") : localize(this.hass?.language, "dialog.new_title")}</h2>
          <input
            class="big-time clock"
            type="time"
            .value=${this._time}
            @input=${(e: Event) => (this._time = (e.target as HTMLInputElement).value)}
          />

          <label class="field">${localize(this.hass?.language, "dialog.label")}</label>
          <input
            type="text"
            placeholder=${localize(this.hass?.language, "dialog.label_placeholder")}
            .value=${this._label}
            @input=${(e: Event) => (this._label = (e.target as HTMLInputElement).value)}
          />

          <div class="block">
            <label class="field">${localize(this.hass?.language, "dialog.repeat")}</label>
            <div class="seg">
              ${REPEATS.map(
                (r) => html`
                  <button
                    class=${this._repeat === r ? "on" : ""}
                    @click=${() => (this._repeat = r)}
                  >
                    ${localize(this.hass?.language, "repeat." + r)}
                  </button>
                `
              )}
            </div>
          </div>

          ${this._repeat === "weekly"
            ? html`<div class="block">
                <label class="field">${localize(this.hass?.language, "dialog.days")}</label>
                <aurora-weekday-chips
                  .value=${this._days}
                  .language=${this.hass?.language}
                  @change=${(e: CustomEvent<number[]>) => (this._days = e.detail)}
                ></aurora-weekday-chips>
              </div>`
            : nothing}

          <div class="block grid2">
            <div>
              <label class="field">${localize(this.hass?.language, "dialog.mission")}</label>
              <select
                .value=${this._mission}
                @change=${(e: Event) =>
                  (this._mission = (e.target as HTMLSelectElement).value as MissionType)}
              >
                ${MISSION_TYPES.map(
                  (m) => html`<option value=${m} ?selected=${m === this._mission}>
                    ${localize(this.hass?.language, "mission." + m)}
                  </option>`
                )}
              </select>
            </div>
            <div>
              <label class="field">${localize(this.hass?.language, "dialog.sound")}</label>
              <input
                type="text"
                placeholder=${localize(this.hass?.language, "common.optional")}
                .value=${this._audioSource}
                @input=${(e: Event) =>
                  (this._audioSource = (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          ${this._missionParamsBlock()}

          <div class="block grid2">
            <div>
              <label class="field">${localize(this.hass?.language, "dialog.snooze_max")}</label>
              <input
                type="number"
                min="0"
                max="10"
                .value=${String(this._snoozeMax)}
                @input=${(e: Event) =>
                  (this._snoozeMax = Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div>
              <label class="field">${localize(this.hass?.language, "dialog.snooze_duration")}</label>
              <input
                type="number"
                min="1"
                max="60"
                .value=${String(this._snoozeMin)}
                @input=${(e: Event) =>
                  (this._snoozeMin = Number((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>

          <div class="togglerow">
            <div
              class="switch"
              role="switch"
              aria-checked=${this._audioFade ? "true" : "false"}
              @click=${() => (this._audioFade = !this._audioFade)}
            ></div>
            <div>${localize(this.hass?.language, "dialog.fade_in")}</div>
          </div>
          <div class="togglerow">
            <div
              class="switch"
              role="switch"
              aria-checked=${this._light ? "true" : "false"}
              @click=${() => (this._light = !this._light)}
            ></div>
            <div class="spacer">${localize(this.hass?.language, "dialog.sunrise")}</div>
            ${this._light
              ? html`<input
                  style="width:90px"
                  type="number"
                  min="1"
                  max="60"
                  .value=${String(this._lightMin)}
                  @input=${(e: Event) =>
                    (this._lightMin = Number((e.target as HTMLInputElement).value))}
                />`
              : nothing}
          </div>
          <div class="togglerow">
            <div
              class="switch"
              role="switch"
              aria-checked=${this._smart ? "true" : "false"}
              @click=${() => (this._smart = !this._smart)}
            ></div>
            <div class="spacer">
              ${localize(this.hass?.language, "dialog.smart")}
              <div class="sub">${localize(this.hass?.language, "dialog.smart_desc")}</div>
            </div>
            ${this._smart
              ? html`<input
                  style="width:90px"
                  type="number"
                  min="5"
                  max="60"
                  .value=${String(this._smartMin)}
                  @input=${(e: Event) =>
                    (this._smartMin = Number((e.target as HTMLInputElement).value))}
                />`
              : nothing}
          </div>
          <div class="togglerow">
            <div
              class="switch"
              role="switch"
              aria-checked=${this._briefing ? "true" : "false"}
              @click=${() => (this._briefing = !this._briefing)}
            ></div>
            <div class="spacer">
              ${localize(this.hass?.language, "dialog.briefing")}
              <div class="sub">${localize(this.hass?.language, "dialog.briefing_desc")}</div>
            </div>
          </div>
          ${this._briefing
            ? html`<div class="chips">
                ${BRIEFING_BLOCKS.map(
                  (b) => html`<button
                    class=${this._briefingBlocks.includes(b) ? "on" : ""}
                    @click=${() => this._toggleBlock(b)}
                  >
                    ${localize(this.hass?.language, "briefing.block." + b)}
                  </button>`
                )}
              </div>`
            : nothing}

          <div class="actions">
            <button class="btn ghost" @click=${this._close}>${localize(this.hass?.language, "common.cancel")}</button>
            <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
              ${this._saving ? localize(this.hass?.language, "common.saving") : localize(this.hass?.language, "common.save")}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
