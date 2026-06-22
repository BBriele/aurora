import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { fetchActivity, type ActivityEvent } from "./api";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HomeAssistant } from "./types";

/** mdi icon per activity kind — harmonised with the rest of the panel. */
const KIND_ICON: Record<ActivityEvent["kind"], string> = {
  ringing: "mdi:bell-ring",
  snoozed: "mdi:alarm-snooze",
  dismissed: "mdi:check-circle-outline",
  timeout: "mdi:timer-alert-outline",
};

/**
 * "Activity" tab: a per-profile, non-admin-readable timeline of how recent
 * alarms behaved (rang / snoozed / dismissed / timed out, with the mission).
 * Answers "why didn't my AI alarm work?" without needing the HA logs.
 */
@customElement("aurora-activity-view")
export class AuroraActivityView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _events: ActivityEvent[] = [];
  @state() private _loaded = false;

  protected firstUpdated(): void {
    void this._load();
  }

  private async _load(): Promise<void> {
    try {
      this._events = await fetchActivity(this.hass);
    } catch {
      this._events = [];
    } finally {
      this._loaded = true;
    }
  }

  private _when(ts: string): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString(this.hass?.language, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _describe(e: ActivityEvent): string {
    const lang = this.hass?.language;
    if (e.kind === "ringing") {
      const mission = e.detail?.mission;
      const base = localize(lang, "activity.kind_ringing");
      if (mission && mission !== "tap") {
        return `${base} — ${localize(lang, "activity.mission")}: ${localize(lang, "mission." + mission)}`;
      }
      return base;
    }
    if (e.kind === "snoozed") {
      const n = e.detail?.count ?? 1;
      return `${localize(lang, "activity.kind_snoozed")} (×${n})`;
    }
    return localize(lang, "activity.kind_" + e.kind);
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
        gap: 12px;
        margin-bottom: 8px;
      }
      .head h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .head .spacer {
        flex: 1;
      }
      .refresh {
        appearance: none;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--aurora-dim);
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
      }
      .refresh:hover {
        background: var(--aurora-grad-soft);
        color: var(--aurora-text);
      }
      .refresh ha-icon {
        --mdc-icon-size: 20px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 2px;
        border-top: 1px solid var(--aurora-divider);
      }
      .row:first-of-type {
        border-top: none;
      }
      .ic {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: var(--aurora-grad-soft);
        flex: none;
      }
      .ic ha-icon {
        --mdc-icon-size: 20px;
        color: var(--aurora-accent);
      }
      .ic.timeout ha-icon {
        color: var(--aurora-warn, #e0a030);
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }
      .meta .label {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .meta .desc {
        font-size: 0.82rem;
        color: var(--aurora-dim);
      }
      .when {
        font-size: 0.78rem;
        color: var(--aurora-dim);
        white-space: nowrap;
        flex: none;
      }
      .empty {
        text-align: center;
        padding: 30px 12px;
        color: var(--aurora-dim);
      }
      .empty ha-icon {
        --mdc-icon-size: 42px;
        color: var(--aurora-dim);
      }
    `,
  ];

  render(): TemplateResult {
    const lang = this.hass?.language;
    return html`
      <div class="card">
        <div class="head">
          <h3>${localize(lang, "activity.title")}</h3>
          <span class="spacer"></span>
          <button
            class="refresh"
            @click=${this._load}
            aria-label=${localize(lang, "activity.refresh")}
          >
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
        </div>
        ${!this._loaded
          ? html`<div class="empty">${localize(lang, "common.loading")}</div>`
          : this._events.length === 0
            ? html`<div class="empty">
                <div><ha-icon icon="mdi:history"></ha-icon></div>
                ${localize(lang, "activity.empty")}
              </div>`
            : this._events.map(
                (e) => html`<div class="row">
                  <div class="ic ${e.kind}"><ha-icon icon=${KIND_ICON[e.kind]}></ha-icon></div>
                  <div class="meta">
                    <span class="label">${e.label || localize(lang, "alarms.default_label")}</span>
                    <span class="desc">${this._describe(e)}</span>
                  </div>
                  <span class="when">${this._when(e.ts)}</span>
                </div>`
              )}
      </div>
    `;
  }
}
