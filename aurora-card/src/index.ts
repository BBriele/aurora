/**
 * Aurora frontend bundle entry.
 *
 * Defines two custom elements from one module:
 *  - <aurora-card>  : the dashboard card (auto-registered in the card picker)
 *  - <aurora-panel> : the full-page sidebar app
 * The integration serves this file and loads it via frontend.add_extra_js_url
 * (card) and panel_custom (panel).
 */
import "./aurora-card";
import "./aurora-panel";

interface CustomCard {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
  documentationURL?: string;
}

const w = window as unknown as { customCards?: CustomCard[] };
w.customCards = w.customCards ?? [];
if (!w.customCards.some((c) => c.type === "aurora-card")) {
  w.customCards.push({
    type: "aurora-card",
    name: "Aurora",
    description: "Smart modular alarm clock — manage alarms, devices and the ring screen.",
    preview: true,
    documentationURL: "https://github.com/BBriele/aurora",
  });
}

// eslint-disable-next-line no-console
console.info("%c AURORA %c smart alarm ", "background:#5b3f9d;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px", "background:#e89a4b;color:#2a1840;border-radius:0 4px 4px 0;padding:2px 6px");
