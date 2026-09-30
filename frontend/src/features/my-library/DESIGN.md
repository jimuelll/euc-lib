---
name: My Library
description: A focused account workspace for deadlines, pickups, and existing library activity.
colors:
  primary: "hsl(var(--primary))"
  primary-foreground: "hsl(var(--primary-foreground))"
  primary-hover: "var(--primary-hover)"
  action: "hsl(var(--action))"
  background: "hsl(var(--background))"
  foreground: "hsl(var(--foreground))"
  card: "hsl(var(--card))"
  muted: "hsl(var(--muted))"
  muted-foreground: "hsl(var(--muted-foreground))"
  border: "hsl(var(--border))"
  input: "hsl(var(--input))"
  ring: "hsl(var(--ring))"
  accent: "hsl(var(--accent))"
  accent-foreground: "hsl(var(--accent-foreground))"
  destructive: "hsl(var(--destructive))"
  warning: "hsl(var(--warning))"
  success: "hsl(var(--success))"
  info: "hsl(var(--info))"
typography:
  headline:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.025em"
  item-title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  md: "calc(var(--radius) - 2px)"
  lg: "var(--radius)"
  xl: "0.75rem"
spacing:
  "2": "0.5rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
  status-warning:
    textColor: "{colors.warning}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.625rem"
---

# Design System: My Library

## Overview

**Creative North Star: "Focused account workspace"**

My Library helps authenticated students and employees understand deadlines and pickup needs, then manage existing library activity. A compact account header leads to generous, readable rows. Neutral backgrounds, white light-theme surfaces, subtle borders, and maroon selection keep attention on the account's actual records.

This record applies only to `frontend/src/features/my-library`. It captures the approved direction in `.impeccable/my-library-direction.md`; it does not authorize changes to the shared navbar, footer, theme, or other routes. Semantic colors and typography come from the incumbent `frontend/src/index.css` and `frontend/tailwind.config.ts`; local accessibility overrides live in `my-library.css`. Frontmatter retains the actual CSS-variable bindings so shared light and dark themes remain the source of truth.

**Key Characteristics:**

- Deadline-led activity, with loans ahead of discovery.
- Sentence case, restrained surfaces, and generous rows.
- Text alongside status color; honest loading, failure, and cached-data states.
- Shared capabilities reused within a responsive account workspace.

## Colors

### Primary

Maroon `primary` identifies the main QR action; `primary-hover` supplies its existing emphasis state. `action` colors links and selected section text, including the inherited lighter dark-theme treatment. Selected desktop navigation adds a subtle primary tint.

### Neutral

`background` provides the neutral canvas; `card` provides white light-theme surfaces and inherited dark surfaces. `foreground` carries titles and content; `muted-foreground` carries supporting metadata. `muted` separates navigation, disclosures, counts, and skeletons. `border` divides records and outlines panels; outline buttons reuse `input`, `accent`, and `accent-foreground`.

Status colors retain their meaning: `destructive` for overdue items and failures, `warning` for due soon, `success` for pickup readiness, and `info` for ordinary borrowing or pending reservations. Pills use a ten-percent tint of their status color. My Library locally overrides warning to `hsl(35 88% 30%)` in light mode and `hsl(39 85% 67%)` in dark mode to meet small-text contrast. Keep these overrides scoped to the workspace.

**The Status Text Rule.** State urgency in words as well as color; small text must meet 4.5:1 contrast.

## Typography

DM Sans with system-ui and sans-serif fallbacks is inherited for headings and body copy. Content stays predominantly readable (14–16px); status labels and compact mobile navigation use the existing smaller label role (12px). The page headline is compact (30px); panel titles (18px) and view headings (20px) establish hierarchy without a marketing masthead.

Use semibold item titles and medium actions. Explanatory copy uses a relaxed line height (24px), while short metadata uses the body role. Dates, fines, and pagination use tabular numerals. Sentence case applies to authored labels; long names, titles, and identifiers wrap rather than force horizontal overflow.

## Layout

The main container is centered with a maximum width (1440px). Horizontal gutters grow from (16px) to (32px) at the small breakpoint and (40px) at the large breakpoint. The header wraps its account identity and actions and ends with a subtle divider.

