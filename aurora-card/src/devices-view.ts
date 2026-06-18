import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { getRoleEntities, getSettings, setSettings } from "./api";
import "./entity-picker";
import "./audio-presets";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import {
  type HomeAssistant,
  type Profiles,
  type RoleEntities,
} from "./types";
import { renderVisionPrompt } from "./vision-prompt";

interface RoleDef {
  key: string;
  multiple: boolean;
}
interface GroupDef {
  key: string;
  icon: string;
  roles: RoleDef[];
}

// Roles grouped into themed cards (mirrors the Alarms page's card layout).
const GROUPS: GroupDef[] = [
  { key: "audio", icon: "🔊", roles: [{ key: "audio_sink", multiple: false }] },
  {
    key: "wake",
    icon: "🌅",
    roles: [
      { key: "wake_light", multiple: false },
      { key: "display_surface", multiple: true },
    ],
  },
  { key: "notify", icon: "🔔", roles: [{ key: "notify_channel", multiple: true }] },
  {
    key: "presence",
    icon: "😴",
    roles: [
      { key: "sleep_signal", multiple: true },
      { key: "presence_signal", multiple: true },
    ],
  },
  {
    key: "voice",
    icon: "🗣️",
    roles: [
      { key: "conversation", multiple: false },
      { key: "tts", multiple: false },
    ],
  },
];

