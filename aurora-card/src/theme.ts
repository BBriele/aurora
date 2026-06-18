import { css } from "lit";

/**
 * Shared "Dawn" design tokens + primitives. Base colours come from the user's
 * Home Assistant theme (CSS variables) so Aurora always feels native in light or
 * dark; the signature sunrise gradient is the one bold, memorable accent.
 */
export const auroraStyles = css`
  :host {
    /* Signature "Dawn" sunrise — reserved for brand/hero moments (title, card
       hero, ring overlay, avatar). Everything interactive follows the HA theme. */
    --aurora-grad: linear-gradient(135deg, #232554 0%, #5b3f9d 44%, #e89a4b 100%);
    --aurora-accent: var(--primary-color, #6d4aa7);
    /* Interactive accent derived from the active theme's primary colour so
       toggles/chips/buttons feel native in any light or dark HA theme. */
    --aurora-accent-grad: linear-gradient(
      135deg,
      color-mix(in srgb, var(--aurora-accent) 90%, #fff),
      color-mix(in srgb, var(--aurora-accent) 76%, #000)
    );
    /* Readable text/icon colour ON an accent fill (the theme's "on-primary"). */
    --aurora-on-accent: var(--text-primary-color, #fff);
    --aurora-grad-soft: linear-gradient(
      135deg,
      color-mix(in srgb, var(--aurora-accent) 16%, transparent),
      color-mix(in srgb, var(--aurora-accent) 8%, transparent)
    );
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
    color: var(--aurora-on-accent);
    background: var(--aurora-accent-grad);
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
    /* Solid theme fill (a faint near-transparent fill makes native selects fall
       back to the unstyled OS widget on many platforms). */
    background: color-mix(in srgb, var(--aurora-text) 5%, var(--aurora-surface));
    border: 1px solid var(--aurora-divider);
    border-radius: var(--aurora-radius-sm);
    padding: 10px 12px;
    width: 100%;
  }
  /* Native <select> ignores the theme unless the OS appearance is stripped; then
     we draw our own chevron and theme the option popup so all dropdowns match. */
  select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    cursor: pointer;
    padding-right: 38px;
    background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='14'%20height='14'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23888fa3'%20stroke-width='2.6'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M6%209l6%206%206-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 13px center;
    background-size: 14px;
  }
  select option,
  select optgroup {
    background: var(--aurora-surface);
    color: var(--aurora-text);
  }
  input:focus,
  select:focus,
  select:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--aurora-accent) 55%, transparent);
    outline-offset: 1px;
    border-color: color-mix(in srgb, var(--aurora-accent) 45%, var(--aurora-divider));
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
    background: var(--aurora-accent-grad);
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
  /* Themed-card grid — shared by the Setup (devices) and Global views so both
     pages share one responsive layout: 1 column on mobile, 2 ≥720px, 3 ≥1200px. */
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
`;
