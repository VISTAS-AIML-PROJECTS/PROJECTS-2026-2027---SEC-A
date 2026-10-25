---
name: SepsisGuard Clinical Sanctuary
colors:
  surface: '#121412'
  surface-dim: '#121412'
  surface-bright: '#383a37'
  surface-container-lowest: '#0d0f0d'
  surface-container-low: '#1a1c1a'
  surface-container: '#1e201e'
  surface-container-high: '#282a28'
  surface-container-highest: '#333533'
  on-surface: '#e2e3df'
  on-surface-variant: '#c2c8c2'
  inverse-surface: '#e2e3df'
  inverse-on-surface: '#2f312f'
  outline: '#8c928d'
  outline-variant: '#424844'
  surface-tint: '#b3cdbb'
  primary: '#b3cdbb'
  on-primary: '#1f3529'
  primary-container: '#182e22'
  on-primary-container: '#7e9686'
  inverse-primary: '#4c6455'
  secondary: '#accfb8'
  on-secondary: '#173627'
  secondary-container: '#2e4d3c'
  on-secondary-container: '#9bbda7'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00311f'
  on-tertiary-container: '#00a572'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#cfe9d6'
  primary-fixed-dim: '#b3cdbb'
  on-primary-fixed: '#092014'
  on-primary-fixed-variant: '#354c3e'
  secondary-fixed: '#c7ebd4'
  secondary-fixed-dim: '#accfb8'
  on-secondary-fixed: '#012113'
  on-secondary-fixed-variant: '#2e4d3c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#121412'
  on-background: '#e2e3df'
  surface-variant: '#333533'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  vital-metric-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  vital-metric-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Manrope
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-xs:
    fontFamily: Manrope
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2.5rem
  margin-mobile: 1rem
  space-xxs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
---

## Brand & Style

This design system is formulated for high-stress intensive care, telemetry, and early sepsis intervention environments where sensory overload directly degrades clinical decision-making. The philosophy merges the biological serenity of a regenerative forest sanctuary with the surgical rigor of high-stakes critical care software. It intentionally repudiates harsh alarms, stark monochromatic hospital grey-scales, and jagged telemetry dashboards in favor of an ergonomic, humanized interface.

The design movement combines **Tonal Biophilic Minimalism** with tactile, warm paper-grade clinical cards. By establishing deep, light-absorbing forest backdrops (`#182E22`) paired with tactile off-white vital cards (`#FBFBF7`), the interface immediately lowers sympathetic nervous system activation in clinicians while maintaining uncompromising optical hierarchy. Information architecture is radically prioritized: routine states rest quietly within organic translucent sage matrices, while acute telemetry, shock alerts, and organ dysfunction indicators emerge with surgical clarity. The resulting emotional tone is authoritative, grounding, and effortlessly lucid under extreme cognitive load.

## Colors

The palette is anchored by deep botanical dark-mode foundations, counterbalanced by tactile warm cream paper surfaces engineered specifically for high-priority clinical readouts.

### Canvas & Surface Hierarchy
- **Canvas Base (`#112318` / `#182E22`)**: Low-strain, light-absorbing natural forest greens that reduce display glare in dim ICU bays and night shifts.
- **Layered Sage Containers (`#243E30` / `#2E4D3C`)**: Mid-tier structural containment for patient records, trends, and systemic workflow modules.
- **Tactile Paper Surfaces (`#FBFBF7`, `#F4F3EC`, `#EDEBE2`)**: High-contrast, inverted focal islands. These cream surfaces host real-time vitals, MEWS/SOFA scores, and core telemetry, reversing contrast with deep pine ink (`#12261B`, `#1E3328`) to maximize rapid saccadic readability across the room.

