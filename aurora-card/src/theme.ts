import { css } from "lit";

/**
 * Shared "Dawn" design tokens + primitives. Base colours come from the user's
 * Home Assistant theme (CSS variables) so Aurora always feels native in light or
 * dark; the signature sunrise gradient is the one bold, memorable accent.
 */
export const auroraStyles = css`
  :host {
    --aurora-grad: linear-gradient(135deg, #232554 0%, #5b3f9d 44%, #e89a4b 100%);
    --aurora-grad-soft: linear-gradient(
      135deg,
      rgba(91, 63, 157, 0.16),
      rgba(232, 154, 75, 0.14)
    );
    --aurora-accent: var(--primary-color, #6d4aa7);
    --aurora-text: var(--primary-text-color, #1b1b27);
    --aurora-dim: var(--secondary-text-color, #6c6c82);
    --aurora-surface: var(--card-background-color, var(--ha-card-background, #fff));
    --aurora-divider: var(--divider-color, rgba(120, 120, 140, 0.16));
    --aurora-danger: var(--error-color, #d8455f);
    --aurora-radius: 20px;
    --aurora-radius-sm: 13px;
    --aurora-shadow: 0 10px 30px -16px rgba(35, 37, 84, 0.5);
    color: var(--aurora-text);
    font-family: var(--paper-font-body1_-_font-family, "Roboto", system-ui, sans-serif);
  }
  * {
    box-sizing: border-box;
  }
  .grad-text {
    background: var(--aurora-grad);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .clock {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 0.95;
  }
  .muted {
    color: var(--aurora-dim);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .spacer {
    flex: 1;
  }
  /* Buttons */
  .btn {
    appearance: none;
    border: none;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    border-radius: 999px;
    padding: 10px 18px;
    color: var(--aurora-text);
    background: color-mix(in srgb, var(--aurora-accent) 12%, transparent);
    transition: transform 0.12s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .btn:hover {
    background: color-mix(in srgb, var(--aurora-accent) 20%, transparent);
  }
  .btn:active {
    transform: scale(0.96);
  }
  .btn.primary {
    color: #fff;
    background: var(--aurora-grad);
    box-shadow: var(--aurora-shadow);
  }
  .btn.ghost {
    background: transparent;
  }
  .btn.danger {
    color: var(--aurora-danger);
    background: color-mix(in srgb, var(--aurora-danger) 12%, transparent);
  }
  .icon-btn {
    appearance: none;
    border: none;
    cursor: pointer;
    background: transparent;
    color: var(--aurora-dim);
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
    font-size: 18px;
    transition: background 0.18s ease, color 0.18s ease;
  }
  .icon-btn:hover {
    background: color-mix(in srgb, var(--aurora-accent) 14%, transparent);
    color: var(--aurora-text);
  }
  /* Inputs */
  input[type="time"],
  input[type="text"],
  input[type="number"],
  select {
    font: inherit;
    color: var(--aurora-text);
    background: color-mix(in srgb, var(--aurora-dim) 8%, transparent);
    border: 1px solid var(--aurora-divider);
    border-radius: var(--aurora-radius-sm);
    padding: 10px 12px;
    width: 100%;
  }
  input:focus,
  select:focus {
    outline: 2px solid color-mix(in srgb, var(--aurora-accent) 55%, transparent);
    outline-offset: 1px;
  }
  label.field {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--aurora-dim);
    margin: 0 0 6px 2px;
  }
  /* Toggle switch */
  .switch {
    position: relative;
    width: 46px;
    height: 27px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--aurora-dim) 32%, transparent);
    cursor: pointer;
    transition: background 0.22s ease;
    flex: none;
  }
  .switch[aria-checked="true"] {
    background: var(--aurora-grad);
  }
  .switch::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.22s cubic-bezier(0.3, 1.3, 0.6, 1);
  }
  .switch[aria-checked="true"]::after {
    transform: translateX(19px);
  }
`;
