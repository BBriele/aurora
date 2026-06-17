import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { browseMedia, type BrowseMedia } from "./api";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HomeAssistant, PresetItem } from "./types";

/**
 * A themed media picker overlay over Home Assistant's media-browse tree.
 *
 * Navigates folders, adds playable entries, and accepts a pasted URI. With
 * `multiple` it builds a selection tray (for playlists); otherwise the first
 * pick closes immediately. Emits `select` with `{ items: PresetItem[] }`, or
 * `closed` when dismissed. It is a self-contained overlay (no nested dialog).
 */
@customElement("aurora-media-browser")
export class AuroraMediaBrowser extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  /** Bind a player for its full source tree; null browses media sources only. */
  @property({ attribute: false }) entityId: string | null = null;
  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) multiple = false;

  @state() private _stack: BrowseMedia[] = [];
  @state() private _loading = false;
  @state() private _error = "";
  @state() private _selected: PresetItem[] = [];
  @state() private _uri = "";
  private _opened = false;

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("open")) {
      if (this.open && !this._opened) {
        this._opened = true;
        this._stack = [];
        this._selected = [];
        this._uri = "";
        this._error = "";
        void this._browse();
      } else if (!this.open) {
        this._opened = false;
      }
    }
  }

  private get _current(): BrowseMedia | undefined {
    return this._stack[this._stack.length - 1];
  }

  private async _browse(node?: BrowseMedia): Promise<void> {
    this._loading = true;
    this._error = "";
    try {
      const result = await browseMedia(
        this.hass,
        this.entityId,
        node?.media_content_id,
        node?.media_content_type
      );
      this._stack = node ? [...this._stack, result] : [result];
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private _up(toIndex: number): void {
    if (toIndex < this._stack.length - 1) {
      this._stack = this._stack.slice(0, toIndex + 1);
    }
  }

  private _add(node: BrowseMedia): void {
    const item: PresetItem = {
      media_content_id: node.media_content_id,
      media_content_type: node.media_content_type,
      title: node.title,
    };
    if (!this.multiple) {
      this._emitSelect([item]);
      return;
    }
    if (!this._selected.some((s) => s.media_content_id === item.media_content_id)) {
      this._selected = [...this._selected, item];
    }
  }

  private _removeSelected(id: string): void {
    this._selected = this._selected.filter((s) => s.media_content_id !== id);
  }

  private _addUri(): void {
    const uri = this._uri.trim();
    if (!uri) {
      return;
    }
    const item: PresetItem = {
      media_content_id: uri,
      media_content_type: "music",
      title: uri,
    };
    if (!this.multiple) {
      this._emitSelect([item]);
      return;
    }
    if (!this._selected.some((s) => s.media_content_id === uri)) {
      this._selected = [...this._selected, item];
    }
    this._uri = "";
  }

  private _confirm(): void {
    if (this._selected.length) {
      this._emitSelect(this._selected);
    }
  }

  private _emitSelect(items: PresetItem[]): void {
    this.dispatchEvent(new CustomEvent("select", { detail: { items } }));
    this._close();
  }

  private _close(): void {
    this.open = false;
    this._opened = false;
    this.dispatchEvent(new CustomEvent("closed"));
  }

  static styles = [
    auroraStyles,
    css`
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 20;
        background: rgba(0, 0, 0, 0.45);
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .sheet {
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius);
        box-shadow: var(--aurora-shadow);
        width: min(560px, 100%);
        max-height: 86vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 18px 10px;
      }
      .head h3 {
        margin: 0;
        font-size: 1.1rem;
        flex: 1;
      }
      .x {
        appearance: none;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--aurora-dim);
        font-size: 20px;
        line-height: 1;
        padding: 4px;
      }
      .crumbs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 0 18px 8px;
        font-size: 0.82rem;
        color: var(--aurora-dim);
      }
      .crumbs button {
        appearance: none;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--aurora-accent);
        font: inherit;
        padding: 0;
      }
      .crumbs .sep {
        opacity: 0.5;
      }
      .list {
        overflow-y: auto;
        padding: 4px 10px;
        flex: 1;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 8px;
        border-radius: 12px;
        cursor: pointer;
        appearance: none;
        border: none;
        background: transparent;
        color: var(--aurora-text);
        font: inherit;
        text-align: left;
      }
      .row:hover {
        background: color-mix(in srgb, var(--aurora-dim) 10%, transparent);
      }
      .row .ic {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        display: grid;
        place-items: center;
        font-size: 17px;
        background: var(--aurora-grad-soft);
        flex: none;
        background-size: cover;
        background-position: center;
      }
      .row .t {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .addbtn {
        appearance: none;
        border: none;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--aurora-accent-grad);
        color: var(--aurora-on-accent);
        font-size: 17px;
        line-height: 1;
        flex: none;
      }
      .row .chev {
        color: var(--aurora-dim);
        flex: none;
      }
      .uri {
        display: flex;
        gap: 8px;
        padding: 10px 18px;
        border-top: 1px solid var(--aurora-divider);
      }
      .uri input {
        flex: 1;
      }
      .tray {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 18px 0;
      }
      .tray .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 6px 5px 11px;
        border-radius: 999px;
        background: var(--aurora-accent-grad);
        color: var(--aurora-on-accent);
        font-size: 0.8rem;
        font-weight: 600;
        max-width: 100%;
      }
      .tray .pill span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tray .pill button {
        appearance: none;
        border: none;
        cursor: pointer;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--aurora-on-accent) 22%, transparent);
        color: var(--aurora-on-accent);
        font-size: 12px;
        line-height: 1;
        flex: none;
      }
      .foot {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 12px 18px 16px;
      }
      .state {
        padding: 24px 18px;
        text-align: center;
        color: var(--aurora-dim);
      }
    `,
  ];

  render(): TemplateResult | typeof nothing {
    if (!this.open) {
      return nothing;
    }
    const lang = this.hass?.language;
    const cur = this._current;
    const children = cur?.children ?? [];
    return html`
      <div class="scrim" @click=${(e: Event) => e.target === e.currentTarget && this._close()}>
        <div class="sheet">
          <div class="head">
            <h3>${localize(lang, "browser.title")}</h3>
            <button class="x" @click=${this._close} aria-label=${localize(lang, "common.cancel")}>✕</button>
          </div>

          ${this._stack.length
            ? html`<div class="crumbs">
                ${this._stack.map((node, i) =>
                  i === this._stack.length - 1
                    ? html`<span>${this._crumb(node, lang)}</span>`
                    : html`<button @click=${() => this._up(i)}>${this._crumb(node, lang)}</button><span class="sep">›</span>`
                )}
              </div>`
            : nothing}

          <div class="list">
            ${this._loading
              ? html`<div class="state">${localize(lang, "common.loading")}</div>`
              : this._error
                ? html`<div class="state">${this._error}</div>`
                : children.length
                  ? children.map((c) => this._row(c))
                  : html`<div class="state">${localize(lang, "browser.empty")}</div>`}
          </div>

          ${this.multiple && this._selected.length
            ? html`<div class="tray">
                ${this._selected.map(
                  (s) => html`<span class="pill" title=${s.media_content_id}>
                    <span>${s.title}</span>
                    <button @click=${() => this._removeSelected(s.media_content_id)}>✕</button>
                  </span>`
                )}
              </div>`
            : nothing}

          <div class="uri">
            <ha-selector
              .hass=${this.hass}
              .selector=${{ text: {} }}
              .label=${localize(lang, "browser.paste")}
              .value=${this._uri}
              @value-changed=${(e: CustomEvent) => (this._uri = (e.detail.value as string) ?? "")}
            ></ha-selector>
            <ha-button appearance="outlined" ?disabled=${!this._uri.trim()} @click=${this._addUri}>
              ${localize(lang, "browser.paste_add")}
            </ha-button>
          </div>

          <div class="foot">
            <ha-button appearance="plain" @click=${this._close}>
              ${localize(lang, "common.cancel")}
            </ha-button>
            ${this.multiple
              ? html`<ha-button
                  appearance="plain"
                  variant="brand"
                  ?disabled=${!this._selected.length}
                  @click=${this._confirm}
                >
                  ${localize(lang, "browser.add_selected", { n: this._selected.length })}
                </ha-button>`
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private _crumb(node: BrowseMedia, lang?: string): string {
    return node.media_content_id ? node.title : localize(lang, "browser.root");
  }

  private _row(node: BrowseMedia): TemplateResult {
    const thumb = node.thumbnail
      ? `background-image:url("${node.thumbnail}")`
      : "";
    const icon = node.can_expand ? "📁" : "🎵";
    const onRow = node.can_expand
      ? () => this._browse(node)
      : node.can_play
        ? () => this._add(node)
        : undefined;
    return html`
      <button class="row" @click=${onRow} ?disabled=${!onRow}>
        <span class="ic" style=${thumb}>${thumb ? "" : icon}</span>
        <span class="t" title=${node.media_content_id}>${node.title}</span>
        ${node.can_play && node.can_expand
          ? html`<span
              class="addbtn"
              role="button"
              @click=${(e: Event) => {
                e.stopPropagation();
                this._add(node);
              }}
              >＋</span
            >`
          : nothing}
        ${node.can_expand ? html`<span class="chev">›</span>` : nothing}
      </button>
    `;
  }
}