- At and above (1280px): a sidebar (184px), flexible main column, and overview account rail (248px). The sidebar-to-content gap is (32px); the overview content-to-rail gap is (24px).
- From (1024px) through (1279px): the sidebar remains; the account rail flows below the overview lists.
- Below (1024px): four top navigation links and one content column. Below (640px), section icons and numeric unread badges give way to compact labels and an unread indicator.

The sidebar is sticky with a top offset (96px). Main groups use gaps (20–24px); panel headers and rows use vertical padding (20px) and horizontal padding (20px), increasing to (24px) at the small breakpoint. Visit records and disclosure details become multi-column at (640px). Controls wrap naturally and retain minimum targets (44px).

## Elevation & Depth

Panels are flat at rest: surface tone, one-pixel borders, and row dividers supply structure. Hover adds a muted tint without lifting records. The reused QR dialog alone uses the shared large shadow and a black overlay at eighty-percent opacity. Shared focus rings remain visible; inherited reduced-motion settings shorten motion, and the disclosure chevron explicitly disables its transition for reduced motion.

## Shapes

Workspace surfaces and the QR dialog use gently curved corners (12px). Inner disclosures, retry notices, mobile navigation, and QR images use the inherited large radius (8px). Buttons and status pills use the inherited medium radius (6px). Avoid nested decorative cards inside activity lists; separators and spacing carry the hierarchy.

## Components

**Actions and navigation.** Reuse shared Button variants with minimum height (44px), visible focus, disabled states, maroon primary actions, and outline secondary actions. Overview, History, Updates, and Discover are real links persisted in `?view=` with back/forward support. `aria-current` exposes the selected section. The shared navbar and footer remain outside this feature's design boundary.

**Activity surfaces.** Urgent status links jump to the relevant list. Loans and ready pickups are deadline-sorted. Native inline loan disclosures reveal dates, location, copy barcode, and notes. History keeps independent page state for transactions and library visits, with queries activated on the relevant view. Notification rows preserve destinations and read actions, with failures reported explicitly.

**Material covers.** Borrowed-book, reservation, and History transaction rows reuse MyLibraryCover: real stored covers when available, otherwise the existing `/book-cover-fallback.svg` or `/thesis-cover-fallback.svg` for missing or broken image URLs. Images load lazily with asynchronous decoding and `object-contain`, sized (56 × 84px) on mobile and (64 × 96px) from the small breakpoint. Existing account responses add stored `image_url` and `material_type`; both remain optional for older cached data. No migration or new endpoint is required.

**Truthful states.** Skeletons announce initial loading; failures offer retry. A failed refresh labels previously loaded information as cached rather than clearing it. Show empty copy only for a legitimate loaded empty result. Unknown account data must not appear as zero counts or healthy standing. Invalid dates say information is unavailable. Fine values come from the backend; “No fines due” makes no broader eligibility claim.

**QR/account rail.** Reuse the account QR endpoint and download capability. The rail shows a smaller QR (128px); the dialog shows a larger QR (256px) constrained to its available width. The dialog stays within the viewport with a maximum height of `calc(100dvh - 2rem)` and scrolls internally. It has a named title, explanatory copy, a full-size Close action, retry, PNG download, and focus restoration to the exact opening button. QR failure is independent of account loading and failure.

**Discover.** Reuse RecommendationStrip, its dismissal behavior, availability, reference-only thesis behavior, existing fallback imagery, and digital-resource links. Dismissal targets are locally enlarged to (44px) and title links leave clearance for them. No new image assets or recommendation workflow is introduced.

## Do's and Don'ts

### Do:

- **Do** keep account deadlines and actual activity ahead of Discover.
- **Do** reuse inherited semantic tokens and scoped warning contrast in both themes.
- **Do** maintain 44px targets, visible keyboard focus, wrapping content, and text status labels.
- **Do** preserve honest loading, error, retry, cached-data, and empty states.

### Don't:

- **Don't** extend this feature's design rules to the global navbar, footer, theme, or other routes.
- **Don't** add a marketing masthead, large metric cards, or recommendations ahead of loans.
- **Don't** invent zero counts, account eligibility, fine totals, or dates while data is unknown.
- **Don't** imply new renew, cancel, or payment actions; reuse the existing capabilities and destinations.
