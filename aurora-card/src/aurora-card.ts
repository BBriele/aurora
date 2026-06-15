/**
 * Aurora Lovelace card (Lit + TypeScript).
 *
 * Phase 0 scope: a working card that subscribes to the alarm collection over the
 * `aurora/alarms/subscribe` WebSocket and exposes state + ring controls. The full
 * progressive-disclosure UX and visual editor land in Phase 4. The card consumes
 * only stable read-models and services — it never knows about adapters.
 */
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardConfig } from "custom-card-helpers";

interface AuroraCardConfig extends LovelaceCardConfig {
  title?: string;
}

interface Alarm {
  id: string;
  time: string;
  label: string;
  enabled: boolean;
  owner?: string | null;
}

interface CollectionEvent {
  type: "added" | "updated" | "removed";
  item?: Alarm;
  item_id?: string;
}

@customElement("aurora-card")
export class AuroraCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config: AuroraCardConfig = {};
  @state() private _alarms: Alarm[] = [];

  private _items = new Map<string, Alarm>();
  private _unsub?: Promise<() => void>;

  public setConfig(config: AuroraCardConfig): void {
    this._config = config ?? {};
  }

  public getCardSize(): number {
    return 3;
  }

  public static getStubConfig(): AuroraCardConfig {
    return { title: "Aurora" };
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._subscribe();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsub?.then((u) => u()).catch(() => undefined);
    this._unsub = undefined;
  }

  protected updated(): void {
    if (this.hass && !this._unsub) this._subscribe();
  }

  private _subscribe(): void {
    if (!this.hass || this._unsub) return;
    this._unsub = this.hass.connection.subscribeMessage<CollectionEvent>(
      (ev) => {
        if ((ev.type === "added" || ev.type === "updated") && ev.item) {
          this._items.set(ev.item.id, ev.item);
        } else if (ev.type === "removed" && ev.item_id) {
          this._items.delete(ev.item_id);
        }
        this._alarms = [...this._items.values()].sort((a, b) =>
          (a.time ?? "").localeCompare(b.time ?? "")
        );
      },
      { type: "aurora/alarms/subscribe" }
    );
  }

  private _stateOf(entityId: string): string {
    return this.hass?.states[entityId]?.state ?? "—";
  }

  private _call(service: string, data: Record<string, unknown> = {}): void {
    this.hass.callService("aurora", service, data);
  }

  protected render(): TemplateResult {
    if (!this.hass) return html`${nothing}`;

    const ringing = this._stateOf("binary_sensor.aurora_ringing") === "on";
    const next = this.hass.states["sensor.aurora_next_alarm"];
    const nextTxt =
      next && next.state && next.state !== "unknown"
        ? new Date(next.state).toLocaleString()
        : "No alarm scheduled";

    return html`
      <ha-card .header=${this._config.title ?? "Aurora"}>
        <div class="body">
          <div class="status">State: ${this._stateOf("sensor.aurora_state")}</div>
          <div class="next">⏰ ${nextTxt}</div>
          ${ringing
            ? html`<div class="ring">
                <button class="stop" @click=${() => this._call("dismiss")}>
                  Stop
                </button>
                <button @click=${() => this._call("snooze")}>Snooze</button>
              </div>`
            : nothing}
          ${this._alarms.length
            ? this._alarms.map((a) => this._renderAlarm(a))
            : html`<div class="empty">
                No alarms yet. Add one from the integration page or the
                <code>aurora.add_alarm</code> action.
              </div>`}
        </div>
      </ha-card>
    `;
  }

  private _renderAlarm(a: Alarm): TemplateResult {
    return html`
      <div class="row">
        <div class="t">${a.time}</div>
        <div class="l">${a.label || "Alarm"}</div>
        <div class="act">
          <button
            @click=${() =>
              this._call("update_alarm", { id: a.id, enabled: !a.enabled })}
          >
            ${a.enabled ? "On" : "Off"}
          </button>
          <button @click=${() => this._call("remove_alarm", { id: a.id })}>
            ✕
          </button>
        </div>
      </div>
    `;
  }

  static styles = css`
    .body {
      padding: 0 16px 16px;
    }
    .status {
      padding: 8px 0;
      opacity: 0.85;
    }
    .next {
      font-size: 1.4em;
      margin: 4px 0 12px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-top: 1px solid var(--divider-color);
    }
    .row .t {
      font-weight: 600;
      width: 64px;
    }
    .row .l {
      flex: 1;
    }
    .ring {
      display: flex;
      gap: 10px;
      margin: 12px 0;
    }
    button {
      cursor: pointer;
      border: none;
      border-radius: 8px;
      padding: 6px 10px;
      background: var(--primary-color);
      color: var(--text-primary-color);
    }
    .ring button.stop {
      background: var(--error-color);
    }
    .empty {
      opacity: 0.6;
      padding: 8px 0;
    }
  `;
}

(window as unknown as { customCards: unknown[] }).customCards =
  (window as unknown as { customCards: unknown[] }).customCards || [];
(window as unknown as { customCards: unknown[] }).customCards.push({
  type: "aurora-card",
  name: "Aurora",
  description: "Smart modular alarm clock",
  preview: true,
  documentationURL: "https://github.com/gabriel-antico/aurora",
});

declare global {
  interface HTMLElementTagNameMap {
    "aurora-card": AuroraCard;
  }
}
