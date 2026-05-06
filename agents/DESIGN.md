# Design System For Agents

This document is the design reference for AI agents changing SignSight UI.

SignSight has two visual modes:

1. Mobile app and developer lab: operational, camera-first, warm, tactile, compact.
2. Web landing/admin: public marketing plus internal admin dashboard.

When editing UI, match the existing surface. Do not introduce a new design language unless the task explicitly asks for a redesign.

## Product Feel

SignSight should feel:

- Practical and trustworthy.
- Camera-native and responsive.
- Clear under pressure.
- Warm without becoming playful or decorative.
- Focused on recognition state, data quality, and user action.

Avoid:

- Generic SaaS landing-page patterns inside the app.
- Overly decorative gradients in tool surfaces.
- UI that explains itself with paragraphs inside the app.
- Large marketing hero layouts inside operational screens.
- Unstable layout that shifts as predictions change.

## Mobile Design Principles

### Camera Screens

Camera screens should prioritize:

- The live camera view.
- Recognition result.
- Capture or mode controls.
- Minimal obstruction of the hand area.
- High contrast overlays.
- Stable dimensions for prediction cards and action buttons.

Do:

- Use translucent overlays where needed.
- Keep controls near thumb-reachable zones.
- Maintain safe-area and Android navigation bar awareness.
- Preserve frame rate by avoiding heavy render churn.

Do not:

- Place large cards over the center of the camera feed.
- Re-render expensive overlays on every frame unnecessarily.
- Add instructional text blocks to the camera view.

### Developer Lab

The lab is an internal model-operations tool. It should feel dense but understandable.

Use:

- Clear section headers.
- Compact cards.
- Status chips.
- Icon buttons for repeated actions.
- Progress and quota indicators.
- Direct error messages.

Avoid:

- Marketing copy.
- Oversized hero sections.
- Unnecessary illustrations.
- Nested cards inside cards.

### Feedback and Settings

These screens should be calm, simple, and accessible.

Use:

- Clear labels.
- Large touch targets.
- Plain status messages.
- Consistent spacing.

## Mobile Tokens

Source files:

- `app/src/components/lab/shared/labColors.ts`
- `app/src/config/spacing.ts`
- `app/src/config/typography.ts`

### Color Tokens

| Token | Value | Use |
| --- | --- | --- |
| `ACCENT` | `#E66E19` | Brand accent, selected controls, primary visual identity. |
| `PRIMARY_CONTAINER` | `#F47A22` | Strong primary areas. |
| `ACCENT_LIGHT` | `#FFF3E0` | Soft accent surfaces. |
| `BG` | `#F8F9FA` | Main light background. |
| `BG_CARD` | `#FFFFFF` | Cards and sheets. |
| `BG_MUTED` | `#F5F1EB` | Muted grouped surfaces. |
| `TEXT` | `#191C1D` | Primary text. |
| `TEXT_SECONDARY` | `#6B7280` | Secondary labels. |
| `TEXT_TERTIARY` | `#9CA3AF` | Hints and tertiary metadata. |
| `BORDER` | `#E5E7EB` | Standard border. |
| `SUCCESS` | `#16A34A` | Ready, saved, healthy state. |
| `WARNING` | `#D97706` | Deficit, caution, partial readiness. |
| `INFO` | `#2563EB` | Informational state. |
| `DANGER` | `#DC2626` | Error, rejected, destructive, recording. |

### Spacing

The app uses an 8-point spacing system:

| Token | Value |
| --- | ---: |
| `SPACE_XXS` | 4 |
| `SPACE_XS` | 8 |
| `SPACE_SM` | 12 |
| `SPACE_MD` | 16 |
| `SPACE_LG` | 24 |
| `SPACE_XL` | 32 |
| `SPACE_2XL` | 48 |
| `SPACE_3XL` | 64 |

### Typography

Use existing typography scale:

| Token | Size | Intended use |
| --- | ---: | --- |
| `TEXT_4XL` | 28 | Large preview or symbol. |
| `TEXT_3XL` | 22 | Page titles. |
| `TEXT_2XL` | 18 | Hero or prominent titles. |
| `TEXT_XL` | 18 | Section titles and large targets. |
| `TEXT_LG` | 16 | Cards and callouts. |
| `TEXT_MD` | 14 | Standard body and buttons. |
| `TEXT_SM` | 13 | Subtitles and secondary text. |
| `TEXT_XS` | 12 | Captions and chips. |
| `TEXT_XXS` | 9 | Micro labels and fine print. |

## Component Patterns

### Buttons

Use buttons for actions. Use icons for common tool actions such as back, close, refresh, camera flip, torch, archive, rename, and capture.

Button rules:

- Keep touch targets large enough on mobile.
- Use disabled state when action preconditions are not met.
- Keep labels short.
- For destructive actions, use danger styling and clear confirmation when needed.

### Cards

Cards are appropriate for:

- Dataset metrics.
- Model rows.
- Feedback/audit records.
- Compact detail panels.

Do not nest cards inside cards. If grouping is needed, use dividers, sections, or full-width bands.

### Bottom Sheets

Bottom sheets are used for target/model selection in the lab.

Rules:

- Keep row heights stable.
- Use selected indicators.
- Avoid expensive live content inside sheets.
- Do not let background camera motion make the sheet unreadable.

### Status States

Use consistent tone:

| State | Tone |
| --- | --- |
| Ready/success | Green |
| Partial/in-progress | Blue or orange |
| Warning/deficit | Amber |
| Error/rejected | Red |
| Disabled/unknown | Gray |

## Web Admin Design

The admin dashboard is an operational tool. It should be dense, scannable, and restrained.

Prioritize:

- Filtering.
- Table/list clarity.
- Bulk scanning.
- Status visibility.
- Fast resolve and audit workflows.

Avoid:

- Public marketing composition.
- Oversized decorative cards.
- Hidden critical metadata.

## Landing Page Design

The public landing page can be more expressive, but it should still show the actual product value:

- SignSight name must be visible in first viewport.
- Product/device imagery should be concrete.
- Primary CTA should be obvious.
- Avoid purely decorative visuals that do not show recognition or learning context.

## Accessibility Rules

For any UI change:

- Text must not overlap its container.
- Touch controls must be reachable and large enough.
- Color should not be the only signal for status.
- Dynamic text should have stable layout bounds.
- Camera overlays must remain readable against bright and dark backgrounds.
- Do not use tiny text for essential status.

## Agent UI Change Checklist

Before finishing UI work:

- Compare against neighboring screens/components.
- Check mobile small width behavior.
- Check long labels and errors.
- Check disabled/loading/error/success states.
- Verify no text overlap.
- Verify no important camera area is blocked.
- Run TypeScript for the changed surface.

