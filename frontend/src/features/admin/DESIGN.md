# Admin design system

The single visual reference for every page under `/admin`, the admin shell and anything those pages open (drawers, dialogs, menus, popovers). Direction: **compact desk + paper** — warm paper colors and university identity, with the density and plain type staff need for fast, repetitive work.

Behavior, data and permission rules per page live in [WORKFLOWS.md](WORKFLOWS.md). The repository-level [DESIGN.md](../../../../DESIGN.md) governs public pages and kiosks only.

> **Status: target, not yet built.** The code still runs on the older stacked layers (`admin-theme.css`, `compact-admin.css`, `admin-workspaces.css`, `library-design.css`, `refined-drawers.css`). Each section below is the rule to build toward; [Migration](#migration) lists the order. Until a page is migrated, do not add new styling to the old layers.

## Principles

1. **Work first.** The next action on a page is obvious within one glance; reference material sits below or behind a disclosure.
2. **One way to do each thing.** One tab style, one drawer shell, one header, one primary action per surface.
3. **Honest data.** Missing values read as unavailable, never zero. Nothing is invented: counts, trends, histories, availability.
4. **Identity without decoration.** Maroon and gold mark meaning and brand; they are never used as wallpaper.
5. **Color is never the only cue.** Every status keeps a word or icon.

## Tokens

One token set, defined once on the admin root and inherited by portals. Pages never redefine `--background`, `--card`, `--primary` or `--foreground`.

### Light

| Token | Value | Use |
|---|---|---|
| `--background` | `hsl(42 31% 94%)` cream | Page background |
| `--card` | `hsl(43 100% 98.6%)` off-white paper | Panels, drawers, top bar, menus |
| `--foreground` | `hsl(343 15% 9%)` warm ink | Text |
| `--muted` | `hsl(41 24% 90%)` | Hover rows, read-only fields, disabled fills |
| `--muted-foreground` | `hsl(354 5% 40%)` | Secondary text |
| `--border` | `hsl(39 20% 80%)` | Rules and control borders |
| `--primary` / `--maroon` | `#7a0000` | Primary button, selected chip, sidebar |
| `--primary-hover` | `#930e0e` | Primary hover |
| `--gold` | `#c9961f` | Active-tab ribbon, required mark, sidebar icon accents |
| `--focus` | maroon, 2px ring, 2px offset | Keyboard focus |

### Dark

| Token | Value | Use |
|---|---|---|
| `--background` | `hsl(270 6% 7%)` charcoal | Page background |
| `--card` | `hsl(260 5% 11%)` | Panels, drawers, top bar, menus |
| `--foreground` | `hsl(36 35% 92%)` warm light ink | Text |
| `--muted` | `hsl(15 5% 17%)` | Hover rows, read-only fields |
| `--muted-foreground` | `hsl(6 5% 63%)` | Secondary text |
| `--border` | `hsl(12 5% 19%)` | Rules and control borders |
| `--primary` / `--maroon` | `#7a0000` with a `#a83a3a` 1px border | Primary button stays maroon in dark mode |
| `--link` | `hsl(9 79% 72%)` salmon | Text links, focus ring, selected-tab underline |
| `--gold` | `#f0c060` | Same uses as light |

Retired: the cool-gray admin palette, `#710000`, the pink dark-mode action color, and salmon as a button fill.

### Status colors

| Meaning | Hue | Examples |
|---|---|---|
| Blocked, overdue, expired, destructive | Coral / warm red | Overdue loans, blocked patrons, Delete |
| Waiting, fines only, needs attention | Amber | Pending reservations, Needs holdings |
| Ready, returned, cleared, success | Green | Ready pickups, returns, cleared patrons |
| Active loans, borrowing | Blue | Active loans, Borrowed |
| Attendance | Purple | Attendance counts |

Each meaning has a text color, a tinted surface and a border, defined separately for light and dark, all at least 4.5:1 for text against their own surface. Zero values use neutral surfaces. Money totals alone stay neutral; color shows urgency, not size.

## Type

- **DM Sans** for all interface text: controls, labels, tables, body, metadata.
- **Fraunces** in exactly three places: the page title, summary-tile numerals, and the record title in a drawer header.
- **Monospace** only for identifiers: accession numbers, ISBNs, library card IDs, receipt and event IDs.
- Counts, money and times use tabular numerals. Currency uses `formatPeso`.

| Size | Use |
|---|---|
| 28px Fraunces 600 | Page title |
| 20px Fraunces 600 | Drawer record title |
| 32–40px Fraunces 600 | Tile numerals (currency at the smaller size) |
| 16px DM Sans 600 | Section headings |
| 14px DM Sans | Body, table cells, controls |
| 13px DM Sans | Metadata, timestamps, helper text |
| 12px DM Sans 600 | Badges, counts, column headings |

No uppercase letter-spaced labels except column headings.

## Shape and density

- Corners: 2px on panels, controls, chips, drawers and dialogs. Tabs and table rows are square. Avatars and status dots are round.
- One level of containment: a panel never holds a bordered card. Group inside a panel with rules and headings.
- Borders are 1px `--border`. Shadows only on floating layers (drawers, dialogs, popovers, menus).
- No gradients, glows or decorative textures on admin surfaces.
- Spacing: 16px panel padding, 24px between sections, 8/12px inside controls and rows.
- Controls are 40px tall on desktop; every interactive target is at least 44px below 768px.
- Table rows: 48px compact, 60px when a row has a two-line title.

## Icons

- `AdminIcon` is the only icon set for admin content: 24px grid, 1.75px rounded strokes, `currentColor`. Render at 16–20px inline and 24px on tiles.
- `AdminSidebarIcon` keeps the same drawings with gold accents, for the sidebar and tool search only.
- Every sidebar item has a distinct icon. Icon-only buttons always have an accessible name and a tooltip.

## Shell

### Sidebar

- Maroon surface — the only large maroon area in the admin. 240px expanded, 64px collapsed rail with tooltips.
- Section labels are 12px gold-tinted text; items are 40px rows; the active item uses a soft warm tint, not white.
- Navigation scrolls independently with a bottom fade only while more items remain below.
- A fixed footer holds the account row (initials, truncated name with full name on hover), Theme, Help and a 44px Sign out.

### Top bar

- 56px paper bar with a bottom rule. Left: sidebar toggle and breadcrumb (omitted on the Dashboard). Right: tool search (Ctrl+K) and notifications.
- Theme toggle, Help and "View site" move to the sidebar account footer. No "More" menu.

### Navigation

| Section | Item | Route | Roles |
|---|---|---|---|
| — | Dashboard | `/admin` | all |
| Desk | Borrow & Return | `/admin/circulation` | all |
| Desk | Reservations | `/admin/reservations` | all |
| Desk | Clearance & Fines | `/admin/clearance` | all |
| Desk | Attendance | `/admin/attendance` | admin+ |
| Records | Users | `/admin/users` | all |
| Records | Catalog | `/admin/catalog` | all |
| Publishing | Website Content | `/admin/content` | admin+ |
| Publishing | Notifications | `/admin/notifications` (Email deliveries as a tab) | admin+ |
| Publishing | Moderation | `/admin/moderation` | admin+ |
| Insights | Analytics | `/admin/analytics` | admin+ |
| Insights | Reports | `/admin/reports` | admin+ |
| Insights | Audit Logs | `/admin/audit-logs` | super admin |
| Settings | Academic Calendar | `/admin/settings/academic` | admin+ |
| Settings | Loan Policies | `/admin/settings/loan-policies` | super admin |
| Settings | Catalog Fields | `/admin/settings/catalog-fields` | super admin |
| Settings | AI Recommendations | `/admin/settings/ai` | super admin |
| Settings | Backup & Restore | `/admin/settings/backup` | super admin |

Rules:
- A sidebar item points to its own route, never to another page's `?tab=`.
- Every page is reachable from the sidebar or as a tab of a sidebar page; no orphan routes.
- Old routes (`/admin/manage`, `/admin/holidays`, `/admin/query`, `/admin/book-types`, `/admin/backup`, `/admin/attendance-logs`, `/admin/library-emails`, `/admin/account-emails`, `catalog?tab=builder|ai`) redirect to the new ones, keeping their query parameters.
- Tool-search aliases stay with their items.

## Page layouts

Every page uses one of five layouts. The page header is the same on all of them.

**Page header:** 28px Fraunces title with an optional one-line subtitle, then on the right: Updated time + Refresh as a pair, outline secondary actions, and at most one primary action. No divider under the header; page tabs follow 16px below.

| Layout | For | Structure |
|---|---|---|
| **Desk** | Borrow & Return | Header, mode switch, step flow (Patron → Copy → Confirm), sticky confirm summary. No tiles, no history tools. |
| **Queue** | Reservations, Clearance, circulation History, Attendance today, Moderation | Header, tabs, filtering summary tiles, search, list with row actions, record drawer. |
| **Records** | Users, Catalog, Notifications, Email deliveries, Audit Logs, Reports | Header, tabs, one control row (counted chips, live search, Filters popover), table, pager, record drawer. |
| **Editor** | Website Content | Header, tabs, editor body, pinned scoped publish footer (section, unsaved count, Discard, Save draft, Publish). |
| **Settings** | Academic Calendar, Loan Policies, Catalog Fields, AI Recommendations, Backup | Header, tabs, read-only rows with row menus, Add/Edit in a drawer. |

**Dashboard** is its own layout, ordered: attention strip (moderation or failures, only when non-empty), desk actions, outstanding items, today's totals, recent transactions, then a collapsed Library overview. Staff see desk content only; admins also see the attention strip and a Reports link. No link appears twice on the page.

The page scrolls, not its panels. Wide tables scroll horizontally inside their own region with a pinned first column. No horizontal page scroll at any width.

## Components

### Tabs

One tab style everywhere, including inside drawers:
- Transparent tabs over a full-width 1px rule, left-aligned, optional icon and count badge.
- Active: ink label at 600 weight, 2px ink underline (salmon in dark mode), and a small gold ribbon notch above the label.
- Inactive: muted label, brightens on hover. Focus ring inside the tab.
- Count badges are neutral by default; attention coral only for an actionable non-zero count. Zero counts are visually hidden but stay in the accessible name.
- Narrow screens scroll the tab row horizontally.
- Tab state lives in `aria-selected` and in the URL (`?tab=`).

### Filter chips and segmented control

- List filters are counted chips: outline when off; maroon fill with off-white text when on (dark: maroon fill, light ink). "All" is always last.
- Borrow/Return is the only filled segmented control in the admin.
- Specify foreground and background together for every selected or filled control.

### Summary tiles

- Only on the Dashboard and Queue pages, and only when the tile filters or navigates. A tile never repeats a chip count shown below it.
- Each tile is one link or button: icon, label, Fraunces numeral, short hint, arrow. Selected tiles keep a visible semantic border, separate from the focus ring.
- Zero values are neutral; non-zero values take their status color.

### Tables and lists

- Column headings are 12px, sticky only within the table region. Rows separated by rules, no zebra striping.
- One visible primary action per row (maroon); secondary actions are outline; rare or destructive actions live in the row menu.
- Titles clamp to two lines with the full text on hover. Identifiers are monospace. Money is right-aligned.
- Selection uses checkboxes on the paper surface, maroon when checked, with a sticky bulk-action bar.
- Pager shows the record range and rows per page; it is hidden when there is one page.

### Drawers

One `AdminDetailDrawer` shell with three explicit variants. A drawer never opens another drawer.

| Variant | When | Header label | Footer |
|---|---|---|---|
| **View** | Reading a record | none | Optional secondary actions; an Edit button switches to Edit in place |
| **Edit** | Changing a record | "Editing" + unsaved-changes dot | Fixed Save changes (primary) / Cancel |
| **New** | Creating a record | "New …" | Fixed Create (primary) / Cancel |

- **Header:** paper surface with a double rule beneath; the variant label in 12px muted text, the record title in 20px Fraunces, an optional one-line status strip, header actions (QR, open full record) and a named close slot with a 44px target. The header is never maroon.
- **Sizes:** `sm` 480px for details, `md` 640px for forms, `lg` 880px for multi-section records (Catalog, Users). Below 768px every drawer is full width.
- **Body:** one 18px inset (14px on mobile), scrolls independently. Forms inside add no second padding layer. `lg` drawers get a sticky section index built once in the shared component.
- **Shared inner pieces:** section heading, field grid, read-only field, status strip, danger zone. Pages compose these rather than adding drawer-specific CSS.
- **Danger zone** sits at the end of the body, separated by a rule, with its blockers listed.
- **Confirmations** happen inline in the footer (the footer swaps to the confirm message and buttons). QR codes, receipts and previews are steps inside the drawer.
- **Dismissal:** Escape, backdrop and close share one handler; Edit and New prompt before discarding changes. Focus returns to the opener, or to a visible list control if the opener is gone.
- **URL:** the open record is in the URL (`?record=<id>`, plus `&mode=edit` when editing) so Refresh, Back and shared links reopen it.
- Filters never use a drawer; they use an inline bar or popover (phones may use a bottom sheet).

### Dialogs

Only for destructive or irreversible actions that cannot be confirmed inline (restore a backup, permanent delete, bulk archive), and for tool search. Centered, paper, 2px corners, title + consequence first, destructive action on the right in coral. Never stacked on another dialog.

### Feedback and states

- Loading: layout-matched skeletons on first load; figures stay visible during refresh.
- Refresh failure: keep the last data with a labelled "Showing the last available data" notice and Retry.
- First-load failure: "Unavailable" with Retry, never zeros.
- Empty: one sentence and, where useful, one next action.
- Success: a toast for actions that leave the current view unchanged; inline confirmation otherwise.

## Accessibility

- Visible focus on every control; skip link to main content.
- Semantic headings, lists, tables, `details` and live regions for refresh and scan results.
- Icon-only controls labelled; full names available for truncated text.
- 44px targets below 768px. Reduced motion respected on portals as well as page content.
- Both themes meet 4.5:1 for text and 3:1 for control borders and focus rings.

## CSS rules

- Tokens live in one admin token file; components read tokens, never raw hex values.
- No doubled selectors (`[x][x]`, `.a.a`) and no `!important` to win specificity. If a rule needs one, the layering is wrong.
- Page CSS files hold layout only (grids, column tracks). Color, type, borders and states come from shared components.
- No positional selectors for meaningful elements (`>button:last-child`); use named slots or data attributes.
- New JSX keeps one element or prop group per line; avoid single-line components wider than ~120 characters.

## Migration

| Phase | Work |
|---|---|
| 0 | This document and WORKFLOWS.md. |
| 1 | One admin token file; delete the doubled-selector overrides, the `!important`s and `refined-drawers.css`; one tab style. |
| 2 | New navigation and routes with redirects; distinct icons; Email deliveries as a Notifications tab. |
| 3 | Shell: slim top bar, account controls in the sidebar footer. |
| 3.5 | Drawers: View/Edit/New variants, three sizes, shared inner pieces, inline confirmations, URL state, named close slot. |
| 4 | The five page layouts as shared components. |
| 5 | Role-specific dashboard. |
| 6 | Page passes: Circulation, Reservations, Clearance, Users, Catalog, then the rest. |

Phase 1 touches every page at once and ships as one change.

## Verification

For every phase: existing tests and the build pass, and each touched page is checked in light and dark at 1366×768, tablet (768px) and 390px, including long names, long titles and large peso amounts. At 1366×768 the Dashboard's desk actions, outstanding items and today's totals are visible without scrolling. Role-filtered navigation is checked as staff, admin and super admin.
