import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { getRoleEntities, getSettings, setSettings } from "./api";
import "./entity-picker";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import {
  ROLE_ICONS,
  type HomeAssistant,
  type Profiles,
  type RoleEntities,
} from "./types";

const ROLES: { key: string; multiple: boolean }[] = [
  { key: "audio_sink", multiple: false },
  { key: "wake_light", multiple: false },
  { key: "display_surface", multiple: false },
  { key: "notify_channel", multiple: true },
  { key: "sleep_signal", multiple: true },
  { key: "presence_signal", multiple: true },
  { key: "conversation", multiple: false },
  { key: "tts", multiple: false },
];

/** Per-user device bindings editor. Edits options.profiles[userId].bindings. */
@customElement("aurora-devices-view")
export class AuroraDevicesView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) userId = "";
  @property({ attribute: false }) userName = "";

  @state() private _entities?: RoleEntities;
  @state() private _bindings: Record<string, unknown> = {};
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
    this._bindings = { ...(this._profiles[this.userId]?.bindings ?? {}) };
    this._saved = false;
  }

  private _set(key: string, value: unknown): void {
    this._bindings = { ...this._bindings, [key]: value };
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
      const profiles: Profiles = {
        ...this._profiles,
        [this.userId]: { name: this.userName || this.userId, bindings },
      };
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
        margin: 0 0 6px;
        line-height: 1.5;
      }
      .who {
        font-weight: 700;
        color: var(--aurora-text);
      }
      .role {
        padding: 16px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .rolehead {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
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
      .rolehead .name {
        font-weight: 700;
      }
      .rolehead .desc {
        font-size: 0.82rem;
        color: var(--aurora-dim);
      }
      .savebar {
        position: sticky;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 18px;
        margin-top: 8px;
        background: linear-gradient(transparent, var(--aurora-surface) 40%);
      }
      .ok {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
  ];

  render(): TemplateResult {
    if (!this._entities) {
      return html`<div class="intro">${localize(this.hass?.language, "devices.loading")}</div>`;
    }
    return html`
      <p class="intro">
        ${localize(this.hass?.language, "devices.intro", { name: this.userName || localize(this.hass?.language, "devices.this_profile") })}
      </p>
      ${ROLES.map((role) => this._role(role.key, role.multiple))}
      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? localize(this.hass?.language, "common.saving") : localize(this.hass?.language, "devices.save")}
        </button>
        ${this._saved ? html`<span class="ok">${localize(this.hass?.language, "common.saved")}</span>` : nothing}
      </div>
    `;
  }

  private _role(key: string, multiple: boolean): TemplateResult {
    const options = this._entities!.roles[key] ?? [];
    const value = multiple
      ? ((this._bindings[key] as string[]) ?? [])
      : ((this._bindings[key] as string) ?? "");
    return html`
      <div class="role">
        <div class="rolehead">
          <div class="ic">${ROLE_ICONS[key] ?? "•"}</div>
          <div>
            <div class="name">${localize(this.hass?.language, "role." + key + ".label")}</div>
            <div class="desc">${localize(this.hass?.language, "role." + key + ".desc")}</div>
          </div>
        </div>
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
