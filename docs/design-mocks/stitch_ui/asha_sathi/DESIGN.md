---
name: ASHA Sathi
colors:
  surface: '#f9f9ff'
  surface-dim: '#cadbfc'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dfe8ff'
  surface-container-highest: '#d6e3ff'
  on-surface: '#091c35'
  on-surface-variant: '#424752'
  inverse-surface: '#20314b'
  inverse-on-surface: '#ecf0ff'
  outline: '#727783'
  outline-variant: '#c2c6d4'
  surface-tint: '#005db6'
  primary: '#00478d'
  on-primary: '#ffffff'
  primary-container: '#005eb8'
  on-primary-container: '#c8daff'
  inverse-primary: '#a9c7ff'
  secondary: '#006e28'
  on-secondary: '#ffffff'
  secondary-container: '#82fc90'
  on-secondary-container: '#00752a'
  tertiary: '#004e61'
  on-tertiary: '#ffffff'
  tertiary-container: '#006880'
  on-tertiary-container: '#9be4ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a9c7ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#00468c'
  secondary-fixed: '#82fc90'
  secondary-fixed-dim: '#65df77'
  on-secondary-fixed: '#002107'
  on-secondary-fixed-variant: '#00531c'
  tertiary-fixed: '#b6ebff'
  tertiary-fixed-dim: '#57d5fc'
  on-tertiary-fixed: '#001f28'
  on-tertiary-fixed-variant: '#004e60'
  background: '#f9f9ff'
  on-background: '#091c35'
  surface-variant: '#d6e3ff'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  body-lg-mobile:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  form-gap: 20px
  touch-target: 48px
---

## Brand & Style
The design system is engineered for high-utility healthcare delivery in rural environments. It balances the rigor of clinical data with the accessibility required for field workers (ASHA) operating under diverse lighting and connectivity conditions. 

The aesthetic is **Corporate / Modern** with a focus on functional clarity. It prioritizes high-contrast legibility, large hit targets for mobile interaction, and a systematic use of semantic color to denote patient risk levels. The interface remains calm and professional, using whitespace to reduce cognitive load during complex data entry or emergency triage.

## Colors
The palette is rooted in trust and vitality. **Primary Blue** is used for core navigation and primary actions, while **Secondary Green** represents health, successful syncs, and "low-risk" status. 

**Semantic Hierarchy:**
- **High-Risk/Critical:** Reserved strictly for `#7B0000` (deep red) to signify immediate medical attention.
- **Alert/Error:** `#D50000` for system errors or failed data validation.
- **Warning/Pending:** `#FF6D00` for overdue follow-ups or moderate risk.
- **Offline Mode:** UI elements transition to `#6B778C` with clear persistent indicators to manage user expectations regarding data synchronization.

## Typography
Inter is selected for its exceptional legibility on low-resolution mobile screens and its neutral, authoritative tone. 

- **Mobile Forms:** Use `body-lg-mobile` for input labels and text to ensure readability in outdoor settings.
- **Admin Dashboards:** Utilize `body-md` and `caption` for dense data tables to maximize information density without sacrificing clarity.
- **Emphasis:** Use medium (500) and semi-bold (600) weights sparingly to highlight critical patient names or biometric values.

## Layout & Spacing
The system employs a dual-density approach:
1. **Field-Mobile (Spacious):** Uses an 8px base grid with `lg` (24px) padding in forms to prevent accidental taps. Touch targets must never fall below the `touch-target` (48px) variable.
2. **Admin-Web (Compact):** Uses a 4px base grid to allow for extensive data tables and side-by-side chart comparisons.

**Grid:** 
- Mobile: 4-column fluid grid.
- Tablet: 8-column fluid grid.
- Desktop: 12-column fixed grid (1440px max) with 24px gutters.

## Elevation & Depth
Hierarchy is established through **Tonal Layers** supplemented by subtle ambient shadows. 

- **Level 0 (Surface):** Default background (#FFFFFF or #F4F5F7).
- **Level 1 (Cards):** 1px border (#E1E4E8) with a very soft, diffused shadow (0px 2px 4px rgba(0,0,0,0.05)). This is the primary container for patient records.
- **Level 2 (Modals/Overlays):** Elevated with a more pronounced shadow (0px 8px 16px rgba(0,0,0,0.1)) to focus attention on critical interventions or confirmation dialogs.
- **Offline State:** Elements lose their elevation (flat) and adopt a greyed-out border to indicate they are read-only until sync.

## Shapes
This design system uses **Soft** roundedness (0.25rem). This choice maintains a professional, clinical appearance while feeling modern and approachable. 

- **Buttons & Inputs:** `rounded-md` (4px) for a precise, reliable look.
- **Status Badges:** Use `rounded-xl` (12px) or full pill-shape to distinguish them clearly from interactive buttons.
- **Cards:** `rounded-lg` (8px) to soften the container edges and create a friendlier patient-viewing experience.

## Components
### Buttons
- **Primary:** Solid `#005EB8` with white text. High-contrast and easily identifiable.
- **Secondary:** Outline `#005EB8` for less critical actions.
- **Urgent Action:** Solid `#D50000` for "Delete" or "Refer to Specialist."

### Cards
- Patient cards must include a color-coded vertical strip on the left edge indicating Risk Level (Green, Orange, Red).
- Use `md` spacing for internal content and `sm` for metadata labels.

### Input Fields
- Must have a minimum height of 48px on mobile.
- Labels are always persistent (no floating labels) to ensure context is never lost during long form entry in the field.

### Status Badges
- Small, rounded-pill containers with background-tinted versions of status colors (e.g., Success: Light Green background with Dark Green text).

### Data Tables (Admin)
- Row height: 40px for high density.
- Use alternating row stripes (`surfaces.muted`) for horizontal scanability.
- Persistent headers for long scrolls.

### Sync Indicators
- A prominent top-bar component showing "Last Synced: X mins ago" or "Offline: 12 records pending." Use `tertiary_color` for active syncing and `offline` status for disconnected states.