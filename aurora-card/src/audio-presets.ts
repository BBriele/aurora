import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { getSettings, setSettings } from "./api";
import "./media-browser";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { AudioPreset, HomeAssistant, PresetItem, Profiles } from "./types";

function genId(): string {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

const DEFAULT_END_VOLUME = 30;

/**
 * Per-profile audio preset manager, embedded in the Setup Audio card.
 *
 * A preset is a named, reusable sound or ordered playlist built from Home
 * Assistant media (via aurora-media-browser) or pasted URIs, with
 * media-player-style playback behaviour: drag-to-reorder tracks, shuffle, loop,
 * and an end-of-ring volume to restore on the speaker. Presets are stored under
 * options.profiles[userId].audio_presets and referenced by an alarm's audio
 * source as "aurora_preset:<id>".
 */
@customElement("aurora-audio-presets")
export class AuroraAudioPresets extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) userId = "";
  @property({ attribute: false }) userName = "";
  /** The profile's bound speaker — gives the media browser its richest tree. */
  @property({ attribute: false }) entityId: string | null = null;

  @state() private _presets: AudioPreset[] = [];
  @state() private _editing: AudioPreset | null = null;
  @state() private _browserOpen = false;
  @state() private _saving = false;
  @state() private _dragIndex: number | null = null;
  @state() private _dragOver: number | null = null;
  private _loadedFor = "";

  updated(): void {
    if (this.hass && this.userId && this._loadedFor !== this.userId) {
      this._loadedFor = this.userId;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    try {
      const settings = await getSettings(this.hass);
      const profiles = (settings.options.profiles as Profiles) ?? {};
      this._presets = profiles[this.userId]?.audio_presets ?? [];
    } catch {
      this._presets = [];
    }
    this._editing = null;
  }

  /** Re-read settings before writing so we never clobber the profile bindings. */
  private async _persist(presets: AudioPreset[]): Promise<void> {
    this._saving = true;
    try {
      const settings = await getSettings(this.hass);
      const profiles = (settings.options.profiles as Profiles) ?? {};
      const existing = profiles[this.userId] ?? { name: this.userName || this.userId, bindings: {} };
      profiles[this.userId] = {
        ...existing,
        name: this.userName || existing.name || this.userId,
        audio_presets: presets,
      };
      const res = await setSettings(this.hass, { profiles });
      const saved = (res.options.profiles as Profiles) ?? profiles;
      this._presets = saved[this.userId]?.audio_presets ?? presets;
    } finally {
      this._saving = false;
    }
  }

  private _new(): void {
    this._editing = { id: genId(), name: "", items: [], shuffle: false, loop: false, volume_end: null };
  }

  private _edit(preset: AudioPreset): void {
    this._editing = {
      ...preset,
      items: preset.items.map((i) => ({ ...i })),
    };
  }

  private async _delete(preset: AudioPreset): Promise<void> {
    await this._persist(this._presets.filter((p) => p.id !== preset.id));
  }

  private _onBrowserSelect(e: CustomEvent<{ items: PresetItem[] }>): void {
    if (!this._editing) {
      return;
    }
    const have = new Set(this._editing.items.map((i) => i.media_content_id));
    const added = e.detail.items.filter((i) => !have.has(i.media_content_id));
    this._editing = { ...this._editing, items: [...this._editing.items, ...added] };
  }

  private _removeItem(index: number): void {
    if (!this._editing) {
      return;
    }
    this._editing = {
      ...this._editing,
      items: this._editing.items.filter((_, i) => i !== index),
    };
  }

  // --- Drag & drop reordering --------------------------------------------
  private _dragStart(index: number): void {
    this._dragIndex = index;
  }

  private _dragEnter(index: number): void {
    if (this._dragIndex !== null && index !== this._dragOver) {
      this._dragOver = index;
    }
  }

  private _drop(index: number): void {
    const from = this._dragIndex;
    if (from === null || !this._editing || from === index) {
      this._dragIndex = null;
      this._dragOver = null;
      return;
    }
    const items = [...this._editing.items];
    const [moved] = items.splice(from, 1);
    items.splice(index, 0, moved);
    this._editing = { ...this._editing, items };
    this._dragIndex = null;
    this._dragOver = null;
  }

  private _dragEnd(): void {
    this._dragIndex = null;
    this._dragOver = null;
  }

  // --- Playback behaviour ------------------------------------------------
  private _toggleShuffle(): void {
    if (this._editing) this._editing = { ...this._editing, shuffle: !this._editing.shuffle };
  }

  private _toggleLoop(): void {
    if (this._editing) this._editing = { ...this._editing, loop: !this._editing.loop };
  }

  private _toggleVolumeEnd(): void {
    if (!this._editing) return;
    const on = this._editing.volume_end != null;
    this._editing = { ...this._editing, volume_end: on ? null : DEFAULT_END_VOLUME };
  }

  private _setVolumeEnd(v: unknown): void {
    if (this._editing) this._editing = { ...this._editing, volume_end: Number(v ?? 0) };
  }

  private async _saveEditing(): Promise<void> {
    if (!this._editing) {
      return;
    }
    const editing = {
      ...this._editing,
      name: this._editing.name.trim() || localize(this.hass?.language, "presets.untitled"),
    };
    const exists = this._presets.some((p) => p.id === editing.id);
    const next = exists
      ? this._presets.map((p) => (p.id === editing.id ? editing : p))
      : [...this._presets, editing];
    await this._persist(next);
    this._editing = null;
  }

  static styles = [
    auroraStyles,
    css`
      :host {
        display: block;
      }
      ha-icon {
        --mdc-icon-size: 20px;
      }
      .ptop {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 4px;
      }
      .ptop .h {
        font-weight: 600;
        flex: 1;
      }
      .desc {
        font-size: 0.8rem;
        color: var(--aurora-dim);
        margin: 2px 0 10px;
      }
      .plist {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .prow {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--aurora-divider);
        border-radius: 12px;
      }
      .prow .nm {
        font-weight: 600;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .badges {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--aurora-dim);
      }
      .badges ha-icon {
        --mdc-icon-size: 17px;
      }
      .badges .ct {
        font-size: 0.78rem;
      }
      .iconbtn {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        background: transparent;
        cursor: pointer;
        border-radius: 9px;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        color: var(--aurora-text);
        flex: none;
      }
      .iconbtn:hover {
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
      }
      .iconbtn:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .empty {
        font-size: 0.82rem;
        color: var(--aurora-dim);
        font-style: italic;
        padding: 4px 0;
      }
      .editor {
        border: 1px solid var(--aurora-divider);
        border-radius: 14px;
        padding: 14px;
        background: color-mix(in srgb, var(--aurora-dim) 5%, transparent);
      }
      .items {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 12px 0;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 10px;
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
      }
      .item.dragging {
        opacity: 0.45;
      }
      .item.over {
        border-color: var(--aurora-accent);
        box-shadow: inset 0 2px 0 var(--aurora-accent);
      }
      .item .handle {
        cursor: grab;
        color: var(--aurora-dim);
        display: grid;
        place-items: center;
        flex: none;
      }
      .item .handle:active {
        cursor: grabbing;
      }
      .item .thumb {
        width: 34px;
        height: 34px;
        border-radius: 7px;
        flex: none;
        background: var(--aurora-grad-soft);
        background-size: cover;
        background-position: center;
        display: grid;
        place-items: center;
        color: var(--aurora-dim);
      }
      .item .t {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.85rem;
      }
      .item .num {
        font-size: 0.72rem;
        color: var(--aurora-dim);
        width: 16px;
        text-align: right;
        flex: none;
      }
      .addrow {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      /* Media-player-style behaviour bar */
      .behaviour {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--aurora-divider);
      }
      .barlabel {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--aurora-dim);
        margin-bottom: 8px;
      }
      .controls {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ctrl {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        background: transparent;
        cursor: pointer;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        color: var(--aurora-text);
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      .ctrl ha-icon {
        --mdc-icon-size: 22px;
      }
      .ctrl.on {
        background: var(--aurora-accent-grad);
        color: var(--aurora-on-accent);
        border-color: transparent;
      }
      .ctrl .lbl {
        display: none;
      }
      .vol {
        margin-top: 14px;
      }
      .volhead {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .volhead .vt {
        flex: 1;
      }
      .volhead .vt .sub {
        font-size: 0.76rem;
        color: var(--aurora-dim);
      }
      .volslider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
      .volslider ha-selector {
        flex: 1;
      }
      .volslider .pct {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        width: 44px;
        text-align: right;
      }
      .edfoot {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `,
  ];

  render(): TemplateResult {
    const lang = this.hass?.language;
    return html`
      <div class="ptop">
        <span class="h">${localize(lang, "presets.title")}</span>
        ${this._editing
          ? nothing
          : html`<ha-button appearance="outlined" size="small" @click=${this._new}>
              ${localize(lang, "presets.new")}
            </ha-button>`}
      </div>
      <div class="desc">
        ${localize(lang, "presets.desc", {
          name: this.userName || localize(lang, "devices.this_profile"),
        })}
      </div>
      ${this._editing ? this._renderEditor(lang) : this._renderList(lang)}
      <aurora-media-browser
        .hass=${this.hass}
        .entityId=${this.entityId}
        .open=${this._browserOpen}
        .multiple=${true}
        @select=${this._onBrowserSelect}
        @closed=${() => (this._browserOpen = false)}
      ></aurora-media-browser>
    `;
  }

  private _renderList(lang?: string): TemplateResult {
    if (!this._presets.length) {
      return html`<div class="empty">${localize(lang, "presets.empty")}</div>`;
    }
    return html`<div class="plist">
      ${this._presets.map(
        (p) => html`<div class="prow">
          <span class="nm">${p.name}</span>
          <span class="badges">
            ${p.shuffle ? html`<ha-icon icon="mdi:shuffle-variant" title=${localize(lang, "presets.shuffle")}></ha-icon>` : nothing}
            ${p.loop ? html`<ha-icon icon="mdi:repeat" title=${localize(lang, "presets.loop")}></ha-icon>` : nothing}
            ${p.volume_end != null ? html`<ha-icon icon="mdi:volume-medium" title=${localize(lang, "presets.volume_end")}></ha-icon>` : nothing}
            <span class="ct">${localize(lang, "presets.count", { n: p.items.length })}</span>
          </span>
          <button class="iconbtn" title=${localize(lang, "presets.edit")} @click=${() => this._edit(p)}>
            <ha-icon icon="mdi:pencil"></ha-icon>
          </button>
          <button class="iconbtn" title=${localize(lang, "common.delete")} ?disabled=${this._saving} @click=${() => this._delete(p)}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>
          </button>
        </div>`
      )}
    </div>`;
  }

  private _renderEditor(lang?: string): TemplateResult {
    const ed = this._editing!;
    const volOn = ed.volume_end != null;
    return html`<div class="editor">
      <ha-selector
        .hass=${this.hass}
        .selector=${{ text: {} }}
        .label=${localize(lang, "presets.name")}
        .value=${ed.name}
        @value-changed=${(e: CustomEvent) =>
          (this._editing = { ...ed, name: (e.detail.value as string) ?? "" })}
      ></ha-selector>

      ${ed.items.length
        ? html`<div class="items">
            ${ed.items.map((it, i) => this._renderItem(it, i))}
          </div>`
        : html`<div class="empty">${localize(lang, "presets.no_items")}</div>`}

      <div class="addrow">
        <ha-button appearance="outlined" size="small" @click=${() => (this._browserOpen = true)}>
          ${localize(lang, "presets.add_media")}
        </ha-button>
      </div>

      <div class="behaviour">
        <div class="barlabel">${localize(lang, "presets.playback")}</div>
        <div class="controls">
          <button
            class="ctrl ${ed.shuffle ? "on" : ""}"
            title=${localize(lang, "presets.shuffle")}
            aria-pressed=${ed.shuffle ? "true" : "false"}
            @click=${this._toggleShuffle}
          >
            <ha-icon icon="mdi:shuffle-variant"></ha-icon>
          </button>
          <button
            class="ctrl ${ed.loop ? "on" : ""}"
            title=${localize(lang, "presets.loop")}
            aria-pressed=${ed.loop ? "true" : "false"}
            @click=${this._toggleLoop}
          >
            <ha-icon icon="mdi:repeat"></ha-icon>
          </button>
        </div>

        <div class="vol">
          <div class="volhead">
            <ha-icon icon=${volOn ? "mdi:volume-high" : "mdi:volume-off"}></ha-icon>
            <div class="vt">
              <div>${localize(lang, "presets.volume_end")}</div>
              <div class="sub">${localize(lang, "presets.volume_end_desc")}</div>
            </div>
            <ha-switch
              .checked=${volOn}
              @change=${this._toggleVolumeEnd}
            ></ha-switch>
          </div>
          ${volOn
            ? html`<div class="volslider">
                <ha-selector
                  .hass=${this.hass}
                  .selector=${{ number: { min: 0, max: 100, step: 1, mode: "slider" } }}
                  .value=${ed.volume_end ?? DEFAULT_END_VOLUME}
                  @value-changed=${(e: CustomEvent) => this._setVolumeEnd(e.detail.value)}
                ></ha-selector>
                <span class="pct">${ed.volume_end ?? DEFAULT_END_VOLUME}%</span>
              </div>`
            : nothing}
        </div>
      </div>

      <div class="edfoot">
        <ha-button appearance="plain" @click=${() => (this._editing = null)}>
          ${localize(lang, "common.cancel")}
        </ha-button>
        <ha-button appearance="plain" variant="brand" ?disabled=${this._saving} @click=${this._saveEditing}>
          ${this._saving ? localize(lang, "common.saving") : localize(lang, "presets.save")}
        </ha-button>
      </div>
    </div>`;
  }

  private _renderItem(it: PresetItem, i: number): TemplateResult {
    const cls = ["item", this._dragIndex === i ? "dragging" : "", this._dragOver === i ? "over" : ""]
      .filter(Boolean)
      .join(" ");
    const thumb = it.thumbnail ? `background-image:url("${it.thumbnail}")` : "";
    return html`<div
      class=${cls}
      draggable="true"
      @dragstart=${() => this._dragStart(i)}
      @dragenter=${() => this._dragEnter(i)}
      @dragover=${(e: DragEvent) => e.preventDefault()}
      @drop=${() => this._drop(i)}
      @dragend=${this._dragEnd}
    >
      <span class="handle" title=${localize(this.hass?.language, "presets.drag")}>
        <ha-icon icon="mdi:drag-vertical"></ha-icon>
      </span>
      <span class="thumb" style=${thumb}>
        ${it.thumbnail ? nothing : html`<ha-icon icon="mdi:music-note"></ha-icon>`}
      </span>
      <span class="t" title=${it.media_content_id}>${it.title}</span>
      <span class="num">${i + 1}</span>
      <button class="iconbtn" @click=${() => this._removeItem(i)} title=${localize(this.hass?.language, "common.delete")}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`;
  }
}
