import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { deleteAlarm, subscribeAlarms, updateAlarm } from "./api";
import "./alarm-dialog";
import { localize, weekdayLetters } from "./localize";
import { auroraStyles } from "./theme";
import { type Alarm, type HomeAssistant } from "./types";

function summarize(alarm: Alarm, language: string | undefined): string {
  const s = alarm.schedule;
  if (s.repeat_mode === "daily") return localize(language, "summary.daily");
  if (s.repeat_mode === "once")
    return s.on_date
      ? localize(language, "summary.on_date", { date: s.on_date })
      : localize(language, "summary.once");
  if (!s.weekdays?.length) return localize(language, "summary.never");
  if (s.weekdays.length === 7) return localize(language, "summary.daily");
  return s.weekdays.map((d) => weekdayLetters(language)[d]).join(" ");
}

@customElement("aurora-alarm-list")
export class AuroraAlarmList extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  /** When set, only show (and create) alarms for this profile. */
  @property({ attribute: false }) profileId: string | null = null;
  @property({ type: Boolean }) showAll = false;

  @state() private _alarms: Alarm[] = [];
  @state() private _loaded = false;
  @state() private _editing: Alarm | null = null;
  @state() private _dialogOpen = false;

  private _unsub?: Promise<() => void>;

  connectedCallback(): void {
    super.connectedCallback();
    this._subscribe();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsub?.then((u) => u()).catch(() => undefined);
    this._unsub = undefined;
  }

  updated(): void {
    if (this.hass && !this._unsub) this._subscribe();
  }

  private _subscribe(): void {
    if (!this.hass || this._unsub) return;
    this._unsub = subscribeAlarms(this.hass, (alarms) => {
      this._alarms = alarms;
      this._loaded = true;
    });
  }

  private _add(): void {
    this._editing = null;
    this._dialogOpen = true;
  }

  private _edit(alarm: Alarm): void {
    this._editing = alarm;
    this._dialogOpen = true;
  }

  static styles = [
    auroraStyles,
    css`
      .head {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      .head h3 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-radius: var(--aurora-radius);
        background: var(--aurora-grad-soft);
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.2s ease;
      }
      .item:hover {
        box-shadow: var(--aurora-shadow);
      }
      .item.off {
        opacity: 0.55;
      }
      .time {
        font-size: 1.9rem;
        min-width: 96px;
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .meta .name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .meta .when {
        font-size: 0.82rem;
        color: var(--aurora-dim);
        letter-spacing: 0.06em;
      }
      .badge {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--aurora-accent);
        background: color-mix(in srgb, var(--aurora-accent) 14%, transparent);
        padding: 2px 7px;
        border-radius: 6px;
        margin-left: 6px;
      }
      .empty {
        text-align: center;
        padding: 34px 12px;
        color: var(--aurora-dim);
      }
      .empty .big {
        font-size: 2.4rem;
        margin-bottom: 8px;
      }
    `,
  ];

  private get _visible(): Alarm[] {
    if (this.showAll || !this.profileId) return this._alarms;
    return this._alarms.filter((a) => (a.profile_id ?? null) === this.profileId);
  }

  render(): TemplateResult {
    const visible = this._visible;
    return html`
      <div class="head">
        <h3>${localize(this.hass?.language, "alarms.title")}</h3>
        <span class="spacer"></span>
        <button class="btn primary" @click=${this._add}>${localize(this.hass?.language, "alarms.new")}</button>
      </div>

      ${!this._loaded
        ? html`<div class="empty"><div class="big">⏳</div>${localize(this.hass?.language, "common.loading")}</div>`
        : visible.length === 0
          ? html`<div class="empty">
              <div class="big">🌙</div>
              ${localize(this.hass?.language, "alarms.empty")}
            </div>`
          : html`<div class="list">
              ${visible.map((a) => this._row(a))}
            </div>`}

      <aurora-alarm-dialog
        .hass=${this.hass}
        .alarm=${this._editing}
        .profileId=${this.profileId}
        .open=${this._dialogOpen}
        @closed=${() => (this._dialogOpen = false)}
      ></aurora-alarm-dialog>
    `;
  }

  private _row(a: Alarm): TemplateResult {
    return html`
      <div class="item ${a.enabled ? "" : "off"}" @click=${() => this._edit(a)}>
        <div class="time clock">${a.time}</div>
        <div class="meta">
          <div class="name">
            ${a.label || localize(this.hass?.language, "alarms.default_label")}${a.skip_next
              ? html`<span class="badge">${localize(this.hass?.language, "alarms.skip_badge")}</span>`
              : nothing}
          </div>
          <div class="when">${summarize(a, this.hass?.language)}</div>
        </div>
        <span class="spacer"></span>
        <button
          class="icon-btn"
          title=${localize(this.hass?.language, "alarms.skip_title")}
          @click=${(e: Event) => {
            e.stopPropagation();
            updateAlarm(this.hass, a.id, { skip_next: !a.skip_next });
          }}
        >
          ${a.skip_next ? "⏭" : "⤼"}
        </button>
        <button
          class="icon-btn"
          title=${localize(this.hass?.language, "common.delete")}
          @click=${(e: Event) => {
            e.stopPropagation();
            deleteAlarm(this.hass, a.id);
          }}
        >
          🗑
        </button>
        <div
          class="switch"
          role="switch"
          aria-checked=${a.enabled ? "true" : "false"}
          @click=${(e: Event) => {
            e.stopPropagation();
            updateAlarm(this.hass, a.id, { enabled: !a.enabled });
          }}
        ></div>
      </div>
    `;
  }
}
