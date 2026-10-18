<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Homie project rules

- `docs/SPEC.md` is the source of truth for scope and behavior. Sections marked "עתידי" are out of scope for V1.
- Every user-facing string goes through `src/i18n/dictionaries/{he,en}.json`; keep both files in sync.
- Layout must work in RTL and LTR: use logical utilities (`ms-`, `pe-`, `start-`, `border-e`, `text-start`), never `ml-`/`pr-`/`left-`. Flip directional icons with `rtl:-scale-x-100`.
- Use the semantic color tokens from `src/app/globals.css` (`bg-surface`, `text-label-secondary`, `text-accent`, ...) rather than raw palette colors.
- Animations use `motion/react` springs; `MotionConfig reducedMotion="user"` is set globally. Shared easing, springs and press values live in `src/lib/motion.ts`.
- UI work follows Emil Kowalski's skills in `.cursor/skills/` (MIT): read `apple-design`, `emil-design-eng` and `mobile-native` before building or reviewing UI, and use `review-animations` / `break-ui` before calling a screen done.
