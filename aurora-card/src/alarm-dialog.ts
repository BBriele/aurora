import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { createAlarm, getSettings, updateAlarm } from "./api";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import "./weekday-chips";
import {
  BRIEFING_BLOCKS,
  MISSION_TYPES,
  type Alarm,
  type AudioPreset,
  type BriefingBlock,
  type HomeAssistant,
  type MissionType,
  type Profiles,
  type RepeatMode,
  type VolumeEndMode,
} from "./types";

const VOLUME_END_MODES: VolumeEndMode[] = ["none", "restore", "fixed"];

// Sentinel option values for the sound picker.
const PRESET_PREFIX = "aurora_preset:";
const SOUND_CUSTOM = "__custom__";

const REPEATS: RepeatMode[] = ["once", "daily", "weekly"];

// mdi:close — inlined so the bundle needs no mdi import.
const MDI_CLOSE =
  "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";

const pad = (n: number): string => String(n).padStart(2, "0");

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
  @state() private _audioCustom = false;
  @state() private _presets: AudioPreset[] = [];
  @state() private _audioFade = true;
  @state() private _volume = 70;
  @state() private _volEndMode: VolumeEndMode = "none";
  @state() private _volEnd = 30;
  @state() private _light = false;
  @state() private _lightMin = 30;
  @state() private _smart = false;
  @state() private _smartMin = 30;
  @state() private _briefing = false;
  @state() private _briefingBlocks: string[] = [...BRIEFING_BLOCKS];
  @state() private _enabled = true;
  @state() private _saving = false;
  @state() private _display = false;
  @state() private _displayTargets: string[] = [];
  @state() private _displayOptions: string[] = [];
  // HA more-info style: click the header title to grow the dialog sideways.
  // Default expanded (two columns); CSS clamps to viewport so narrow screens
  // collapse to one column on their own — never a horizontal scrollbar.
  @state() private _large = true;

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("open") && this.open) {
      this._populate();
      void this._loadPresets();
    }
  }

  private async _loadPresets(): Promise<void> {
    const pid = this.alarm?.profile_id ?? this.profileId;
    if (!pid) {
      this._presets = [];
      this._displayOptions = [];
      return;
    }
    try {
      const settings = await getSettings(this.hass);
      const profiles = (settings.options.profiles as Profiles) ?? {};
      this._presets = profiles[pid]?.audio_presets ?? [];
      const bindings = (profiles[pid]?.bindings as Record<string, unknown> | undefined);
      const bound = bindings?.["display_surface"];
      this._displayOptions = Array.isArray(bound) ? (bound as string[]) : bound ? [String(bound)] : [];
    } catch {
      this._presets = [];
      this._displayOptions = [];
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
    // A raw (non-preset) source means the user typed a custom URI/playlist.
    this._audioCustom =
      this._audioSource !== "" && !this._audioSource.startsWith(PRESET_PREFIX);
    this._audioFade = a ? a.features.audio.volume_profile === "fade_in" : true;
    this._volume = Math.round((a?.features.audio.volume_max ?? 0.7) * 100);
    this._volEndMode = a?.features.audio.volume_end_mode ?? "none";
    this._volEnd =
      a?.features.audio.volume_end != null
        ? Math.round(a.features.audio.volume_end * 100)
        : 30;
    this._light = a?.features.light.enabled ?? false;
    this._lightMin = a?.features.light.duration_min ?? 30;
    this._smart = a?.features.smart_window.enabled ?? false;
    this._smartMin = a?.features.smart_window.minutes ?? 30;
    this._briefing = a?.features.briefing.enabled ?? false;
    this._briefingBlocks = a?.features.briefing.blocks?.length
      ? [...a.features.briefing.blocks]
      : [...BRIEFING_BLOCKS];
    this._display = a?.features.display?.enabled ?? false;
    this._displayTargets = [...(a?.features.display?.targets ?? [])];
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

  // The dialog is a WebAwesome `wa-dialog` under the hood: a scrim/Escape/X
  // dismissal surfaces as a `wa-hide` event. Inner controls (the mission
  // dropdown, etc.) can emit their own `wa-hide`; ignore those — only act when
  // the event retargets to the dialog host itself.
  private _onDialogHide(e: Event): void {
    if (e.target !== e.currentTarget) {
      return;
    }
    this._close();
  }

  // View Transitions API morphs the resize smoothly (HA does the same); plain
  // flip where the browser lacks it. Tagging HA's inner <dialog> with a
  // view-transition-name makes the box *geometrically* morph (grow/shrink)
  // instead of a flat crossfade — that's what gives HA's more-info its feel.
  // ponytail: reaches into ha-dialog's shadow; if HA restructures it, the morph
  // silently degrades to the default root crossfade — no breakage.
  private _toggleLarge(): void {
    // The native <dialog> is two shadow levels down: ha-dialog → wa-dialog →
    // <dialog>. querySelector won't cross shadow roots, so reach through both
    // (fall back to ha-dialog's own shadow if HA ever drops the wa-dialog wrap).
    const haShadow = this.shadowRoot?.querySelector("ha-dialog")?.shadowRoot;
    const box = (haShadow?.querySelector("wa-dialog")?.shadowRoot?.querySelector("dialog") ??
      haShadow?.querySelector("dialog")) as HTMLElement | null | undefined;
    if (box) box.style.viewTransitionName = "aurora-alarm-dialog";
    const flip = (): void => void (this._large = !this._large);
    const vt = (document as Document & {
      startViewTransition?: (cb: () => void) => void;
    }).startViewTransition;
    vt ? vt.call(document, flip) : flip();
  }

  private _toggleBlock(block: BriefingBlock): void {
    this._briefingBlocks = this._briefingBlocks.includes(block)
      ? this._briefingBlocks.filter((b) => b !== block)
      : [...this._briefingBlocks, block];
  }

  private _setParam(key: string, value: unknown): void {
    this._missionParams = { ...this._missionParams, [key]: value };
  }

  // --- Inline time editor (no native picker; it's ugly and froze the renderer).
  private get _h(): number {
    return Number(this._time.split(":")[0]);
  }
  private get _m(): number {
    return Number(this._time.split(":")[1]);
  }
  private get _is12h(): boolean {
    return this.hass?.locale?.time_format === "12";
  }
  private _setHM(h: number, m: number): void {
    this._time = `${pad((h + 24) % 24)}:${pad((m + 60) % 60)}`;
  }
  private _toggleMeridiem(): void {
    this._setHM(this._h + 12, this._m);
  }
  private _commitHour(e: Event): void {
    const n = parseInt((e.target as HTMLInputElement).value.replace(/\D/g, ""), 10);
    if (isNaN(n)) return void this.requestUpdate();
    const h = this._is12h
      ? (Math.min(Math.max(n, 1), 12) % 12) + (this._h >= 12 ? 12 : 0)
      : Math.min(Math.max(n, 0), 23);
    this._setHM(h, this._m);
  }
  private _commitMin(e: Event): void {
    const n = parseInt((e.target as HTMLInputElement).value.replace(/\D/g, ""), 10);
    if (isNaN(n)) return void this.requestUpdate();
    this._setHM(this._h, Math.min(Math.max(n, 0), 59));
  }
  // Wheel / Up-Down arrows nudge the focused segment (wrap-around via _setHM).
  private _stepHour(d: number): void {
    this._setHM(this._h + d, this._m);
  }
  private _stepMin(d: number): void {
    this._setHM(this._h, this._m + d);
  }
  private _segKey(e: KeyboardEvent, step: (d: number) => void): void {
    if (e.key === "ArrowUp") (e.preventDefault(), step(1));
    else if (e.key === "ArrowDown") (e.preventDefault(), step(-1));
  }

  // Wrap HA's stable `ha-selector` — it self-loads the right input for the
  // running HA version (today the WebAwesome `wa-input`/`ha-select`), so the
  // editor stays correct across the frontend's component migrations.
  private _selector(
    selector: Record<string, unknown>,
    label: string,
    value: unknown,
    onChange: (value: unknown) => void,
    cls = "block"
  ): TemplateResult {
    return html`<ha-selector
      class=${cls}
      .hass=${this.hass}
      .selector=${selector}
      .label=${label}
      .value=${value ?? ""}
      .required=${false}
      @value-changed=${(e: CustomEvent) => onChange(e.detail.value)}
    ></ha-selector>`;
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
      return this._selector(
        { number: { min: 3, max: 50, step: 1, mode: "box" } },
        localize(lang, "mparam.shake_count"),
        Number(p["count"] ?? 12),
        (v) => this._setParam("count", Number(v ?? 0))
      );
    }
    if (this._mission === "qr") {
      return this._selector(
        { text: {} },
        localize(lang, "mparam.qr_value"),
        String(p["value"] ?? ""),
        (v) => this._setParam("value", (v as string) ?? "")
      );
    }
    if (this._mission === "open_door") {
      return this._selector(
        { entity: { filter: [{ domain: "binary_sensor" }] } },
        localize(lang, "mparam.door_entity"),
        String(p["entity_id"] ?? ""),
        (v) => this._setParam("entity_id", (v as string) ?? "")
      );
    }
    return nothing;
  }

  // The sound is either one of the profile's saved audio presets or a custom
  // URI/playlist. With no presets we keep the plain text field (back-compat).
  private _soundField(lang?: string): TemplateResult {
    if (!this._presets.length) {
      return this._selector(
        { text: {} },
        localize(lang, "dialog.sound"),
        this._audioSource,
        (v) => (this._audioSource = (v as string) ?? ""),
        ""
      );
    }
    const isPreset = this._audioSource.startsWith(PRESET_PREFIX);
    const value = this._audioCustom ? SOUND_CUSTOM : isPreset ? this._audioSource : "";
    const options = [
      { value: "", label: localize(lang, "picker.empty_option") },
      ...this._presets.map((p) => ({ value: PRESET_PREFIX + p.id, label: "🎵 " + p.name })),
      { value: SOUND_CUSTOM, label: localize(lang, "dialog.sound_custom") },
    ];
    return html`<div class="soundwrap">
      ${this._selector(
        { select: { mode: "dropdown", options } },
        localize(lang, "dialog.sound"),
        value,
        (v) => this._onSoundSelect((v as string) ?? ""),
        ""
      )}
      ${this._audioCustom
        ? this._selector(
            { text: {} },
            localize(lang, "dialog.sound_uri"),
            this._audioSource.startsWith(PRESET_PREFIX) ? "" : this._audioSource,
            (v) => (this._audioSource = (v as string) ?? ""),
            ""
          )
        : nothing}
    </div>`;
  }

  // Ring volume + what to do with the speaker volume once the alarm stops.
  private _volumeBlock(lang?: string): TemplateResult {
    return html`
      <div class="block">
        <label class="field">${localize(lang, "dialog.volume")}</label>
        <div class="sliderrow">
          <ha-icon icon="mdi:volume-high"></ha-icon>
          ${this._slider(this._volume, (v) => (this._volume = v))}
          <span class="pct">${this._volume}%</span>
        </div>
      </div>
      <div class="block">
        <label class="field">${localize(lang, "dialog.when_stops")}</label>
        <div class="seg">
          ${VOLUME_END_MODES.map(
            (m) => html`<button
              class=${this._volEndMode === m ? "on" : ""}
              @click=${() => (this._volEndMode = m)}
            >
              ${localize(lang, "dialog.end_" + m)}
            </button>`
          )}
        </div>
        ${this._volEndMode === "fixed"
          ? html`<div class="sliderrow">
              <ha-icon icon="mdi:volume-medium"></ha-icon>
              ${this._slider(this._volEnd, (v) => (this._volEnd = v))}
              <span class="pct">${this._volEnd}%</span>
            </div>`
          : nothing}
      </div>
    `;
  }

  private _displayBlock(lang?: string): TemplateResult {
    return html`
      <div class="togglerow">
        <ha-switch
          .checked=${this._display}
          @change=${(e: Event) => (this._display = (e.target as HTMLInputElement).checked)}
        ></ha-switch>
        <div class="spacer">${localize(lang, "dialog.display")}</div>
      </div>
      ${this._display
        ? this._displayOptions.length
          ? html`<ha-selector
              .hass=${this.hass}
              .selector=${{
                select: {
                  multiple: true,
                  options: this._displayOptions.map((id) => ({
                    value: id,
                    label: (this.hass.states[id]?.attributes.friendly_name as string | undefined) ?? id,
                  })),
                },
              }}
              .value=${this._displayTargets}
              @value-changed=${(e: CustomEvent) => (this._displayTargets = e.detail.value as string[])}
            ></ha-selector>`
          : html`<div class="hint">${localize(lang, "dialog.display_none")}</div>`
        : nothing}
    `;
  }

  private _slider(value: number, onChange: (v: number) => void): TemplateResult {
    return html`<ha-selector
      .hass=${this.hass}
      .selector=${{ number: { min: 0, max: 100, step: 1, mode: "slider" } }}
      .value=${value}
      @value-changed=${(e: CustomEvent) => onChange(Number(e.detail.value ?? 0))}
    ></ha-selector>`;
  }

  private _onSoundSelect(value: string): void {
    if (value === SOUND_CUSTOM) {
      this._audioCustom = true;
      if (this._audioSource.startsWith(PRESET_PREFIX)) {
        this._audioSource = "";
      }
      return;
    }
    this._audioCustom = false;
    this._audioSource = value;
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
          volume_max: this._volume / 100,
          volume_end_mode: this._volEndMode,
          volume_end: this._volEndMode === "fixed" ? this._volEnd / 100 : null,
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
        display: {
          ...prev?.display,
          enabled: this._display,
          targets: this._display ? this._displayTargets : [],
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

  static styles = [
    auroraStyles,
    css`
      ha-dialog {
        --dialog-content-padding: 4px 24px 16px;
        /* HA's WebAwesome ha-dialog derives its width from --ha-dialog-width-md
           and clamps the result to --ha-dialog-width-full (~95vw), so narrow
           screens shrink and the dialog never forces a horizontal scrollbar.
           (The legacy --width / --mdc-dialog-* vars are ignored by this dialog.)
           Compact = single column. */
        --ha-dialog-width-md: 560px;
        /* Top-anchor the surface: compact (1 col) is much taller than large
           (2 col), so vertical centering would make the header jump ~120px when
           toggling. A fixed top keeps the header still; the body just grows down
           (ha-dialog caps height and scrolls internally on short screens). */
        --dialog-surface-margin-top: 48px;
      }
      /* Large: grow sideways to fit the two-column body (default on wide screens,
         toggled by clicking the header title). */
      ha-dialog.large {
        --ha-dialog-width-md: 1040px;
      }
      .cols {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0 28px;
        align-items: start;
      }
      ha-dialog.large .cols {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      .col {
        min-width: 0;
      }
      .col .togglerow:first-child {
        border-top: none;
      }
      /* Small screens stay one column even when "large" — clamp handles width. */
      @media (max-width: 640px) {
        ha-dialog.large .cols {
          grid-template-columns: 1fr;
        }
      }
      .dlg-title {
        font-size: 1.2rem;
        font-weight: 600;
        cursor: pointer; /* click to expand/collapse, HA more-info style */
        user-select: none;
      }
      .footer-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        width: 100%;
      }
      /* HA selectors fill the dialog width and theme themselves. */
      ha-selector {
        display: block;
        width: 100%;
      }
      /* Inline time editor: two big segments, scroll/arrow/type to set. */
      .timepick {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        margin: 6px 0 18px;
      }
      .tnum {
        width: 1.7em;
        font: 600 3.6rem/1 var(--ha-font-family-body, inherit);
        text-align: center;
        border: none;
        border-radius: 14px;
        background: transparent;
        color: var(--primary-text-color, var(--aurora-text));
        font-variant-numeric: tabular-nums;
        padding: 6px 2px;
        cursor: ns-resize;
        transition: background 0.15s ease, box-shadow 0.15s ease;
        -moz-appearance: textfield;
      }
      .tnum::-webkit-inner-spin-button,
      .tnum::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .tnum:hover {
        background: color-mix(in srgb, var(--aurora-accent) 9%, transparent);
      }
      .tnum:focus {
        outline: none;
        background: color-mix(in srgb, var(--aurora-accent) 16%, transparent);
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--aurora-accent) 45%, transparent);
      }
      .colon {
        font: 600 3.4rem/1 var(--ha-font-family-body, inherit);
        color: var(--aurora-dim);
        padding-bottom: 8px;
      }
      .ampm {
        margin-left: 10px;
        border: 1px solid var(--aurora-divider);
        border-radius: 12px;
        background: transparent;
        color: var(--aurora-accent);
        font-weight: 700;
        font-size: 1rem;
        letter-spacing: 0.04em;
        padding: 10px 14px;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .ampm:hover {
        background: color-mix(in srgb, var(--aurora-accent) 12%, transparent);
      }
      .grid2 {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
        align-items: start;
      }
      .grid2 ha-selector {
        margin: 0;
      }
      .soundwrap {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sliderrow {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
      .sliderrow ha-selector {
        flex: 1;
      }
      .sliderrow ha-icon {
        --mdc-icon-size: 22px;
        color: var(--aurora-dim);
        flex: none;
      }
      .sliderrow .pct {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        width: 44px;
        text-align: right;
        color: var(--aurora-dim);
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
      .hint {
        font-size: 0.82rem;
        color: var(--aurora-dim);
        margin-top: 6px;
        font-style: italic;
      }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.open) {
      return nothing;
    }
    const lang = this.hass?.language;
    const title = this.alarm
      ? localize(lang, "dialog.edit_title")
      : localize(lang, "dialog.new_title");
    return html`
      <ha-dialog open class=${this._large ? "large" : ""} @wa-hide=${this._onDialogHide}>
        <ha-icon-button
          slot="headerNavigationIcon"
          .label=${localize(lang, "common.cancel")}
          .path=${MDI_CLOSE}
          @click=${this._close}
        ></ha-icon-button>
        <span
          slot="headerTitle"
          class="dlg-title"
          role="button"
          tabindex="0"
          @click=${this._toggleLarge}
          @keydown=${(e: KeyboardEvent) =>
            (e.key === "Enter" || e.key === " ") && (e.preventDefault(), this._toggleLarge())}
          >${title}</span
        >

        <div class="timepick" role="group" aria-label=${localize(lang, "dialog.time")}>
          <input
            class="tnum clock"
            inputmode="numeric"
            maxlength="2"
            aria-label=${localize(lang, "dialog.hours")}
            .value=${this._is12h ? String(this._h % 12 || 12) : pad(this._h)}
            @change=${this._commitHour}
            @wheel=${(e: WheelEvent) => (e.preventDefault(), this._stepHour(e.deltaY < 0 ? 1 : -1))}
            @keydown=${(e: KeyboardEvent) => this._segKey(e, (d) => this._stepHour(d))}
            @focus=${(e: Event) => (e.target as HTMLInputElement).select()}
          />
          <span class="colon">:</span>
          <input
            class="tnum clock"
            inputmode="numeric"
            maxlength="2"
            aria-label=${localize(lang, "dialog.minutes")}
            .value=${pad(this._m)}
            @change=${this._commitMin}
            @wheel=${(e: WheelEvent) => (e.preventDefault(), this._stepMin(e.deltaY < 0 ? 1 : -1))}
            @keydown=${(e: KeyboardEvent) => this._segKey(e, (d) => this._stepMin(d))}
            @focus=${(e: Event) => (e.target as HTMLInputElement).select()}
          />
          ${this._is12h
            ? html`<button type="button" class="ampm" @click=${this._toggleMeridiem}>
                ${this._h >= 12 ? "PM" : "AM"}
              </button>`
            : nothing}
        </div>

        ${this._selector(
          { text: {} },
          localize(lang, "dialog.label"),
          this._label,
          (v) => (this._label = (v as string) ?? "")
        )}

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

        <div class="cols">
          <div class="col">
            ${this._selector(
              {
                select: {
                  mode: "dropdown",
                  options: MISSION_TYPES.map((m) => ({
                    value: m,
                    label: localize(lang, "mission." + m),
                  })),
                },
              },
              localize(lang, "dialog.mission"),
              this._mission,
              (v) => (this._mission = (v as MissionType) ?? "tap")
            )}
            ${this._missionParamsBlock()}
            ${this._soundField(lang)}
            <div class="grid2">
              ${this._selector(
                { number: { min: 0, max: 10, step: 1, mode: "box" } },
                localize(lang, "dialog.snooze_max"),
                this._snoozeMax,
                (v) => (this._snoozeMax = Number(v ?? 0)),
                ""
              )}
              ${this._selector(
                { number: { min: 1, max: 60, step: 1, mode: "box" } },
                localize(lang, "dialog.snooze_duration"),
                this._snoozeMin,
                (v) => (this._snoozeMin = Number(v ?? 0)),
                ""
              )}
            </div>
          </div>

          <div class="col">
            <div class="togglerow">
              <ha-switch
                .checked=${this._audioFade}
                @change=${(e: Event) => (this._audioFade = (e.target as HTMLInputElement).checked)}
              ></ha-switch>
              <div class="spacer">${localize(lang, "dialog.fade_in")}</div>
            </div>

            ${this._volumeBlock(lang)}
            ${this._displayBlock(lang)}

            <div class="togglerow">
              <ha-switch
                .checked=${this._light}
                @change=${(e: Event) => (this._light = (e.target as HTMLInputElement).checked)}
              ></ha-switch>
              <div class="spacer">${localize(lang, "dialog.sunrise")}</div>
            </div>
            ${this._light
              ? this._selector(
                  { number: { min: 1, max: 60, step: 1, mode: "box" } },
                  localize(lang, "dialog.sunrise_min"),
                  this._lightMin,
                  (v) => (this._lightMin = Number(v ?? 0))
                )
              : nothing}

            <div class="togglerow">
              <ha-switch
                .checked=${this._smart}
                @change=${(e: Event) => (this._smart = (e.target as HTMLInputElement).checked)}
              ></ha-switch>
              <div class="spacer">
                ${localize(lang, "dialog.smart")}
                <div class="sub">${localize(lang, "dialog.smart_desc")}</div>
              </div>
            </div>
            ${this._smart
              ? this._selector(
                  { number: { min: 5, max: 60, step: 1, mode: "box" } },
                  localize(lang, "dialog.smart_min"),
                  this._smartMin,
                  (v) => (this._smartMin = Number(v ?? 0))
                )
              : nothing}

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
          </div>
        </div>

        <div class="footer-actions" slot="footer">
          <ha-button appearance="plain" @click=${this._close}>
            ${localize(lang, "common.cancel")}
          </ha-button>
          <ha-button
            appearance="plain"
            variant="brand"
            ?disabled=${this._saving}
            @click=${this._save}
          >
            ${this._saving ? localize(lang, "common.saving") : localize(lang, "common.save")}
          </ha-button>
        </div>
      </ha-dialog>
    `;
  }
}
