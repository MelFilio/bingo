# Design Guide

## Design principles

The interface should feel clear, calm, and dependable.

1. **Clarity first:** Make the primary action and current system state obvious.
2. **Consistency builds trust:** Reuse tokens, components, wording, and behavior.
3. **Accessible by default:** Design for keyboard, touch, zoom, reduced motion,
   and assistive technology from the start.
4. **Progressive disclosure:** Show essential information first and reveal
   advanced controls when they become relevant.
5. **Purposeful restraint:** Use color, motion, and decoration to communicate,
   not merely to fill space.

## Foundations

### Color

Use semantic names so themes can change without rewriting components. The
values below are a neutral starting palette, not a product brand specification.

```css
:root {
  color-scheme: light;

  --color-canvas: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-subtle: #f1f5f9;
  --color-text: #0f172a;
  --color-text-muted: #475569;
  --color-border: #cbd5e1;
  --color-border-strong: #94a3b8;

  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-active: #1e40af;
  --color-on-primary: #ffffff;

  --color-success: #15803d;
  --color-warning: #a16207;
  --color-danger: #b91c1c;
  --color-focus: #2563eb;
}
```

- Meet WCAG 2.2 AA contrast: at least 4.5:1 for normal text and 3:1 for large
  text, meaningful icons, control boundaries, and focus indicators.
- Do not use color as the only indication of status or error.
- Use primary color sparingly for interactive emphasis and key brand moments.
- Introduce dark-mode tokens only when all components and states support them.

### Typography

Use one sans-serif family by default:

```css
--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;

--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-md: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
```

- Body text: 16px with a 1.5 line height.
- Supporting text: 14px with a 1.4 or greater line height.
- Headings: 1.15–1.25 line height and a clear, restrained hierarchy.
- Use weights 400, 500, 600, and 700 only. Avoid weight as the sole hierarchy.
- Keep prose near 45–75 characters per line.

### Spacing

Use a 4px base scale:

```css
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem;  /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem;    /* 16px */
--space-6: 1.5rem;  /* 24px */
--space-8: 2rem;    /* 32px */
--space-12: 3rem;   /* 48px */
--space-16: 4rem;   /* 64px */
```

- Use 8–12px inside compact controls, 12–16px inside standard controls, and
  16–24px inside cards.
- Use larger spacing between conceptual sections than between related items.
- Avoid arbitrary values unless required by an asset or layout calculation.

### Shape, border, and elevation

```css
--radius-sm: 0.375rem;
--radius-md: 0.625rem;
--radius-lg: 1rem;
--radius-full: 9999px;

--shadow-sm: 0 1px 2px rgb(15 23 42 / 0.08);
--shadow-md: 0 8px 24px rgb(15 23 42 / 0.12);
```

- Use `radius-md` for most controls and `radius-lg` for prominent containers.
- Prefer borders and surface contrast over shadows. Reserve `shadow-md` for
  overlays, menus, dialogs, or clearly elevated content.
- Do not mix several radius styles within one component family.

### Motion

```css
--duration-fast: 120ms;
--duration-normal: 200ms;
--duration-slow: 320ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
```

- Animate opacity and transforms when possible.
- Interaction feedback should complete within 120–200ms.
- Never delay an action so an animation can finish.
- Disable non-essential animation under `prefers-reduced-motion: reduce`.

## Layout and responsiveness

- Start with the narrowest layout and enhance it as space becomes available.
- Use a maximum content width of 1200px with responsive page gutters:
  16px on phones, 24px on tablets, and 32px on desktop.
- Use breakpoints because content needs them, with 640px, 768px, 1024px, and
  1280px as shared defaults.
- Prefer fluid grids using `minmax()` and `clamp()` over many media queries.
- Keep primary actions visible without obscuring content.
- At 320 CSS pixels wide, content must remain operable without horizontal page
  scrolling. Data tables may use a labeled, contained scrolling region.
- At 200% browser zoom, preserve content and functionality.

## Component standard

Every interactive component must define its default, hover, active, focus,
disabled, loading, error, and success states where applicable.

### Buttons

- Variants: primary, secondary, quiet, and danger.
- Sizes: small (32px), medium (40px), and large (48px) minimum height.
- Use one primary button per action group.
- Labels should start with a specific verb: “Create board,” not “Submit.”
- During submission, retain the label or width, show progress, and prevent
  duplicate activation.
- Icon-only buttons require an accessible name and at least a 44px touch target.

### Form controls

- Place a persistent label above each control. Placeholder text is an example,
  never a label.
- Use a consistent 40–44px standard control height.
- Put help text before an error occurs; replace or supplement it with a specific
  error message afterward.
- Validate on blur or submission unless immediate feedback clearly helps.
- Preserve entered values after validation or network failures.
- Mark optional fields rather than repeating “required” on most fields.

### Cards

- Use cards only when content is a distinct, reusable unit.
- Keep card padding and header alignment consistent.
- Avoid nesting cards. Use headings, spacing, or dividers for inner groups.
- A fully clickable card must remain keyboard accessible and must not contain
  conflicting nested interactions.

### Navigation

- Clearly distinguish the current location with more than color alone.
- Keep labels short, familiar, and stable between responsive layouts.
- Use breadcrumbs only when they communicate a meaningful hierarchy.
- Mobile navigation must trap neither focus nor page scrolling when closed.

### Dialogs and overlays

- Use a dialog for a focused decision or short task, not for long-form pages.
- Move focus into the dialog, contain it while open, close with Escape when
  safe, and return focus to the trigger.
- Give dialogs a visible title and keep primary actions predictable.
- Destructive confirmations must name the object and consequence.

### Feedback and status

- Use inline feedback near the affected content whenever possible.
- Toasts are for brief, non-critical confirmation and must not contain the only
  explanation of an error.
- Loading indicators should communicate what is loading. Prefer skeletons only
  when the final structure is known and layout shift would otherwise occur.
- Empty states should explain what the area is for and offer a relevant next
  action when one exists.

## Content style

- Use sentence case for headings, labels, buttons, and navigation.
- Be concise, direct, and specific. Prefer “Save changes” to “OK.”
- Use the same term for the same concept everywhere.
- Error messages should explain what happened and how to recover without blaming
  the user.
- Avoid jargon, cleverness, and unexplained abbreviations.
- Format dates, times, numbers, and currencies using the user's locale.

## Accessibility checklist

- Use semantic landmarks, a logical heading hierarchy, and a skip link.
- Ensure every control has an accessible name and every field has a label.
- Make all workflows keyboard operable with a visible focus indicator.
- Keep DOM order aligned with visual and reading order.
- Provide text alternatives for meaningful non-text content.
- Announce dynamic updates only when needed; avoid noisy live regions.
- Test with 200% zoom, reduced motion, and a high-contrast configuration.
- Do not add ARIA when native HTML already supplies the required semantics.

## UI review checklist

Before approving a screen or component, confirm:

1. The primary task is obvious within a few seconds.
2. Tokens and existing components are used consistently.
3. All relevant interaction and data states are represented.
4. Keyboard, focus, labels, semantics, and contrast are correct.
5. The layout works from 320px through wide desktop widths and at 200% zoom.
6. Copy is specific, concise, and consistent.
7. Motion is purposeful and respects reduced-motion preferences.
8. No placeholder content, accidental overflow, layout shift, or duplicated UI
   pattern remains.

## Evolving this guide

Treat this file as the source of truth, not a frozen artifact. When a new visual
pattern is intentionally introduced, first check whether an existing pattern
can cover it. If it cannot, document the new token, component, state, and usage
rule here as part of the same change.
