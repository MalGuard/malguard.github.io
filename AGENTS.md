# MalGuard UI design system

Apply these rules to the main website and product interfaces in this repository. Use dark as the default and keep light as a supported theme. Use the existing MalGuard logo assets. Keep shared tokens in the existing theme layer for each application and reuse current components. On React surfaces that support shadcn/ui, prefer its accessible primitives. On static pages, use the site's shared components and CSS.

## Color

Use these semantic roles in both themes. Use status text with an icon or label so users can understand the status independently of color.

| Token | Dark | Light |
| --- | --- | --- |
| Background | `#05070A` | `#F4F7FA` |
| Surface | `#0B0F14` | `#FFFFFF` |
| Elevated surface | `#11161D` | `#EDF3F7` |
| Input | `#0E1319` | `#FFFFFF` |
| Subtle divider | `#1C242E` | `#D8E1EA` |
| Control border | `#64748B` | `#64748B` |
| Text | `#E8EDF2` | `#101923` |
| Muted text | `#9AA7B4` | `#495A6C` |
| Accent | `#22D3EE` | `#0E6678` |
| Accent hover | `#67E8F9` | `#0B5665` |
| On accent | `#05070A` | `#FFFFFF` |
| Focus ring | `#22D3EE` | `#0E6678` |
| Success | `#4ADE80` | `#166534` |
| Warning | `#FBBF24` | `#854D0E` |
| Error | `#FCA5A5` | `#991B1B` |
| Info | `#7DD3FC` | `#075985` |

Use the subtle divider for decorative separation and the control border when a boundary identifies an input or control. Use the on-accent token for filled accent controls. Check contrast against the actual rendered background. WCAG AA requires at least 4.5:1 for normal text, 3:1 for large text, and 3:1 for applicable non-text indicators and authored focus cues.

## Typography and layout

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| Caption | 12 px | 400 | 1.8 |
| Label and small text | 14 px | 500 | 1.8 |
| Body | 16 px | 400 | 1.8 |
| Lead | 18 px | 400 | 1.8 |
| Small heading | 20 px | 600 | 1.5 |
| Section heading | 24 or 32 px | 700 | 1.4 |
| Page heading | 32 or 40 px | 700 | 1.35 |

Use `Vazirmatn, system-ui, sans-serif` on Persian pages, `system-ui, sans-serif` for Latin UI, and `ui-monospace, SFMono-Regular, Consolas, monospace` for code, hashes, and technical values. Implement text sizes in rem to honor browser zoom and font-size preferences. Use semantic heading levels.

- Spacing in px follows `4, 8, 12, 16, 24, 32, 48, 64`. Use 16 px page gutters on small screens and 24–32 px at wider widths.
- Radius in px follows `6` for fields and small controls, `10` for cards and primary buttons, `16` for dialogs and prominent surfaces, and `9999` for pills.
- Use a flat surface by default. Use `0 2px 8px rgb(0 0 0 / 20%)` and `0 12px 32px rgb(0 0 0 / 35%)` for dark raised surfaces and overlays. Use the same offsets and blur in light with 8% and 14% alpha, respectively.

## Interaction

- Give controls distinct hover, `:focus-visible`, pressed, and disabled states. Use a 2 px focus outline with a 2 px offset. Keep focus visible inside scroll containers and overlays.
- Use 150 ms for hover and focus, 200 ms for state changes, and 250 ms for overlays. Animate specific properties using `ease-out`. Under `prefers-reduced-motion: reduce`, remove nonessential movement and preserve visible state feedback.
- Keep loading, empty, and error states readable and actionable. Reserve space for loading when practical, expose state changes to assistive technology when appropriate, and preserve focus across transitions.

## Persian and RTL

Set `lang="fa"` and `dir="rtl"` on the Persian document root. Use logical CSS and direction-aware components, mirror directional icons, and isolate Latin strings, code, and URLs in LTR. Follow [rtl-persian](.agents/skills/rtl-persian/SKILL.md) for implementation and testing.

**Run [ui-review](.agents/skills/ui-review/SKILL.md) after every UI change.**
