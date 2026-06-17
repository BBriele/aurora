import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { subscribeAlarms } from "./api";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import { type Alarm, type HomeAssistant } from "./types";

const DAYS = 7;

/** Local YYYY-MM-DD (not UTC — `on_date` is a local calendar date). */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Weekday index with Monday = 0 (Aurora's convention), from a JS Date. */
function mondayIdx(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function firesOn(alarm: Alarm, date: Date): boolean {
  if (!alarm.enabled) return false;
  const s = alarm.schedule;
  if (s.repeat_mode === "daily") return true;
  if (s.repeat_mode === "once") return !!s.on_date && s.on_date === ymd(date);
  return (s.weekdays ?? []).includes(mondayIdx(date));
}

interface DayCell {
  date: Date;
  today: boolean;
  entries: { alarm: Alarm; skipped: boolean }[];
}

@customElement("aurora-schedule-card")
export class AuroraScheduleCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  /** When set (and not showAll), only show alarms for this profile. */
  @property({ attribute: false }) profileId: string | null = null;
  @property({ type: Boolean }) showAll = false;

  @state() private _alarms: Alarm[] = [];
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
    });
  }

  private get _visible(): Alarm[] {
    if (this.showAll || !this.profileId) return this._alarms;
    return this._alarms.filter((a) => (a.profile_id ?? null) === this.profileId);
  }

  /** First day (within a fortnight) an alarm fires — used to flag skip_next. */
  private _firstOccurrence(alarm: Alarm): string | null {
    const d = new Date();
    for (let i = 0; i < 14; i++) {
      if (firesOn(alarm, d)) return ymd(d);
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  private get _week(): DayCell[] {
    const alarms = this._visible;
    const firstByAlarm = new Map<string, string | null>(
      alarms.map((a) => [a.id, a.skip_next ? this._firstOccurrence(a) : null])
    );
    const cells: DayCell[] = [];
    const base = new Date();
    for (let i = 0; i < DAYS; i++) {
      const date = new Date(base);
      date.setDate(base.getDate() + i);
      const key = ymd(date);
      const entries = alarms
        .filter((a) => firesOn(a, date))
        .sort((x, y) => x.time.localeCompare(y.time))
        .map((a) => ({ alarm: a, skipped: firstByAlarm.get(a.id) === key }));
      cells.push({ date, today: i === 0, entries });
    }
    return cells;
  }

  static styles = [
    auroraStyles,
    css`
      .card {
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius);
        padding: 18px 20px;
      }
      .head {
        display: flex;
        align-items: center;
        margin-bottom: 14px;
      }
      .head h3 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
      }
      .week {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(7, 1fr);
      }
      .day {
        background: var(--aurora-grad-soft);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius-sm);
        padding: 10px 10px 12px;
        min-height: 92px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .day.today {
        border-color: color-mix(in srgb, var(--aurora-accent) 55%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aurora-accent) 35%, transparent);
      }
      .dh {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .dow {
        font-weight: 700;
        font-size: 0.74rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--aurora-dim);
      }
      .day.today .dow {
        color: var(--aurora-accent);
      }
      .dnum {
        font-weight: 700;
        font-size: 1rem;
      }
      .chips {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .chip {
        align-self: flex-start;
        background: color-mix(in srgb, var(--aurora-accent) 16%, transparent);
        color: var(--aurora-accent);
        font-weight: 700;
        font-size: 0.82rem;
        padding: 3px 9px;
        border-radius: 8px;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .chip small {
        color: var(--aurora-dim);
        font-weight: 600;
        margin-left: 5px;
      }
      .chip.skip {
        text-decoration: line-through;
        color: var(--aurora-dim);
        background: color-mix(in srgb, var(--aurora-dim) 14%, transparent);
      }
      .none {
        color: var(--aurora-dim);
        opacity: 0.5;
        font-size: 1.1rem;
      }
      /* Mobile: the 7 columns become rows (weekday → row of time chips). */
      @media (max-width: 640px) {
        .week {
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .day {
          flex-direction: row;
          align-items: center;
          min-height: 0;
          padding: 10px 12px;
        }
        .dh {
          flex: 0 0 76px;
          flex-direction: column;
          gap: 0;
          align-items: flex-start;
        }
        .chips {
          flex-direction: row;
          flex-wrap: wrap;
        }
      }
    `,
  ];

  render(): TemplateResult {
    const lang = this.hass?.language;
    const short = localize(lang, "weekday.short").split(",");
    return html`
      <div class="card">
        <div class="head"><h3>${localize(lang, "schedule.title")}</h3></div>
        <div class="week">
          ${this._week.map(
            (cell) => html`
              <div class="day ${cell.today ? "today" : ""}">
                <div class="dh">
                  <span class="dow">${short[mondayIdx(cell.date)]}</span>
                  <span class="dnum">${cell.date.getDate()}</span>
                </div>
                <div class="chips">
                  ${cell.entries.length === 0
                    ? html`<span class="none">—</span>`
                    : cell.entries.map(
                        (e) => html`<span
                          class="chip ${e.skipped ? "skip" : ""}"
                          title=${e.alarm.label || ""}
                        >
                          <span class="clock">${e.alarm.time}</span>
                          ${e.alarm.label ? html`<small>${e.alarm.label}</small>` : nothing}
                        </span>`
                      )}
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }
}
