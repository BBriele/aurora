/**
 * Tiny runtime localizer for the Aurora card. English is the default; any
 * language with a bucket in translations.ts is used when it matches
 * `hass.language` (exact, e.g. "it", or base of "it-IT"), otherwise English.
 * Missing keys fall back to English, then to the raw key.
 */
import { STRINGS, type Lang } from "./translations";

function pickLang(language?: string): Lang {
  if (!language) return "en";
  const lower = language.toLowerCase();
  if (lower in STRINGS) return lower as Lang;
  const base = lower.split("-")[0];
  return (base in STRINGS ? base : "en") as Lang;
}

/** Translate `key` for the user's language, interpolating `{var}` placeholders. */
export function localize(
  language: string | undefined,
  key: string,
  vars?: Record<string, string | number>
): string {
  const lang = pickLang(language);
  let out = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.replaceAll(`{${name}}`, String(value));
    }
  }
  return out;
}

/** Localized weekday initials (Mon-first), e.g. ["M","T","W","T","F","S","S"]. */
export function weekdayLetters(language: string | undefined): string[] {
  return localize(language, "weekday.letters").split(",");
}
