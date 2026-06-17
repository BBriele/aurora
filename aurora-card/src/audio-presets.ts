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

/**
 * Per-profile audio preset manager, embedded in the Setup Audio card.
 *
 * A preset is a named, reusable sound or ordered playlist built from Home
 * Assistant media (via aurora-media-browser) or pasted URIs. Presets are stored
 * under options.profiles[userId].audio_presets and referenced by an alarm's
 * audio source as "aurora_preset:<id>".
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
    this._editing = { id: genId(), name: "", items: [] };
  }

  private _edit(preset: AudioPreset): void {
    this._editing = { ...preset, items: preset.items.map((i) => ({ ...i })) };
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

  private _move(index: number, dir: -1 | 1): void {
    if (!this._editing) {
      return;
    }
    const items = [...this._editing.items];
    const to = index + dir;
    if (to < 0 || to >= items.length) {
      return;
    }
    [items[index], items[to]] = [items[to], items[index]];
    this._editing = { ...this._editing, items };
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
      .prow .ct {
        font-size: 0.78rem;
        color: var(--aurora-dim);
      }
      .iconbtn {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        background: transparent;
        cursor: pointer;
        border-radius: 9px;
        width: 32px;
        height: 32px;
        font-size: 15px;
        color: var(--aurora-text);
        flex: none;
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
        border-radius: 12px;
        padding: 12px;
        background: color-mix(in srgb, var(--aurora-dim) 5%, transparent);
      }
      .items {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 10px 0;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 9px;
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
      }
      .item .t {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.85rem;
      }
      .addrow {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .edfoot {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
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
          <span class="ct">${localize(lang, "presets.count", { n: p.items.length })}</span>
          <button class="iconbtn" title=${localize(lang, "presets.edit")} @click=${() => this._edit(p)}>✎</button>
          <button class="iconbtn" title=${localize(lang, "common.delete")} ?disabled=${this._saving} @click=${() => this._delete(p)}>🗑</button>
        </div>`
      )}
    </div>`;
  }

  private _renderEditor(lang?: string): TemplateResult {
    const ed = this._editing!;
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
            ${ed.items.map(
              (it, i) => html`<div class="item">
                <span class="t" title=${it.media_content_id}>${it.title}</span>
                <button class="iconbtn" ?disabled=${i === 0} @click=${() => this._move(i, -1)}>↑</button>
                <button class="iconbtn" ?disabled=${i === ed.items.length - 1} @click=${() => this._move(i, 1)}>↓</button>
                <button class="iconbtn" @click=${() => this._removeItem(i)}>✕</button>
              </div>`
            )}
          </div>`
        : html`<div class="empty">${localize(lang, "presets.no_items")}</div>`}

      <div class="addrow">
        <ha-button appearance="outlined" size="small" @click=${() => (this._browserOpen = true)}>
          ${localize(lang, "presets.add_media")}
        </ha-button>
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
}
