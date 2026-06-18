import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { getSettings, visionCheck } from "./api";
import { localize } from "./localize";
import {
  degradeMission,
  makeMath,
  SHAKE_DEFAULT_COUNT,
  SHAKE_THRESHOLD,
  shakeMagnitude,
  type MathProblem,
} from "./missions";
import { auroraStyles } from "./theme";
import type { HomeAssistant, MissionType } from "./types";

const VISION_MAX_FAILS_DEFAULT = 3;

interface MissionConfig {
  type: MissionType;
  params?: Record<string, unknown>;
  vision_prompt?: string | null;
}

/**
 * Anti-snooze challenge shown over the ring. Emits `solved` once the active
 * mission is completed. Falls back to a simpler mission (and ultimately a tap)
 * when the device/setup can't run the requested one.
 */
@customElement("aurora-mission-overlay")
export class AuroraMissionOverlay extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) mission: MissionConfig = { type: "tap" };
  @property({ attribute: false }) alarmId: string | null = null;

  @state() private _active: MissionType = "tap";
  @state() private _checking = false;
  @state() private _visionFails = 0;
  @state() private _math: MathProblem | null = null;
  @state() private _input = "";
  @state() private _wrong = false;
  @state() private _shakes = 0;
  @state() private _needMotionPerm = false;
  @state() private _notice = "";

  private _solved = false;
  private _doorWasOpen = false;
  private _last?: { x: number; y: number; z: number };
  private _stream?: MediaStream;
  private _scanTimer?: number;
  private _motionHandler?: (e: DeviceMotionEvent) => void;
  /** Resolved max vision fails: per-profile > global > built-in default. */
  private _visionMaxFails = VISION_MAX_FAILS_DEFAULT;

  connectedCallback(): void {
    super.connectedCallback();
    this._start(this.mission.type || "tap");
    void this._resolveVisionMaxFails();
  }

  private async _resolveVisionMaxFails(): Promise<void> {
    try {
      const settings = await getSettings(this.hass);
      const options = settings.options;
      const profiles = (options["profiles"] as Record<string, Record<string, unknown>>) ?? {};
      // Determine the owner profile id from the alarm (not available directly on
      // MissionConfig — we look up all profiles and find the one bound to the
      // hass user as a best-effort; the overlay doesn't receive a profile_id prop).
      // Simpler: check the current HA user id against profile keys.
      const userId = this.hass?.user?.id ?? "";
      const profile = profiles[userId] ?? {};
      const perProfile = profile["vision_max_fails"];
      const global = options["vision_max_fails"];
      const resolved =
        perProfile != null && perProfile !== ""
          ? Number(perProfile)
          : global != null && global !== ""
            ? Number(global)
            : VISION_MAX_FAILS_DEFAULT;
      this._visionMaxFails = Number.isFinite(resolved) ? resolved : VISION_MAX_FAILS_DEFAULT;
    } catch {
      // Settings unavailable — keep built-in default.
      this._visionMaxFails = VISION_MAX_FAILS_DEFAULT;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardown();
  }

  private get _lang(): string | undefined {
    return this.hass?.language;
  }

  private _start(type: MissionType): void {
    this._teardown();
    this._active = type;
    this._wrong = false;
    this._notice = "";
    this._needMotionPerm = false;
    if (type === "math") {
      this._math = makeMath(String(this.mission.params?.["difficulty"] ?? "medium"));
      this._input = "";
    } else if (type === "shake") {
      this._startShake();
    } else if (type === "qr") {
      void this._startCamera(false);
    } else if (type === "vision") {
      this._checking = false;
      void this._startCamera(true);
    } else if (type === "open_door") {
      // Require a real, existing sensor; remember its state so we only solve on
      // an off → on transition (not if the door was already open at ring time).
      if (!this._doorEntity || !this.hass?.states[this._doorEntity]) {
        this._degrade();
      } else {
        this._doorWasOpen = this.hass.states[this._doorEntity].state === "on";
      }
    }
  }

  private _degrade(): void {
    const next = degradeMission(this._active);
    this._notice = localize(this._lang, "missionui.degraded");
    this._start(next);
  }

  private _solve(): void {
    if (this._solved) return;
    this._solved = true;
    this._teardown();
    this.dispatchEvent(new CustomEvent("solved", { bubbles: true, composed: true }));
  }

  private _teardown(): void {
    if (this._scanTimer) {
      window.clearInterval(this._scanTimer);
      this._scanTimer = undefined;
    }
    if (this._motionHandler) {
      window.removeEventListener("devicemotion", this._motionHandler);
      this._motionHandler = undefined;
    }
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = undefined;
    }
  }

  // --- math ---------------------------------------------------------------
  private _checkMath(): void {
    if (this._math && Number(this._input) === this._math.answer) {
      this._solve();
    } else {
      this._wrong = true;
      this._math = makeMath(String(this.mission.params?.["difficulty"] ?? "medium"));
      this._input = "";
    }
  }

  // --- shake --------------------------------------------------------------
  private _startShake(): void {
    this._shakes = 0;
    const DM = window.DeviceMotionEvent as
      | (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> })
      | undefined;
    if (!DM) {
      this._degrade();
      return;
    }
    if (typeof DM.requestPermission === "function") {
      this._needMotionPerm = true; // iOS: user gesture required
      return;
    }
    this._listenMotion();
  }

  private async _enableMotion(): Promise<void> {
    if (this._active !== "shake") return; // ignore a stale click after degrade
    const DM = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    try {
      const res = await DM.requestPermission?.();
      if (res === "granted") {
        this._needMotionPerm = false;
        this._listenMotion();
      } else {
        this._degrade();
      }
    } catch {
      this._degrade();
    }
  }

  private _listenMotion(): void {
    const target =
      Number(this.mission.params?.["count"] ?? SHAKE_DEFAULT_COUNT) || SHAKE_DEFAULT_COUNT;
    this._motionHandler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const cur = { x: a.x, y: a.y, z: a.z };
      if (this._last && shakeMagnitude(cur, this._last) > SHAKE_THRESHOLD) {
        this._shakes += 1;
        if (this._shakes >= target) this._solve();
      }
      this._last = cur;
    };
    window.addEventListener("devicemotion", this._motionHandler);
  }

  // --- camera (qr + vision selfie) ----------------------------------------
  private async _startCamera(selfie: boolean): Promise<void> {
    const kind: MissionType = selfie ? "vision" : "qr";
    const BD = (window as unknown as { BarcodeDetector?: new (o?: object) => unknown })
      .BarcodeDetector;
    // QR needs the BarcodeDetector; the selfie only needs a camera.
    if (!navigator.mediaDevices?.getUserMedia || (!selfie && !BD)) {
      this._notice = localize(this._lang, "missionui.nocam");
      this._degrade();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: selfie ? "user" : "environment" },
      });
      // The component may have been torn down (solved/degraded/disconnected)
      // while getUserMedia was pending — don't leak the camera track.
      if (!this.isConnected || this._active !== kind) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this._stream = stream;
      await this.updateComplete;
      if (!this.isConnected || this._active !== kind) {
        this._teardown();
        return;
      }
      const video = this.renderRoot.querySelector("video");
      if (!video) {
        this._degrade();
        return;
      }
      video.srcObject = this._stream;
      await video.play();
      if (selfie || !BD) return; // selfie waits for the capture button
      const detector = new BD({ formats: ["qr_code"] }) as {
        detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
      };
      const expected = String(this.mission.params?.["value"] ?? "");
      this._scanTimer = window.setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          for (const c of codes) {
            if (!expected || c.rawValue === expected) {
              this._solve();
              return;
            }
          }
        } catch {
          /* transient detect errors are ignored */
        }
      }, 400);
    } catch {
      this._notice = localize(this._lang, "missionui.nocam");
      this._degrade();
    }
  }

  // --- vision (selfie) ----------------------------------------------------
  private async _captureSelfie(): Promise<void> {
    if (this._checking) return;
    const video = this.renderRoot.querySelector("video");
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      this._degrade();
      return;
    }
    ctx.drawImage(video, 0, 0);
    const image = canvas.toDataURL("image/jpeg", 0.6);
    this._checking = true;
    this._notice = "";
    try {
      const res = await visionCheck(this.hass, image, this.alarmId);
      if (res.awake) {
        this._solve();
        return;
      }
      this._visionFails += 1;
      this._notice = localize(this._lang, "missionui.vision_failed");
      if (this._visionFails >= this._visionMaxFails) this._degrade();
    } catch {
      this._visionFails += 1;
      this._notice = localize(this._lang, "missionui.vision_failed");
      if (this._visionFails >= this._visionMaxFails) this._degrade();
    } finally {
      this._checking = false;
    }
  }

  // --- open_door ----------------------------------------------------------
  private get _doorEntity(): string {
    return String(this.mission.params?.["entity_id"] ?? "");
  }

  updated(): void {
    if (this._active === "open_door" && this._doorEntity && !this._solved) {
      const open = this.hass?.states[this._doorEntity]?.state === "on";
      if (open && !this._doorWasOpen) this._solve();
      this._doorWasOpen = open;
    }
  }

  static styles = [
    auroraStyles,
    css`
      .wrap {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        max-width: 360px;
      }
      .prompt {
        font-size: 1.3rem;
        font-weight: 600;
      }
      .math {
        font-size: 2.6rem;
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      input.ans {
        font-size: 1.6rem;
        text-align: center;
        width: 160px;
      }
      .notice,
      .wrong {
        font-size: 0.95rem;
        opacity: 0.85;
      }
      .wrong {
        color: #ffd2d2;
      }
      video {
        width: min(80vw, 320px);
        border-radius: 18px;
        background: #000;
      }
      .shakebar {
        width: 220px;
        height: 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.25);
        overflow: hidden;
      }
      .shakebar > i {
        display: block;
        height: 100%;
        background: var(--aurora-accent-grad);
        transition: width 0.15s ease;
      }
      .big-btn {
        appearance: none;
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 1.05rem;
        padding: 14px 28px;
        border-radius: 999px;
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
    `,
  ];

  render(): TemplateResult {
    return html`<div class="wrap">${this._body()} ${this._noticeEl()}</div>`;
  }

  private _noticeEl(): TemplateResult | typeof nothing {
    return this._notice
      ? html`<div class="notice">${this._notice}</div>`
      : nothing;
  }

  private _body(): TemplateResult {
    switch (this._active) {
      case "math":
        return html`
          <div class="prompt">${localize(this._lang, "missionui.math_prompt")}</div>
          <div class="math clock">${this._math?.question ?? ""} =</div>
          <input
            class="ans"
            type="number"
            inputmode="numeric"
            .value=${this._input}
            @input=${(e: Event) => (this._input = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this._checkMath()}
          />
          ${this._wrong
            ? html`<div class="wrong">${localize(this._lang, "missionui.wrong")}</div>`
            : nothing}
          <button class="big-btn" @click=${this._checkMath}>
            ${localize(this._lang, "missionui.check")}
          </button>
        `;
      case "shake":
        return html`
          <div class="prompt">${localize(this._lang, "missionui.shake_prompt")}</div>
          ${this._needMotionPerm
            ? html`<button class="big-btn" @click=${this._enableMotion}>
                ${localize(this._lang, "missionui.shake_enable")}
              </button>`
            : html`<div class="shakebar">
                <i style=${`width:${Math.min(100, (this._shakes / (Number(this.mission.params?.["count"] ?? SHAKE_DEFAULT_COUNT) || SHAKE_DEFAULT_COUNT)) * 100)}%`}></i>
              </div>`}
        `;
      case "qr":
        return html`
          <div class="prompt">${localize(this._lang, "missionui.qr_prompt")}</div>
          <video playsinline muted></video>
        `;
      case "vision":
        return html`
          <div class="prompt">${localize(this._lang, "missionui.vision_prompt")}</div>
          <video playsinline muted></video>
          <button class="big-btn" ?disabled=${this._checking} @click=${this._captureSelfie}>
            ${this._checking
              ? localize(this._lang, "missionui.checking")
              : localize(this._lang, "missionui.capture")}
          </button>
        `;
      case "open_door": {
        const name =
          this.hass?.states[this._doorEntity]?.attributes.friendly_name ||
          localize(this._lang, "missionui.door");
        return html`<div class="prompt">
          ${localize(this._lang, "missionui.opendoor_prompt", { name: String(name) })}
        </div>`;
      }
      default:
        // tap (terminal fallback): a single confirm.
        return html`<button class="big-btn" @click=${this._solve}>
          ${localize(this._lang, "ring.stop")}
        </button>`;
    }
  }
}