### Clinical Telemetry & Triage Tokens
- **Stable Vital Emerald (`#10B981`, `#22C55E`)**: Indicates physiological homeostasis, negative blood cultures, and stabilizing arterial pressure without visual fatigue.
- **Early Warning Amber (`#F59E0B`)**: Non-blaring, warm cautionary amber for borderline lactate escalation, low urine output, or early organ distress markers.
- **Critical Alert Coral (`#EF4444`)**: High-fidelity, urgent coral red reserved strictly for septic shock thresholds, refractory hypotension, and life-threatening telemetry events.
- **Ghost Outlines (`rgba(251, 251, 247, 0.08)`)**: Soft perimeter strokes that separate overlapping botanical planes without generating visual noise.

## Typography

Typography balances clinical accuracy with visual softness. 

- **Plus Jakarta Sans** governs all structural headlines, modal dialogs, and high-impact vital statistics. Its refined geometry, generous counters, and soft apertures maintain legibility from glancing angles at bedside workstations. All quantitative vitals (`vital-metric-xl`, `vital-metric-md`) require tabular lining figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during rapid real-time telemetry streaming.
- **Manrope** provides the operational body and technical label structure. Its open terminal strokes, robust x-height, and neutral precision ensure effortless parsing of complex clinical notes, pharmacologic dosing, and laboratory differentials.

Micro-labels (`label-xs`, `label-md`) must always be formatted in title-case or balanced small capitals with elevated tracking (`0.04em` to `0.06em`) to prevent optical crowding against dense vital figures.

## Layout & Spacing

The layout model implements a flexible, non-crammed 12-column dynamic grid system engineered to handle multi-patient telemetry overviews on wide terminal monitors, while seamlessly collapsing into high-density single-column viewports on mobile clinical tablets.

### Responsive Breakpoints & Margin Rules
- **Desktop & Ward Wallboards (1440px+)**: 12 columns, `margin: 2.5rem`, `gutter: 1.5rem`. Accommodates triple-tier split views: Patient Ward Matrix (Left 4 cols), Active Sepsis Trajectory (Center 5 cols), Real-time Interventions & IV Hydration Schedule (Right 3 cols).
- **Tablet Clinical Workstation (768px - 1439px)**: 8 columns, `margin: 1.5rem`, `gutter: 1rem`. Fluid modular collapse prioritizing the primary patient focal canvas with sliding secondary telemetry drawers.
- **Mobile Rapid Response Handheld (<768px)**: 4 columns, `margin: 1rem`, `gutter: 0.75rem`. Stacks vitals vertically, converting tabular telemetry into single-swipe card arrays.

### Spacing Philosophy
Generous whitespace (`space-lg` and `space-xl`) is treated as a clinical tool to prevent misinterpretation under sleep deprivation. Vital badges, metric blocks, and medication dosages must maintain at least `space-md` separation from auxiliary descriptions.

## Elevation & Depth

Visual hierarchy uses organic **Tonal Layering** combined with **Ambient Botanical Shadows** and micro-translucency. Harsh dropshadows and stark dark-mode bevels are rejected.

### Tiered Elevation Planes
1. **Bedrock (Level 0 - `#112318`)**: Deep obsidian-forest background canvas. Un-elevated and non-interactive.
2. **Organic Sage Shells (Level 1 - `#1E3628`)**: Resting module containers. Bordered with a delicate inner ambient stroke (`1px solid rgba(251, 251, 247, 0.05)`). No drop shadow.
3. **Elevated Patient Trays (Level 2 - `#243E30`)**: Elevated cards or interactive panels. Soft diffused shadow: `0 8px 24px -4px rgba(6, 17, 11, 0.45)`.
4. **Tactile Paper Vital Cards (Level 3 - `#FBFBF7`)**: Physical, cream paper cards that appear visually closer to the clinician. High ambient occlusion: `0 12px 32px -4px rgba(0, 0, 0, 0.35), 0 2px 6px 0 rgba(0, 0, 0, 0.15)`. High-contrast dark green ink rests on top.
5. **Urgent Triage Overlays & Resuscitation Modals (Level 4 - `#2E4D3C` or Tinted `#FBFBF7`)**: Centered overlays paired with an organic backdrop blur: `backdrop-filter: blur(16px)` over `rgba(17, 35, 24, 0.75)`. Shadow: `0 24px 48px -12px rgba(4, 12, 8, 0.6)`.

