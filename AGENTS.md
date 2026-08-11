# AGENTS.md

## Project goal

Build and maintain a polished Vite + React application with a consistent,
accessible, responsive user interface. Favor simple, reusable patterns over
one-off styling and unnecessary abstractions.

Follow [`DESIGN.md`](./DESIGN.md) for the visual language, design tokens,
component anatomy, responsive behavior, and UI review criteria. When the two
files overlap, this file governs engineering workflow and `DESIGN.md` governs
visual and interaction decisions.

## Default stack

- Vite with React and TypeScript.
- Functional components and React hooks.
- CSS Modules for component styles and a small global design-token layer.
- Vitest and React Testing Library for tests.
- ESLint and Prettier for code quality and formatting.

Do not add a UI framework, state library, form library, icon pack, or other
runtime dependency unless the task requires it or the existing project already
uses it. Reuse the established stack when this repository has been initialized.

## Initial setup

When no app exists, scaffold it with:

```sh
npm create vite@latest . -- --template react-ts
npm install
```

Before changing an existing app, inspect `package.json`, the source tree, and
the current styling conventions. Do not replace working project conventions
solely to match these defaults.

## Common commands

Use the scripts defined in `package.json`. Expected defaults are:

```sh
npm run dev
npm run build
npm run lint
npm run test
```

Run lint, relevant tests, and a production build before considering a change
complete. If a command is unavailable, state that clearly in the handoff.

## Source organization

Prefer this structure unless the app already has a clear alternative:

```text
src/
  assets/          Static assets imported by the app
  components/      Reusable UI components
  features/        Feature-specific components, hooks, and logic
  hooks/           Shared React hooks
  lib/             Framework-agnostic utilities
  pages/           Route-level screens
  styles/          Global styles, tokens, reset, and utilities
  test/            Shared test setup and helpers
  types/           Shared TypeScript types
```

- Keep components focused and colocate their styles and tests.
- Put feature-specific code inside its feature instead of broad global folders.
- Use named exports for reusable modules. Reserve default exports for route or
  framework entry modules where they improve convention and readability.
- Avoid barrel files when they obscure dependencies or create import cycles.

## React and TypeScript standards

- Keep TypeScript strict. Do not use `any`; prefer precise types or `unknown`
  with narrowing.
- Use semantic HTML before adding ARIA attributes or custom behavior.
- Keep render functions declarative. Move complex transformations into named
  helpers and isolate side effects in hooks.
- Do not store derived values in state. Compute them during render or memoize
  only when profiling demonstrates a benefit.
- Use stable, meaningful keys for lists; never use an array index when items can
  be reordered, inserted, or removed.
- Model loading, empty, error, and success states explicitly.
- Avoid premature `useMemo`, `useCallback`, and component abstraction.
- Never expose secrets in client code or in `VITE_*` environment variables.

## UI design system

Define shared primitives as CSS custom properties in a global token file. UI
code should consume semantic tokens rather than scattered literal values.

At minimum, standardize:

- Color roles: canvas, surface, text, muted text, border, primary, success,
  warning, danger, and focus.
- Typography: one font stack, a restrained type scale, readable line heights,
  and consistent font weights.
- Spacing: use a 4px-based scale such as 4, 8, 12, 16, 24, 32, 48, and 64px.
- Shape and depth: a small radius scale, border treatments, and no more than a
  few purposeful shadow levels.
- Motion: consistent durations and easing, with reduced-motion support.
- Layout: shared content widths, gutters, and responsive breakpoints.

Build reusable primitives for recurring controls such as buttons, inputs,
selects, cards, dialogs, alerts, badges, and loading indicators. Each primitive
must have consistent sizes, states, and variants. Extend an existing primitive
instead of recreating a look-alike inside a feature.

## Visual quality rules

- Establish clear hierarchy using spacing, typography, and contrast.
- Prefer restrained color and decoration; every visual effect should support
  hierarchy, feedback, or affordance.
- Align content to a consistent grid and avoid arbitrary pixel offsets.
- Design mobile-first, then verify common phone, tablet, laptop, and wide-screen
  widths. Prevent horizontal overflow at narrow widths.
- Keep touch targets at least 44 by 44 CSS pixels where practical.
- Use icons consistently and pair unfamiliar icons with visible labels.
- Do not use placeholder copy, broken images, or unfinished empty areas in the
  completed UI.
- Preserve user-entered data and provide immediate, specific feedback for
  validation errors and asynchronous actions.

## Accessibility

Target WCAG 2.2 AA:

- All functionality must work with a keyboard and have a logical focus order.
- Show a clearly visible `:focus-visible` state; never remove outlines without
  an accessible replacement.
- Associate every input with a label and connect errors/help text using the
  appropriate accessible description.
- Use buttons for actions and links for navigation.
- Ensure sufficient text and non-text contrast in every state, including
  disabled, hover, active, and error states.
- Provide meaningful alternative text for informative images and empty alt text
  for decorative images.
- Announce important asynchronous status changes when they are not otherwise
  conveyed to assistive technology.
- Respect `prefers-reduced-motion` and avoid motion that is required to
  understand or operate the interface.

## CSS standards

- Keep global CSS limited to reset/base rules, tokens, themes, and true global
  utilities.
- Use logical properties where they improve internationalization.
- Prefer Grid for two-dimensional page structure and Flexbox for one-dimensional
  alignment.
- Avoid `!important`, deeply nested selectors, and styling by DOM position.
- Do not encode business state only through color; combine color with text,
  icons, or shape.
- Support dark mode only when it is implemented consistently across every
  surface and interactive state.

## Data and interaction behavior

- Keep server/API access in dedicated modules rather than directly inside
  presentational components.
- Cancel or ignore stale asynchronous work and prevent duplicate submissions.
- Give every request an intentional loading, success, empty, and failure UI.
- Use optimistic updates only when rollback behavior is clear and tested.
- Confirm destructive operations when their result is difficult to recover.

## Testing

- Test observable behavior rather than component internals.
- Cover critical user flows, validation, keyboard interaction, and failure
  states.
- Prefer accessible queries such as role, label, and visible text.
- Add a regression test when fixing a reproducible bug.
- Keep snapshots small and purposeful; do not use them as the primary assertion
  for complex screens.

## Completion checklist

Before handing off a UI change, verify:

1. It works at narrow and wide viewport sizes.
2. It is usable by keyboard and exposes correct accessible names.
3. Loading, empty, error, disabled, hover, focus, and success states are handled.
4. It uses shared tokens and components instead of duplicated values or markup.
5. There are no TypeScript, lint, test, or production-build failures caused by
   the change.
6. The final response summarizes what changed and names any checks that could
   not be run.
