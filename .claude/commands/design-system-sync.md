---
description: Apply this project's shadcn/ui "new-york" neutral design system (tokens, fonts, component set) to the current project
---

You are bootstrapping or aligning a project's design system to match a known reference: a Laravel + Inertia + React app using the **stock shadcn/ui "new-york" style with the neutral base color** and Tailwind v4 CSS-variable theming. Nothing here is custom-branded — it's the default shadcn/Laravel-starter-kit look, so it's safe to apply as-is or use as a clean baseline to then rebrand.

## 1. Detect fit before acting

Check the current project for:
- A React (or Inertia+React) frontend with Tailwind CSS (v4 preferred — `@import 'tailwindcss'` + `@theme` block, not a `tailwind.config.js`-only v3 setup).
- Whether `components.json` already exists (shadcn already initialized).

If the project uses Vue/Svelte/plain HTML, or Tailwind v3, stop and tell the user this command targets shadcn/ui for React + Tailwind v4 — offer to adapt manually instead of forcing it.

## 2. `components.json`

Ensure this exists at the project root (create or update, preserving any existing `aliases` paths if they already point somewhere sensible):

```json
{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": false,
    "tsx": true,
    "tailwind": {
        "config": "",
        "css": "resources/css/app.css",
        "baseColor": "neutral",
        "cssVariables": true,
        "prefix": ""
    },
    "aliases": {
        "components": "@/components",
        "utils": "@/lib/utils",
        "ui": "@/components/ui",
        "lib": "@/lib",
        "hooks": "@/hooks"
    },
    "iconLibrary": "lucide"
}
```

Adjust `tailwind.css` and the `aliases` paths to match the target project's actual structure (e.g. `src/` vs `resources/js/`).

## 3. Theme tokens (CSS file referenced above)

Merge this into the project's main CSS entry file. If the file already has content (fonts, other `@import`s), merge rather than overwrite:

```css
@import 'tailwindcss';

@plugin 'tailwindcss-animate';
@plugin '@tailwindcss/typography';

@custom-variant dark (&:is(.dark *));

@theme {
    --font-sans:
        'Instrument Sans', ui-sans-serif, system-ui, sans-serif,
        'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
        'Noto Color Emoji';

    --radius-lg: var(--radius);
    --radius-md: calc(var(--radius) - 2px);
    --radius-sm: calc(var(--radius) - 4px);

    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-card: var(--card);
    --color-card-foreground: var(--card-foreground);
    --color-popover: var(--popover);
    --color-popover-foreground: var(--popover-foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-destructive: var(--destructive);
    --color-destructive-foreground: var(--destructive-foreground);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --color-chart-1: var(--chart-1);
    --color-chart-2: var(--chart-2);
    --color-chart-3: var(--chart-3);
    --color-chart-4: var(--chart-4);
    --color-chart-5: var(--chart-5);
    --color-sidebar: var(--sidebar);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-ring: var(--sidebar-ring);
}

:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.87 0 0);
    --chart-1: oklch(0.646 0.222 41.116);
    --chart-2: oklch(0.6 0.118 184.704);
    --chart-3: oklch(0.398 0.07 227.392);
    --chart-4: oklch(0.828 0.189 84.429);
    --chart-5: oklch(0.769 0.188 70.08);
    --radius: 0.625rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.87 0 0);
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.145 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.145 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.985 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.396 0.141 25.723);
    --destructive-foreground: oklch(0.637 0.237 25.331);
    --border: oklch(0.269 0 0);
    --input: oklch(0.269 0 0);
    --ring: oklch(0.439 0 0);
    --chart-1: oklch(0.488 0.243 264.376);
    --chart-2: oklch(0.696 0.17 162.48);
    --chart-3: oklch(0.769 0.188 70.08);
    --chart-4: oklch(0.627 0.265 303.9);
    --chart-5: oklch(0.645 0.246 16.439);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.985 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(0.269 0 0);
    --sidebar-ring: oklch(0.439 0 0);
}

@layer base {
    * {
        @apply border-border;
    }

    body {
        @apply bg-background text-foreground;
    }
}
```

Note: all `oklch(... 0 0)` values above are achromatic (zero chroma) — this is a pure neutral gray theme, no brand hue. If the user wants a branded palette instead, ask before overwriting these; otherwise keep them as-is since they're the shadcn defaults.

## 4. Font

Load **Instrument Sans** (weights 400/500/600) via Bunny Fonts in the app's HTML head (or the framework's equivalent — e.g. `_document`, `index.html`, root layout):

```html
<link rel="preconnect" href="https://fonts.bunny.net">
<link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
```

Apply `font-sans antialiased` to `<body>`.

## 5. Dependencies

Install if missing:

```
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate @tailwindcss/typography
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-label @radix-ui/react-navigation-menu @radix-ui/react-separator @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-alert-dialog
npm install lucide-react @tabler/icons-react
```

Create `@/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
```

## 6. Base component set

Use the shadcn CLI to pull the same baseline component set this reference project ships (skip ones already present):

```
npx shadcn@latest add alert alert-dialog avatar badge breadcrumb button card checkbox collapsible dialog dropdown-menu input input-otp label navigation-menu select separator sheet sidebar skeleton table tabs textarea toggle toggle-group tooltip
```

If the CLI isn't set up for this stack, hand-port components individually from the reference project's `resources/js/components/ui/` instead — they follow the standard shadcn "new-york" API (e.g. `button.tsx` uses `cva` for `variant`/`size` with `data-slot="button"`, `Slot` for `asChild`, and the shared `cn()` helper).

## 7. Conventions to carry forward

- **Variants**: `class-variance-authority` (`cva`), never ad-hoc conditional class strings.
- **Class merging**: always `cn()` from `@/lib/utils`, never raw template-string concatenation of classes.
- **Icons**: `lucide-react` for shadcn-generated components (the configured `iconLibrary`), `@tabler/icons-react` is also available project-wide for general iconography.
- **Composition**: Radix primitives under the hood; don't reach for a different headless-UI library for overlays/menus/tooltips if a Radix-based shadcn component already covers it.
- **Dark mode**: class-based (`.dark` on an ancestor, toggled via a `dark:` variant defined as `@custom-variant dark (&:is(.dark *))`), not a `media` strategy.
- **Radius**: single `--radius` var (`0.625rem`) driving `--radius-{sm,md,lg}` — don't hardcode `rounded-*` px values that diverge from these.

## 8. After applying

Run the project's build/dev command and visually confirm base components (Button, Card, Dialog) render with the neutral theme in both light and dark mode before reporting done.
