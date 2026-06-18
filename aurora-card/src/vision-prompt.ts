/**
 * Vision-prompt criteria builder — DRY module shared by globals-view and
 * devices-view. Stateless: chips generate text, the text field is the stored
 * value (one source of truth).
 */
import { html, type TemplateResult } from "lit";
import { localize } from "./localize";

/** The three well-known selfie criteria the chip row exposes. */
export const VISION_CRITERIA = ["standing", "eyes_open", "face"] as const;
export type VisionCriterion = (typeof VISION_CRITERIA)[number];

/** Map each criterion to its translations.ts key. */
const CRIT_KEY: Record<VisionCriterion, string> = {
  standing: "vision.crit_standing",
  eyes_open: "vision.crit_eyes_open",
  face: "vision.crit_face",
};

/**
 * Compose a YES/NO instruction sentence from the selected criteria.
 * Returns "" when the list is empty (no overwrite intended).
 */
export function composeVisionPrompt(criteria: string[], lang?: string): string {
  const valid = criteria.filter((c): c is VisionCriterion =>
    (VISION_CRITERIA as readonly string[]).includes(c)
  );
  if (valid.length === 0) return "";
  const clauses = valid.map((c) => localize(lang, CRIT_KEY[c]));
  // Join with ", " between items and " and " before the last.
  let joined: string;
  if (clauses.length === 1) {
    joined = clauses[0];
  } else {
    joined = clauses.slice(0, -1).join(", ") + " and " + clauses[clauses.length - 1];
  }
  // Insert the joined clauses into the template sentence.
  const template = localize(lang, "vision.prompt_template");
  return template.replace("{criteria}", joined);
}

/**
 * Render a criteria chip row + a free-edit textarea.
 * Chips are write-only: clicking one composes a new prompt and calls onChange.
 * The textarea also calls onChange on every keystroke.
 *
 * @param value   Current stored prompt text (bound to the textarea).
 * @param lang    UI language (hass.language).
 * @param onChange Called with the new string whenever the user interacts.
 */
export function renderVisionPrompt(
  value: string,
  lang: string | undefined,
  onChange: (text: string) => void
): TemplateResult {
  // Detect which criteria appear in the current value so we can show chips as
  // "active" when the text already matches.
  const active = new Set(
    VISION_CRITERIA.filter((c) => {
      const clause = localize(lang, CRIT_KEY[c]);
      return clause && value.includes(clause);
    })
  );

  const toggleCriterion = (c: VisionCriterion): void => {
    const next = new Set(active);
    if (next.has(c)) {
      next.delete(c);
    } else {
      next.add(c);
    }
    onChange(composeVisionPrompt([...next], lang));
  };

  return html`
    <div class="vision-chips">
      ${VISION_CRITERIA.map(
        (c) => html`
          <button
            type="button"
            class="chip ${active.has(c) ? "on" : ""}"
            @click=${() => toggleCriterion(c)}
          >
            ${localize(lang, CRIT_KEY[c])}
          </button>
        `
      )}
    </div>
    <ha-textarea
      .value=${value}
      autogrow
      @input=${(e: Event) => onChange((e.target as HTMLTextAreaElement).value)}
    ></ha-textarea>
  `;
}
