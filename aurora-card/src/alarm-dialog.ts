import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { createAlarm, updateAlarm } from "./api";
import { auroraStyles } from "./theme";
import "./weekday-chips";
import {
  MISSION_LABELS,
  type Alarm,
  type HomeAssistant,
  type MissionType,
  type RepeatMode,
} from "./types";

const REPEATS: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "Una volta" },
  { value: "daily", label: "Ogni giorno" },
  { value: "weekly", label: "Settimanale" },
];

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
  @state() private _snoozeMax = 3;
  @state() private _snoozeMin = 9;
  @state() private _audioSource = "";
  @state() private _audioFade = true;
  @state() private _light = false;
  @state() private _lightMin = 30;
  @state() private _smart = false;
  @state() private _smartMin = 30;
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
    this._snoozeMax = a?.features.snooze.max ?? 3;
    this._snoozeMin = a ? Math.round((a.features.snooze.duration ?? 540) / 60) : 9;
    this._audioSource = a?.features.audio.source ?? "";
    this._audioFade = a ? a.features.audio.volume_profile === "fade_in" : true;
    this._light = a?.features.light.enabled ?? false;
    this._lightMin = a?.features.light.duration_min ?? 30;
    this._smart = a?.features.smart_window.enabled ?? false;
    this._smartMin = a?.features.smart_window.minutes ?? 30;
    this._enabled = a?.enabled ?? true;
    this._saving = false;
  }

  private _close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent("closed"));
  }

  private async _save(): Promise<void> {
    this._saving = true;
    const input = {
      time: this._time,
      label: this._label,
      profile_id: this.alarm?.profile_id ?? this.profileId,
      enabled: this._enabled,
      schedule: { repeat_mode: this._repeat, weekdays: this._days },
      features: {
        mission: { type: this._mission },
        snooze: { max: this._snoozeMax, duration: this._snoozeMin * 60 },
        audio: {
          enabled: this._audioSource !== "",
          source: this._audioSource || null,
          volume_profile: this._audioFade ? "fade_in" : "fixed",
          volume_max: 0.7,
        },
        light: { enabled: this._light, duration_min: this._lightMin, post_stop: "off" },
        smart_window: { enabled: this._smart, minutes: this._smartMin },
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
      .big-time {
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
        color: #fff;
        background: var(--aurora-grad);
      }
      .block {
        margin-top: 18px;
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
          <h2>${this.alarm ? "Modifica sveglia" : "Nuova sveglia"}</h2>
          <input
            class="big-time clock"
            type="time"
            .value=${this._time}
            @input=${(e: Event) => (this._time = (e.target as HTMLInputElement).value)}
          />

          <label class="field">Etichetta</label>
          <input
            type="text"
            placeholder="Es. Sveglia lavoro"
            .value=${this._label}
            @input=${(e: Event) => (this._label = (e.target as HTMLInputElement).value)}
          />

          <div class="block">
            <label class="field">Ripetizione</label>
            <div class="seg">
              ${REPEATS.map(
                (r) => html`
                  <button
                    class=${this._repeat === r.value ? "on" : ""}
                    @click=${() => (this._repeat = r.value)}
                  >
                    ${r.label}
                  </button>
                `
              )}
            </div>
          </div>

          ${this._repeat === "weekly"
            ? html`<div class="block">
                <label class="field">Giorni</label>
                <aurora-weekday-chips
                  .value=${this._days}
                  @change=${(e: CustomEvent<number[]>) => (this._days = e.detail)}
                ></aurora-weekday-chips>
              </div>`
            : nothing}

          <div class="block grid2">
            <div>
              <label class="field">Missione anti-snooze</label>
              <select
                .value=${this._mission}
                @change=${(e: Event) =>
                  (this._mission = (e.target as HTMLSelectElement).value as MissionType)}
              >
                ${(Object.keys(MISSION_LABELS) as MissionType[]).map(
                  (m) => html`<option value=${m} ?selected=${m === this._mission}>
                    ${MISSION_LABELS[m]}
                  </option>`
                )}
              </select>
            </div>
            <div>
              <label class="field">Suono (URI/playlist)</label>
              <input
                type="text"
                placeholder="opzionale"
                .value=${this._audioSource}
                @input=${(e: Event) =>
                  (this._audioSource = (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <div class="block grid2">
            <div>
              <label class="field">Max snooze</label>
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
              <label class="field">Durata snooze (min)</label>
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
            <div>Volume crescente (fade-in)</div>
          </div>
          <div class="togglerow">
            <div
              class="switch"
              role="switch"
              aria-checked=${this._light ? "true" : "false"}
              @click=${() => (this._light = !this._light)}
            ></div>
            <div class="spacer">Alba (rampa luce/schermo)</div>
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
              Risveglio intelligente
              <div class="sub">Suona prima se ti rilevo già sveglio (segnali del tuo profilo)</div>
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

          <div class="actions">
            <button class="btn ghost" @click=${this._close}>Annulla</button>
            <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
              ${this._saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
