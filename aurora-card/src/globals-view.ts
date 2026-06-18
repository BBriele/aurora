import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { benchmarkVision, getRoleEntities, getSettings, setSettings, type BenchmarkResult } from "./api";
import "./entity-picker";
import { localize } from "./localize";
import { auroraStyles } from "./theme";
import type { HomeAssistant, RoleEntities } from "./types";

/** Reference docs for the two supported wake-up vision providers. */
const AI_TASK_DOCS = "https://www.home-assistant.io/integrations/ai_task/";
const LLM_VISION_REPO = "https://github.com/valentinfrlch/ha-llmvision";

/** Shared, installation-wide settings (not per-user). */
@customElement("aurora-globals-view")
export class AuroraGlobalsView extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _entities?: RoleEntities;
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
    const [entities, settings] = await Promise.all([
      getRoleEntities(this.hass),
      getSettings(this.hass),
    ]);
    this._entities = entities;
    this._options = { ...settings.options };
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
        vision_provider: this._options["vision_provider"] ?? "",
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
        margin: 0 0 18px;
        line-height: 1.5;
      }
      .block {
        padding: 14px 0;
        border-top: 1px solid var(--aurora-divider);
      }
      .block .field {
        margin-bottom: 8px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
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
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 16px;
      }
      .ok {
        color: var(--aurora-accent);
        font-weight: 600;
      }
    `,
  ];

  render(): TemplateResult {
    if (!this._entities) {
      return html`<div class="intro">${localize(this.hass?.language, "common.loading")}</div>`;
    }
    const ringMin = Math.round(Number(this._options["ring_max_duration"] ?? 600) / 60);
    return html`
      <p class="intro">${localize(this.hass?.language, "globals.intro")}</p>

      <div class="block">
        <label class="field">${localize(this.hass?.language, "globals.ring_max")}</label>
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

      ${this._calendars("skip_calendars", localize(this.hass?.language, "globals.skip_calendars"))}
      ${this._calendars("holiday_calendars", localize(this.hass?.language, "globals.holiday_calendars"))}

      <p class="intro" style="margin-top:22px">
        ${localize(this.hass?.language, "globals.briefing_intro")}
      </p>
      ${this._picker(
        "weather",
        localize(this.hass?.language, "globals.weather"),
        this._entities.weather ?? [],
        false
      )}
      ${this._picker(
        "briefing_calendars",
        localize(this.hass?.language, "globals.briefing_calendars"),
        this._entities.calendars ?? [],
        true
      )}
      ${this._picker("todo_lists", localize(this.hass?.language, "globals.todo_lists"), this._entities.todo ?? [], true)}

      ${this._visionSection()}

      <div class="savebar">
        <button class="btn primary" ?disabled=${this._saving} @click=${this._save}>
          ${this._saving ? localize(this.hass?.language, "common.saving") : localize(this.hass?.language, "globals.save")}
        </button>
        ${this._saved ? html`<span class="ok">${localize(this.hass?.language, "common.saved")}</span>` : nothing}
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

  private _visionSection(): TemplateResult {
    const lang = this.hass?.language;
    const aiTasks = this._entities!.roles?.["vision_provider"] ?? [];
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
      <p class="intro" style="margin-top:22px">${localize(lang, "globals.vision_intro")}</p>
      ${this._picker("vision_provider", localize(lang, "globals.vision_provider"), aiTasks, false)}
      ${canBenchmark
        ? html`<div class="bench">
            <ha-button
              ?disabled=${this._benchRunning}
              @click=${this._runBenchmark}
            >
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
    `;
  }

  private _calendars(key: string, label: string): TemplateResult {
    return this._picker(key, label, this._entities!.calendars ?? [], true);
  }

  private _picker(
    key: string,
    label: string,
    options: string[],
    multiple: boolean
  ): TemplateResult {
    return html`
      <div class="block">
        <label class="field">${label}</label>
        <aurora-entity-picker
          .hass=${this.hass}
          .options=${options}
          .value=${multiple
            ? ((this._options[key] as string[]) ?? [])
            : ((this._options[key] as string) ?? "")}
          .multiple=${multiple}
          @change=${(e: CustomEvent<string | string[]>) =>
            this._setOption(key, e.detail)}
        ></aurora-entity-picker>
      </div>
    `;
  }
}