/** Per-user device bindings editor. Edits options.profiles[userId].bindings. */
@customElement("aurora-devices-view")
export class AuroraDevicesView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) userId = "";
  @property({ attribute: false }) userName = "";

  @state() private _entities?: RoleEntities;
  @state() private _bindings: Record<string, unknown> = {};
  @state() private _vision: Record<string, unknown> = {};
  @state() private _saving = false;
  @state() private _saved = false;
  private _profiles: Profiles = {};
  private _loadedFor = "";

  updated(): void {
    if (this.hass && this.userId && this._loadedFor !== this.userId) {
      this._loadedFor = this.userId;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    const [entities, settings] = await Promise.all([
      getRoleEntities(this.hass),
      getSettings(this.hass),
    ]);
    this._entities = entities;
    this._profiles = (settings.options.profiles as Profiles) ?? {};
    const profile = this._profiles[this.userId] ?? {};
    // Cast through unknown to access dynamic vision keys that are not in the
    // Profile type (they are new sibling keys stored alongside bindings).
    const profileDyn = profile as unknown as Record<string, unknown>;
    this._bindings = { ...(profile.bindings ?? {}) };
    this._vision = {
      vision_prompt: profileDyn["vision_prompt"] ?? "",
      vision_model: profileDyn["vision_model"] ?? "",
      // Numbers stay raw (number | undefined) so the ha-selector number field
      // shows empty when unset — never an empty string.
      vision_timeout_s: profileDyn["vision_timeout_s"],
      vision_retries: profileDyn["vision_retries"],
      vision_max_fails: profileDyn["vision_max_fails"],
    };
    this._saved = false;
  }

  private _set(key: string, value: unknown): void {
    this._bindings = { ...this._bindings, [key]: value };
    this._saved = false;
  }

  private _setVision(key: string, value: unknown): void {
    this._vision = { ...this._vision, [key]: value };
    this._saved = false;
  }

  private async _save(): Promise<void> {
    this._saving = true;
    try {
      const bindings = Object.fromEntries(
        Object.entries(this._bindings).filter(
          ([, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
        )
      );
      // Re-read settings first so we preserve fields this view doesn't edit
      // (notably the profile's audio_presets, owned by the presets manager).
      const fresh = await getSettings(this.hass);
      const profiles = (fresh.options.profiles as Profiles) ?? {};
      const existing = profiles[this.userId];
      // Strip empty vision strings so we don't persist noise; keep non-empty values.
      const visionKeys: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(this._vision)) {
        if (v !== "" && v !== null && v !== undefined) {
          visionKeys[k] = v;
        }
      }
      profiles[this.userId] = {
        ...(existing as unknown as Record<string, unknown>),
        name: this.userName || existing?.name || this.userId,
        bindings,
        ...visionKeys,
      } as unknown as Profiles[string];
      const res = await setSettings(this.hass, { profiles });
      this._profiles = (res.options.profiles as Profiles) ?? profiles;
      this._saved = true;
    } finally {
      this._saving = false;
    }
  }

  static styles = [
    auroraStyles,
    css`
      .intro {
        color: var(--aurora-dim);
        margin: 0 0 16px;
        line-height: 1.5;
      }
      .who {
        font-weight: 700;
        color: var(--aurora-text);
      }
      /* Responsive card grid: 1 column on mobile, more on wider screens. */
      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: 1fr;
      }
      @media (min-width: 720px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (min-width: 1200px) {
        .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      .card {
        background: var(--aurora-surface);
        border: 1px solid var(--aurora-divider);
        border-radius: var(--aurora-radius);
        padding: 18px 20px;
      }
      .cardhead {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 6px;
      }
      .cardhead h3 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
      }
      .ic {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 19px;
        background: var(--aurora-grad-soft);
        flex: none;
      }
      .role {
        padding: 14px 0 2px;
        border-top: 1px solid var(--aurora-divider);
        margin-top: 12px;
      }
      .role:first-of-type {
        border-top: none;
        margin-top: 6px;
      }
      .role .name {
        font-weight: 600;
      }
      .role .desc {
        font-size: 0.8rem;
        color: var(--aurora-dim);
        margin-bottom: 10px;
      }
      .vision-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      .chip {
        appearance: none;
        border: 1px solid var(--aurora-divider);
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        padding: 6px 12px;
        border-radius: 999px;
        background: transparent;
        color: var(--aurora-dim);
      }
      .chip.on {
        color: var(--aurora-on-accent);
        background: var(--aurora-accent-grad);
        border-color: transparent;
      }
      ha-textarea {
        width: 100%;
        display: block;
        margin-bottom: 8px;
      }
      .vision-fields {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        margin-top: 4px;
      }
      .savebar {
        position: sticky;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 2px 4px;
        margin-top: 4px;
        background: linear-gradient(transparent, var(--primary-background-color) 45%);
      }
      .ok {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
  ];

  render(): TemplateResult {
    if (!this._entities) {
      return html`<div class="card intro">${localize(this.hass?.language, "devices.loading")}</div>`;
    }
    const lang = this.hass?.language;
    return html`
      <p class="intro">
        ${localize(lang, "devices.intro", {
          name: this.userName || localize(lang, "devices.this_profile"),
        })}
      </p>
      <div class="grid">${GROUPS.map((g) => this._card(g))}${this._visionCard()}</div>
      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? localize(lang, "common.saving") : localize(lang, "devices.save")}
        </button>
        ${this._saved ? html`<span class="ok">${localize(lang, "common.saved")}</span>` : nothing}
      </div>
    `;
  }

  private _card(group: GroupDef): TemplateResult {
    return html`
      <div class="card">
        <div class="cardhead">
          <div class="ic">${group.icon}</div>
          <h3>${localize(this.hass?.language, "setup.group." + group.key)}</h3>
        </div>
        ${group.roles.map((r) => this._role(r.key, r.multiple))}
        ${group.key === "audio" ? this._audioPresets() : nothing}
      </div>
    `;
  }

  private _audioPresets(): TemplateResult {
    const sink = this._bindings["audio_sink"];
    const entityId = typeof sink === "string" && sink ? sink : null;
    return html`
      <div class="role">
        <aurora-audio-presets
          .hass=${this.hass}
          .userId=${this.userId}
          .userName=${this.userName}
          .entityId=${entityId}
        ></aurora-audio-presets>
      </div>
    `;
  }

  private _visionCard(): TemplateResult {
    const lang = this.hass?.language;
    return html`
      <div class="card">
        <div class="cardhead">
          <div class="ic">👁️</div>
          <h3>${localize(lang, "mission.vision")}</h3>
        </div>

        <div class="role">
          <div class="name">${localize(lang, "mission.vision_prompt")}</div>
          ${renderVisionPrompt(
            (this._vision["vision_prompt"] as string) ?? "",
            lang,
            (text) => this._setVision("vision_prompt", text)
          )}
        </div>

        <div class="role">
          <div class="name">${localize(lang, "vision.model")}</div>
          <ha-selector
            .hass=${this.hass}
            .selector=${{ text: {} }}
            .value=${(this._vision["vision_model"] as string) ?? ""}
            .placeholder=${localize(lang, "vision.model_ph")}
            @value-changed=${(e: CustomEvent) => this._setVision("vision_model", e.detail.value)}
          ></ha-selector>
        </div>

        <div class="role vision-fields">
          ${this._visionNumber("vision_timeout_s", localize(lang, "vision.timeout_s"), 1)}
          ${this._visionNumber("vision_retries", localize(lang, "vision.retries"), 1)}
          ${this._visionNumber("vision_max_fails", localize(lang, "vision.max_fails"), 1)}
        </div>
      </div>
    `;
  }

  /** A labeled number field (ha-selector); empty → undefined so blank = unset. */
  private _visionNumber(key: string, label: string, min: number): TemplateResult {
    return html`
      <div>
        <div class="name">${label}</div>
        <ha-selector
          .hass=${this.hass}
          .selector=${{ number: { min, mode: "box" } }}
          .value=${this._vision[key] as number | undefined}
          @value-changed=${(e: CustomEvent) => this._setVision(key, e.detail.value)}
        ></ha-selector>
      </div>
    `;
  }

  private _role(key: string, multiple: boolean): TemplateResult {
    const options = this._entities!.roles[key] ?? [];
    const raw = this._bindings[key];
    // A multi role may still hold a legacy single-string binding (bound before
    // it became multiple) — coerce so it renders and round-trips instead of
    // silently dropping on save.
    const value = multiple
      ? Array.isArray(raw)
        ? raw
        : raw
          ? [raw as string]
          : []
      : ((raw as string) ?? "");
    return html`
      <div class="role">
        <div class="name">${localize(this.hass?.language, "role." + key + ".label")}</div>
        <div class="desc">${localize(this.hass?.language, "role." + key + ".desc")}</div>
        <aurora-entity-picker
          .hass=${this.hass}
          .options=${options}
          .value=${value}
          .multiple=${multiple}
          @change=${(e: CustomEvent<string | string[]>) => this._set(key, e.detail)}
        ></aurora-entity-picker>
      </div>
    `;
  }
}
