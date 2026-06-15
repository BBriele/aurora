/**
 * Aurora card — Phase 0 placeholder (dependency-free, no build step required).
 *
 * The full Lit/TypeScript card (with visual editor + progressive disclosure)
 * builds from ../../aurora-card/src and overwrites this file. Until then this
 * vanilla element gives a working card: live alarm list (via the
 * `aurora/alarms/subscribe` WebSocket) plus state and ring controls.
 */
class AuroraCard extends HTMLElement {
  constructor() {
    super();
    this._alarms = new Map();
    this._unsub = null;
  }

  setConfig(config) {
    this._config = config || {};
  }

  getCardSize() {
    return 3;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._unsub) this._subscribe();
    this._render();
  }

  connectedCallback() {
    if (this._hass && !this._unsub) this._subscribe();
  }

  disconnectedCallback() {
    if (this._unsub) {
      this._unsub.then((u) => u && u()).catch(() => {});
      this._unsub = null;
    }
  }

  _subscribe() {
    if (!this._hass) return;
    this._unsub = this._hass.connection.subscribeMessage(
      (ev) => {
        if (ev.type === "added" || ev.type === "updated") {
          this._alarms.set(ev.item.id, ev.item);
        } else if (ev.type === "removed") {
          this._alarms.delete(ev.item_id);
        }
        this._render();
      },
      { type: "aurora/alarms/subscribe" }
    );
  }

  _state(entityId) {
    const s = this._hass && this._hass.states[entityId];
    return s ? s.state : "—";
  }

  _call(service, data) {
    this._hass.callService("aurora", service, data || {});
  }

  _render() {
    if (!this._hass) return;
    const ringing = this._state("binary_sensor.aurora_ringing") === "on";
    const state = this._state("sensor.aurora_state");
    const next = this._hass.states["sensor.aurora_next_alarm"];
    const nextTxt = next && next.state && next.state !== "unknown"
      ? new Date(next.state).toLocaleString()
      : "No alarm scheduled";

    const alarms = [...this._alarms.values()].sort((a, b) =>
      (a.time || "").localeCompare(b.time || "")
    );

    const rows = alarms
      .map(
        (a) => `
        <div class="row">
          <div class="t">${a.time || ""}</div>
          <div class="l">${a.label || "Alarm"}</div>
          <div class="act">
            <button data-act="toggle" data-id="${a.id}" data-on="${!a.enabled}">
              ${a.enabled ? "On" : "Off"}
            </button>
            <button data-act="remove" data-id="${a.id}">✕</button>
          </div>
        </div>`
      )
      .join("");

    this.innerHTML = `
      <ha-card header="${(this._config && this._config.title) || "Aurora"}">
        <style>
          .body { padding: 0 16px 16px; }
          .status { display:flex; justify-content:space-between; padding:8px 0; opacity:.85; }
          .next { font-size:1.4em; margin:4px 0 12px; }
          .row { display:flex; align-items:center; gap:10px; padding:6px 0; border-top:1px solid var(--divider-color); }
          .row .t { font-weight:600; width:64px; }
          .row .l { flex:1; }
          button { cursor:pointer; border:none; border-radius:8px; padding:6px 10px; background:var(--primary-color); color:var(--text-primary-color); }
          .ring { display:${ringing ? "flex" : "none"}; gap:10px; margin:12px 0; }
          .ring button.stop { background: var(--error-color); }
          .empty { opacity:.6; padding:8px 0; }
        </style>
        <div class="body">
          <div class="status"><span>State: ${state}</span></div>
          <div class="next">⏰ ${nextTxt}</div>
          <div class="ring">
            <button class="stop" data-act="dismiss">Stop</button>
            <button data-act="snooze">Snooze</button>
          </div>
          ${rows || '<div class="empty">No alarms yet. Add one from the integration page or service.</div>'}
        </div>
      </ha-card>
    `;

    this.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        if (act === "dismiss") this._call("dismiss");
        else if (act === "snooze") this._call("snooze");
        else if (act === "remove") this._call("remove_alarm", { id });
        else if (act === "toggle")
          this._call("update_alarm", {
            id,
            enabled: btn.getAttribute("data-on") === "true",
          });
      });
    });
  }
}

if (!customElements.get("aurora-card")) {
  customElements.define("aurora-card", AuroraCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "aurora-card",
  name: "Aurora",
  description: "Smart modular alarm clock",
  preview: true,
  documentationURL: "https://github.com/gabriel-antico/aurora",
});
