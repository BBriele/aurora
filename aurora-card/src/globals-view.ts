import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  benchmarkVision,
  getRoleEntities,
  getSettings,
  getVisionModels,
  setSettings,
  type BenchmarkResult,
} from "./api";
import "./entity-picker";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HomeAssistant, RoleEntities } from "./types";
import { renderVisionPrompt, renderVisionTuning } from "./vision-prompt";

/** Reference docs for the two supported wake-up vision providers. */
const AI_TASK_DOCS = "https://www.home-assistant.io/integrations/ai_task/";
const LLM_VISION_REPO = "https://github.com/valentinfrlch/ha-llmvision";

/** Shared, installation-wide settings (not per-user). */
@customElement("aurora-globals-view")
export class AuroraGlobalsView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _entities?: RoleEntities;
  @state() private _models: string[] = [];
  @state() private _options: Record<string, unknown> = {};
  @state() private _saving = false;
  @state() private _saved = false;
  @state() private _benchRunning = false;
  @state() private _benchResult: BenchmarkResult | null = null;
  @state() private _benchError: string | null = null;
  private _loaded = false;

  updated(): void {
    if (this.hass && !this._loaded) {
      this._loaded = true;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    const [entities, settings, models] = await Promise.all([
      getRoleEntities(this.hass),
      getSettings(this.hass),
      getVisionModels(this.hass).catch(() => [] as string[]),
    ]);
    this._entities = entities;
    this._options = { ...settings.options };
    this._models = models;
  }

  private _setOption(key: string, value: unknown): void {
    this._options = { ...this._options, [key]: value };
    this._saved = false;
  }

  private async _save(): Promise<void> {
    this._saving = true;
    try {
      const res = await setSettings(this.hass, {
        ring_max_duration: this._options["ring_max_duration"] ?? 600,
        skip_calendars: this._options["skip_calendars"] ?? [],
        holiday_calendars: this._options["holiday_calendars"] ?? [],
        weather: this._options["weather"] ?? "",
        briefing_calendars: this._options["briefing_calendars"] ?? [],
        todo_lists: this._options["todo_lists"] ?? [],
        post_wake_action: this._options["post_wake_action"] || undefined,
        vision_provider: this._options["vision_provider"] ?? "",
        vision_prompt: this._options["vision_prompt"] || undefined,
        vision_model: this._options["vision_model"] || undefined,
        vision_timeout_s: this._options["vision_timeout_s"] || undefined,
        vision_retries: this._options["vision_retries"] || undefined,
        vision_max_fails: this._options["vision_max_fails"] || undefined,
      });
      this._options = { ...res.options };
      this._saved = true;
    } catch (err) {
      this._saved = false;
      throw err;
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
      .note {
        font-size: 0.8rem;
        color: var(--aurora-dim);
        margin: 4px 0 0;
        line-height: 1.45;
      }
      .chips,
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
        padding: 8px 12px;
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
      .vision-field {
        margin-bottom: 10px;
      }
      .vision-fields {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        margin-top: 8px;
      }
      .none {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        font-style: italic;
      }
      .detected {
        font-size: 0.85rem;
        color: var(--aurora-dim);
        margin-top: 8px;
        line-height: 1.5;
      }
      .detected b {
        color: var(--aurora-text);
        font-weight: 600;
      }
      .refs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        margin-top: 12px;
      }
      .refs a {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--aurora-accent);
        font-size: 0.83rem;
        font-weight: 600;
        text-decoration: none;
      }
      .refs a:hover {
        text-decoration: underline;
      }
      .bench {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      .bench-result {
        font-size: 0.85rem;
        font-variant-numeric: tabular-nums;
        color: var(--aurora-dim);
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
      return html`<div class="card intro">${localize(this.hass?.language, "common.loading")}</div>`;
    }
    const lang = this.hass?.language;
    return html`
      <p class="intro">${localize(lang, "globals.intro")}</p>
      <div class="grid">
        ${this._ringCard()} ${this._calendarCard()} ${this._briefingCard()} ${this._visionCard()}
      </div>
      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? localize(lang, "common.saving") : localize(lang, "globals.save")}
        </button>
        ${this._saved ? html`<span class="ok">${localize(lang, "common.saved")}</span>` : nothing}
      </div>
    `;
  }

  private _head(icon: string, title: string): TemplateResult {
    return html`<div class="cardhead"><div class="ic">${icon}</div><h3>${title}</h3></div>`;
  }

  private _ringCard(): TemplateResult {
    const lang = this.hass?.language;
    const ringMin = Math.round(Number(this._options["ring_max_duration"] ?? 600) / 60);
    return html`
      <div class="card">
        ${this._head("🔔", localize(lang, "globals.card_ring"))}
        <div class="role">
          <div class="name">${localize(lang, "globals.ring_max")}</div>
          <input
            type="number"
            min="1"
            max="60"
            style="max-width:140px"
            .value=${String(ringMin)}
            @input=${(e: Event) => {
              this._options = {
                ...this._options,
                ring_max_duration: Number((e.target as HTMLInputElement).value) * 60,
              };
              this._saved = false;
            }}
          />
        </div>
      </div>
    `;
  }

  private _calendarCard(): TemplateResult {
    const lang = this.hass?.language;
    const cals = this._entities!.calendars ?? [];
    return html`
      <div class="card">
        ${this._head("📅", localize(lang, "globals.card_calendar"))}
        ${this._pickerRow("skip_calendars", localize(lang, "globals.skip_calendars"), cals, true)}
        ${this._pickerRow("holiday_calendars", localize(lang, "globals.holiday_calendars"), cals, true)}
      </div>
    `;
  }

  private _briefingCard(): TemplateResult {
    const lang = this.hass?.language;
    return html`
      <div class="card">
        ${this._head("☀️", localize(lang, "globals.card_briefing"))}
        <p class="note">${localize(lang, "globals.briefing_intro")}</p>
        ${this._pickerRow("weather", localize(lang, "globals.weather"), this._entities!.weather ?? [], false)}
        ${this._pickerRow(
          "briefing_calendars",
          localize(lang, "globals.briefing_calendars"),
          this._entities!.calendars ?? [],
          true
        )}
        ${this._pickerRow("todo_lists", localize(lang, "globals.todo_lists"), this._entities!.todo ?? [], true)}
        <div class="role">
          <div class="name">${localize(lang, "globals.post_wake_action")}</div>
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: ["script", "scene", "automation"] } }}
            .value=${(this._options["post_wake_action"] as string) ?? ""}
            @value-changed=${(e: CustomEvent) =>
              this._setOption("post_wake_action", e.detail.value)}
          ></ha-selector>
          <p class="note">${localize(lang, "globals.post_wake_action_hint")}</p>
        </div>
      </div>
    `;
  }

  private async _runBenchmark(): Promise<void> {
    this._benchRunning = true;
    this._benchResult = null;
    this._benchError = null;
    try {
      this._benchResult = await benchmarkVision(this.hass, 3);
    } catch (err) {
      this._benchError = String(err);
    } finally {
      this._benchRunning = false;
    }
  }

  private _visionCard(): TemplateResult {
    const lang = this.hass?.language;
    const llm = this._entities!.vision_providers ?? [];
    const bound = (this._options["vision_provider"] as string) || "";
    let active: string;
    if (bound) {
      const name = (this.hass?.states[bound]?.attributes?.friendly_name as string) || bound;
      active = localize(lang, "globals.vision_active_aitask", { name });
    } else if (llm.length) {
      active = localize(lang, "globals.vision_active_llm", {
        names: llm.map((p) => p.title).join(", "),
      });
    } else {
      active = localize(lang, "globals.vision_active_none");
    }
    // The benchmark works against whatever async_vision_check would use: a bound
    // AI Task entity, or (failing that) an auto-detected LLM Vision provider.
    const canBenchmark = !!bound || llm.length > 0;
    const r = this._benchResult;
    return html`
      <div class="card">
        ${this._head("👁️", localize(lang, "mission.vision"))}
        <p class="note">${localize(lang, "globals.vision_intro")}</p>

        <div class="role">
          <div class="name">${localize(lang, "globals.vision_provider")}</div>
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: "ai_task" } }}
            .value=${(this._options["vision_provider"] as string) ?? ""}
            @value-changed=${(e: CustomEvent) => this._setOption("vision_provider", e.detail.value)}
          ></ha-selector>
        </div>

        <div class="role">
          <div class="name">${localize(lang, "mission.vision_prompt")}</div>
          ${renderVisionPrompt(
            (this._options["vision_prompt"] as string) ?? "",
            lang,
            (text) => this._setOption("vision_prompt", text)
          )}
        </div>

        <div class="role">
          ${renderVisionTuning(this.hass, this._options, this._models, lang, (k, v) =>
            this._setOption(k, v)
          )}
        </div>

        ${canBenchmark
          ? html`<div class="bench">
              <ha-button ?disabled=${this._benchRunning} @click=${this._runBenchmark}>
                ${this._benchRunning
                  ? localize(lang, "globals.benchmark_running")
                  : localize(lang, "globals.run_benchmark")}
              </ha-button>
              ${r
                ? html`<span class="bench-result">${localize(lang, "globals.benchmark_result", {
                    ok: String(r.succeeded),
                    n: String(r.samples),
                    min: r.latency_ms.min != null ? String(r.latency_ms.min) : "—",
                    avg: r.latency_ms.avg != null ? String(Math.round(r.latency_ms.avg)) : "—",
                    max: r.latency_ms.max != null ? String(r.latency_ms.max) : "—",
                  })}</span>`
                : nothing}
              ${this._benchError
                ? html`<ha-alert alert-type="error">${localize(lang, "globals.benchmark_failed", { error: this._benchError })}</ha-alert>`
                : nothing}
            </div>`
          : nothing}
        <div class="detected">${active}</div>
        <div class="refs">
          <a href=${AI_TASK_DOCS} target="_blank" rel="noopener noreferrer">
            ↗ ${localize(lang, "globals.vision_ref_aitask")}
          </a>
          <a href=${LLM_VISION_REPO} target="_blank" rel="noopener noreferrer">
            ↗ ${localize(lang, "globals.vision_ref_llm")}
          </a>
        </div>
      </div>
    `;
  }

  private _pickerRow(
    key: string,
    label: string,
    options: string[],
    multiple: boolean
  ): TemplateResult {
    return html`
      <div class="role">
        <div class="name">${label}</div>
        <aurora-entity-picker
          .hass=${this.hass}
          .options=${options}
          .value=${multiple
            ? ((this._options[key] as string[]) ?? [])
            : ((this._options[key] as string) ?? "")}
          .multiple=${multiple}
          @change=${(e: CustomEvent<string | string[]>) => this._setOption(key, e.detail)}
        ></aurora-entity-picker>
      </div>
    `;
  }
}