## Shapes

The design system employs **Pill-shaped (Level 3)** roundedness to project calm, humanized authority. Sharp right-angles induce subconscious psychological tension and are eliminated across all surfaces.

- **Primary Canvas Cards & Trays (`round-3xl` / `3rem` / `48px`)**: Outer clinical modules, patient overviews, and parent container boundaries.
- **Vital Paper Islands & Modals (`round-2xl` / `2rem` / `32px`)**: Discrete cream telemetry cards, organ function cards, and clinical alert surfaces.
- **Controls, Input Fields & Badges (`rounded-full` / `9999px` or `1rem` / `16px`)**: Triage pills, medication tags, telemetry action buttons, and segmented controls maintain a fully rounded ergonomic silhouette.

## Components

### 1. Paper Vital Cards (Focal Islands)
- **Structure**: Rendered in warm cream (`#FBFBF7`) with generous `2rem` internal padding and `2rem` corner radius.
- **Content**: Displays high-priority telemetry (Mean Arterial Pressure, Heart Rate, qSOFA/SIRS scores, Serum Lactate). Text is rendered in deep forest ink (`#12261B`) for maximum readability.
- **Status Indicator**: Incorporates an organic status dot (8px pill) in Vital Emerald (`#10B981`), Warning Amber (`#F59E0B`), or Coral Red (`#EF4444`).

### 2. Buttons & Clinical Triggers
- **Primary Action (Protocol Initiation)**: Emerald fill (`#10B981`) with dark pine text (`#0E2015`), pill-shaped (`9999px`), bold weight (`600`), subtle glowing hover state (`box-shadow: 0 0 20px rgba(16, 185, 129, 0.35)`).
- **Secondary Action (Order Review / Lab History)**: Translucent sage surface (`rgba(251, 251, 247, 0.08)`) with cream text (`#FBFBF7`) and 1px border (`rgba(251, 251, 247, 0.12)`).
- **Emergency Code Red (Septic Shock Override)**: Solid coral red (`#EF4444`), warm white text (`#FFFFFF`), with an pulsing ambient glow.

### 3. Triage & Risk Chips
- Fully rounded pills (`round-full`), padded with `0.375rem 0.875rem`.
- Backgrounds use low-opacity status fills:
  - *Low Risk*: `rgba(16, 185, 129, 0.15)` with `#22C55E` text.
  - *SIRS Warning*: `rgba(245, 158, 11, 0.15)` with `#F59E0B` text.
  - *Sepsis Alert*: `rgba(239, 68, 68, 0.18)` with `#EF4444` text.

### 4. Patient Lists & Telemetry Streamers
- Alternating or grouped items rest inside sage translucent modules (`#1E3628`).
- Row separation uses low-opacity horizontal dividers (`rgba(251, 251, 247, 0.06)`).
- Interactive hover transitions gently elevate the row to `#243E30` with an eased 150ms bezier curve.

### 5. Checkboxes, Toggles & Radios
- Checkboxes use `8px` rounded squares; Radios are circular.
- Unchecked: Translucent sage fill (`#243E30`) with a subtle `rgba(251, 251, 247, 0.2)` border.
- Checked: Vital Emerald fill (`#10B981`) with crisp pine checkmark.
- Toggles feature an elongated organic pill container (`#182E22`) with a sliding cream bead (`#FBFBF7`).

### 6. Clinical Input Fields
- Deep forest inset (`#112318`), `1rem` radius, `0.75rem 1.25rem` padding.
- Border: `1px solid rgba(251, 251, 247, 0.12)`.
- Focus state: Border transitions to `#10B981` with an outer green ambient glow (`0 0 0 3px rgba(16, 185, 129, 0.15)`). Placeholder text in muted sage (`rgba(251, 251, 247, 0.4)`).