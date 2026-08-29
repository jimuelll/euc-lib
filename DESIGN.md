# EUC Library Admin --- Design System & Redesign Specification

> **Scope:** Entire admin-facing application\
> **Visual reference:** Option A (Classic Institutional Dark) + Option B
> (Modern Warm Institutional)\
> **Direction:** One unified design system with first-class light and
> dark themes\
> **Priority:** Full frontend/UX redesign. Preserve all backend
> behavior.

------------------------------------------------------------------------

## 1. Objective

Redesign the **entire EUC Library admin-facing experience**, not only
the pages shown in screenshots.

Treat the existing admin interface primarily as a **functional
inventory**, not as a visual constraint. Existing layouts, spacing, card
structures, navigation presentation, page hierarchy, and styling may be
substantially redesigned where doing so improves usability.

The finished admin should feel like:

-   a modern professional library operations platform;
-   clearly part of EUC / Enverga-Candelaria;
-   efficient enough for staff to use for long sessions;
-   contemporary rather than like a legacy university portal;
-   institutional without becoming ornamental or old-fashioned;
-   information-dense where appropriate, but calm and easy to scan.

Target balance:

**\~70% modern professional software / \~30% institutional identity.**

The redesign should be visually much more ambitious than a reskin. It is
acceptable for the finished frontend to be barely recognizable compared
with the current admin UI, provided existing functionality remains
intact.

------------------------------------------------------------------------

# 2. Non-Negotiable Backend Protection

## DO NOT change the backend.

This redesign is a frontend/UI/UX task.

Do not unnecessarily modify:

-   backend routes;
-   controllers;
-   services;
-   middleware;
-   database schema;
-   SQL;
-   API contracts;
-   request/response payloads;
-   authentication;
-   authorization;
-   JWT behavior;
-   cookies;
-   role hierarchy;
-   permission checks;
-   business rules;
-   validation rules;
-   borrowing rules;
-   reservation rules;
-   overdue calculations;
-   fine calculations;
-   attendance behavior;
-   QR/barcode behavior;
-   notification/WebSocket behavior;
-   backup behavior;
-   file/image storage behavior;
-   existing functional integrations.

Existing API calls may be reorganized into cleaner frontend
hooks/services if necessary, but their external behavior and contracts
must remain compatible.

Do not remove functionality because it is difficult to fit into the
redesign.

Before changing an existing interaction, understand what it currently
does.

**Frontend architecture may change. Backend behavior may not.**

------------------------------------------------------------------------

# 3. Core Visual Direction

The primary visual references are:

### Light Theme --- Option B: Modern Warm Institutional

Use a warm, refined, mostly neutral light interface with:

-   warm white/off-white application background;
-   white or subtly warm elevated surfaces;
-   deep EUC maroon as the primary brand/action color;
-   restrained gold highlights;
-   dark neutral typography;
-   subtle borders;
-   very restrained shadows;
-   strong whitespace and alignment;
-   compact professional controls.

It should feel warm and institutional without looking beige, vintage, or
decorative.

### Dark Theme --- Option A: Classic Institutional Dark

Use:

-   deep charcoal / near-black structural surfaces;
-   subtle warm-maroon undertones;
-   deep maroon for branded/selected surfaces;
-   gold for small highlights and identity;
-   high-contrast warm-white text;
-   clearly separated surface levels;
-   restrained borders rather than excessive glowing effects.

Do **not** simply invert the light theme.

Dark mode must be intentionally designed as a first-class theme.

------------------------------------------------------------------------

# 4. Brand Strategy

The current admin lacks enough deliberate school identity, but the
solution is **not** to make every surface maroon and gold.

Branding should come from controlled repetition of a few recognizable
elements:

-   EUC Library mark/logo;
-   maroon primary color;
-   gold accent;
-   typography;
-   active navigation treatment;
-   key focus/selection states;
-   occasional fine rules or micro-details;
-   branded empty states / authentication-adjacent surfaces where
    appropriate.

The workspace itself should remain neutral enough that information has
room to breathe.

## Color Roles

Use semantic design tokens instead of hardcoding colors throughout
individual pages.

Suggested starting point; tune exact values for contrast and visual
quality during implementation.

### Brand

``` css
--brand-maroon: #7a0e1a;
--brand-maroon-hover: #681018;
--brand-maroon-active: #560b14;
--brand-maroon-soft: rgba(122, 14, 26, 0.08);

--brand-gold: #c99a20;
--brand-gold-strong: #b8860b;
--brand-gold-soft: rgba(201, 154, 32, 0.12);
```

Gold is **not** the primary button color.

Gold should mostly appear in:

-   small icons;
-   brand marks;
-   fine accent rules;
-   selected micro-elements;
-   special highlights;
-   chart accents where semantically appropriate.

Maroon should carry primary actions and the strongest brand states.

## Light Theme

Use warm-neutral values approximately in this family:

``` css
--background: #f7f6f3;
--surface-1: #ffffff;
--surface-2: #f3f1ed;
--surface-3: #ece9e4;

--foreground: #191817;
--foreground-secondary: #625e58;
--foreground-muted: #8a857e;

--border: #e3dfd8;
--border-strong: #d4cec5;
```

## Dark Theme

Avoid the existing muddy brown-on-brown appearance.

Prefer neutral charcoal with subtle warmth:

``` css
--background: #141312;
--surface-1: #1b1918;
--surface-2: #23201f;
--surface-3: #2b2725;

--foreground: #f4f1ec;
--foreground-secondary: #bbb3aa;
--foreground-muted: #8f8881;

--border: #35302d;
--border-strong: #49413d;
```

Maroon can become somewhat richer/deeper in dark mode, while gold may
become slightly brighter for legibility.

## Semantic Colors

Define reusable semantic tokens for:

-   success;
-   warning;
-   danger;
-   info;
-   overdue;
-   pending;
-   approved;
-   ready;
-   returned;
-   archived;
-   disabled.

Do not use maroon for every negative state merely because it is the
brand color.

------------------------------------------------------------------------

# 5. Visual Personality

Use this combination:

**Contemporary + Authoritative + Academic + Calm + Data-Oriented**

Avoid:

-   luxury-hotel styling;
-   excessive gradients;
-   glassmorphism;
-   neon effects;
-   giant typography;
-   excessive uppercase;
-   overly decorative gold;
-   huge hero panels inside admin pages;
-   generic template-dashboard aesthetics;
-   excessive rounded cards;
-   excessive shadows;
-   cartoonish illustrations;
-   overuse of icons;
-   brown/maroon surfaces everywhere.

This is an operations system first.

------------------------------------------------------------------------

# 6. Theme Strategy

Light and dark themes are equally supported.

Neither theme should feel secondary.

Requirements:

-   every shared component must support both;
-   charts must remain readable in both;
-   table hover/selected states must work in both;
-   borders must remain visible without becoming heavy;
-   semantic status colors must pass contrast requirements;
-   dialogs, popovers, dropdowns, tooltips and toasts must use theme
    tokens;
-   no isolated hard-coded light/dark colors inside pages unless truly
    necessary.

Theme switching should not change layout.

------------------------------------------------------------------------

# 7. Design-System Architecture

Build or refactor toward a reusable admin design system rather than
styling pages independently.

Prefer:

1.  global semantic tokens;
2.  shared primitives;
3.  shared admin components;
4.  small page-specific composition styles only when necessary.

Use the project's existing styling stack appropriately. Centralize
tokens in global CSS / theme configuration.

Avoid:

-   enormous page-specific stylesheets;
-   repeated arbitrary Tailwind values;
-   duplicated button/table/card implementations;
-   inline style proliferation;
-   one-off colors;
-   repeated responsive logic.

The result should remain maintainable and scalable as additional modules
are added.

------------------------------------------------------------------------

# 8. Typography

Use a clean contemporary sans-serif system.

The exact existing font stack may be retained if it works well, but
typography must be standardized.

Recommended character:

-   headings: confident, compact, contemporary;
-   body: highly readable;
-   labels: restrained;
-   data: strong numeric hierarchy.

Avoid extreme letter spacing.

Do not make every navigation label uppercase.

Suggested hierarchy:

``` text
Page title       26–32px / 600–700
Section title    18–22px / 600
Card title       14–16px / 600
Body             14–15px / 400
Secondary        13–14px / 400
Label            11–12px / 500–600
Table text       13–14px
Metric           24–32px / 600–700
```

Use tabular numerals for operational metrics where supported.

------------------------------------------------------------------------

# 9. Spacing & Density

The current admin wastes substantial vertical space.

Redesign toward **moderately compact**, becoming **dense on
operational/data-heavy screens**.

Use a consistent spacing scale, for example:

``` text
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48
```

Typical page content should not require oversized top padding.

Operational pages should expose considerably more useful information
above the fold than the current UI.

Do not sacrifice touch targets or accessibility for density.

------------------------------------------------------------------------

# 10. Radius, Borders & Elevation

Prefer modest radii:

``` text
small: 4–6px
default: 8px
large: 10–12px
```

Avoid pill-shaped containers unless the element is actually a
pill/chip/status.

Cards should generally use:

-   subtle border;
-   low or zero shadow;
-   clear surface hierarchy.

Do not place gold top borders on every card.

Elevation should communicate layering, not decoration.

------------------------------------------------------------------------

# 11. Application Shell

## Sidebar

Redesign the sidebar completely.

Desktop behavior:

-   expanded by default;
-   user can collapse it to a narrow icon rail;
-   collapse preference may persist locally if practical;
-   smooth but restrained transition;
-   tooltips appear for icons while collapsed.

The expanded sidebar should be compact enough that the full navigation
fits on common laptop/desktop heights whenever reasonably possible.

The current large visible native scrollbar is unacceptable.

Do not rely on an ugly always-visible browser scrollbar inside the
sidebar.

Prefer:

-   tighter spacing;
-   collapsible navigation groups where needed;
-   intelligently structured sections;
-   subtle/customized scrollbar only when content truly overflows;
-   sticky identity/header and logout/account area where useful.

Do not hide important functionality merely to avoid scrolling.

### Navigation groups

Use the actual application permissions/routes as the source of truth,
but organize conceptually around groups such as:

**Library Management** - Home / Overview - Catalog - Circulation -
Reservations

**Administration** - User Management - Holidays - Restrictions -
Clearance

**Content Management** - Bulletin Posts - About - Subscriptions -
Notifications

**Reports** - Analytics - Audit Logs - Reports - Attendance Logs

**System** - Payments - Backup

Only show routes the current user's role is authorized to access.

Do not change role permissions as part of the redesign.

### Active navigation

Expanded:

-   subtle maroon selected background;
-   clear left accent or equivalent strong selection cue;
-   readable selected label;
-   icon and label aligned.

Collapsed:

-   selected icon has a clear branded container/state;
-   tooltip communicates destination.

Gold can be used as a small secondary accent but should not compete with
maroon.

------------------------------------------------------------------------

# 12. Top Bar

Make the top bar compact and useful.

Potential contents:

-   sidebar collapse control;
-   contextual breadcrumb;
-   optional global/page context;
-   View Site;
-   notifications;
-   theme switcher;
-   user menu.

Avoid making breadcrumbs visually dominant.

The top bar should remain consistent across admin routes.

------------------------------------------------------------------------

# 13. Page Header Pattern

Remove the current giant hero-style admin headers.

Use compact page headers.

Typical structure:

``` text
Title                                      Primary action
Short contextual description               Secondary actions
```

Optional second row:

``` text
Tabs / date range / contextual controls
```

Descriptions should generally be one short sentence and may be omitted
when the page is self-explanatory.

Examples:

**Catalog**\
Manage titles, copies, categories, and availability.\
`[Import/Export] [Add Book]`

**User Management**\
Manage library accounts, roles, and access.\
`[Create User]`

Do not repeatedly place decorative section labels such as `SYSTEM`,
`REPORTS`, etc. above obvious page titles unless they genuinely help
orientation.

Breadcrumbs already provide context.

------------------------------------------------------------------------

# 14. Buttons

Standardize:

### Primary

Maroon filled.

Use for the single strongest action in a context.

### Secondary

Neutral outlined/subtle surface.

### Tertiary / Ghost

Minimal chrome.

### Destructive

Semantic danger styling, not automatically the same as brand maroon.

### Icon Button

Consistent square dimensions and tooltip where the icon may be
ambiguous.

Avoid multiple visually competing primary buttons in the same area.

Button labels should describe actions clearly:

-   `Add Book`
-   `Create User`
-   `Apply Filters`
-   `Settle Payment`
-   `Generate Report`

rather than vague labels when a more specific action exists.

------------------------------------------------------------------------

# 15. Forms

Forms must be redesigned for operational speed.

Use:

-   persistent labels;
-   clear required indicators;
-   helpful validation;
-   logical grouping;
-   sensible widths;
-   consistent control heights;
-   accessible error messages;
-   clear save/cancel hierarchy.

Avoid giant full-width fields when the value is inherently short.

## Mixed interaction model

Do **not** force every create/edit operation into the same presentation.

### Drawer / Modal

Use for relatively short, focused operations where retaining page
context helps.

Examples may include:

-   quick status changes;
-   small metadata edits;
-   confirmations;
-   simple category management;
-   small configuration changes.

### Dedicated Page

Use for complex tasks involving:

-   many fields;
-   multiple sections;
-   rich content;
-   previews;
-   workflows;
-   significant validation;
-   scanning/operational context.

Examples may include:

-   complex book creation/editing;
-   About page editor;
-   circulation workstation;
-   substantial user/account workflows when needed.

Use judgment based on complexity.

------------------------------------------------------------------------

# 16. Tables

Tables are core UI, not decorative cards.

Create a robust reusable table system with:

-   consistent headers;
-   compact row density;
-   sorting where currently supported;
-   filters;
-   search;
-   pagination;
-   selected/hover states;
-   empty states;
-   loading states;
-   error states;
-   responsive behavior;
-   row actions;
-   status badges;
-   accessible focus behavior.

Avoid enclosing every table in multiple nested cards.

Use sticky headers where useful for long data sets.

On desktop, prioritize seeing meaningful columns without unnecessary
wrapping.

For row actions:

-   expose the most common action directly when appropriate;
-   use a compact overflow menu for secondary actions;
-   destructive actions require appropriate confirmation.

Do not hide essential information behind hover-only behavior.

------------------------------------------------------------------------

# 17. Filters

The current filter panels are too tall.

Prefer compact filter toolbars.

Example:

``` text
[Search........................] [Status ▾] [Role ▾] [Date range] [More Filters] [Reset]
```

On narrow screens, filters may collapse into a drawer/sheet.

Applied filters should be understandable at a glance.

Do not require `Apply` when instant filtering is already safe and
supported by existing frontend behavior; however, do not change
backend/API behavior merely to achieve this. If queries are
intentionally submitted, retain a clear `Apply Filters` action.

------------------------------------------------------------------------

# 18. Status Badges

Create one consistent badge system.

Examples:

-   Active
-   Inactive
-   Borrowed
-   Returned
-   Overdue
-   Pending
-   Approved
-   Ready
-   Fulfilled
-   Cancelled
-   Paid
-   Unsettled
-   Archived

Badges should use:

-   color;
-   text;
-   optional small icon only when useful.

Never rely on color alone.

------------------------------------------------------------------------

# 19. Empty, Loading & Error States

Every significant module must have intentional states.

## Empty

Explain:

1.  what is empty;
2.  whether that is good/neutral/problematic;
3.  what action is available.

Example:

**No overdue borrowings**\
Everything currently on loan is within its due period.

Do not create enormous empty-state illustrations.

## Loading

Use skeletons matching the final layout where practical.

Avoid full-page spinners for local data updates.

## Errors

Errors must be:

-   specific;
-   actionable when possible;
-   visually distinct;
-   non-destructive to existing page context.

------------------------------------------------------------------------

# 20. Notifications & Feedback

Use consistent:

-   toast behavior;
-   confirmation dialogs;
-   inline errors;
-   success feedback;
-   destructive confirmations.

Do not use browser `alert()` for normal application feedback.

Preserve existing notification/WebSocket functionality.

------------------------------------------------------------------------

# 21. Dashboard / Home

Redesign the admin home into a genuine operational overview.

The goal is:

> **What needs attention, what happened today, and where should staff go
> next?**

Suggested hierarchy:

### Row 1 --- Essential metrics

Examples based on existing data:

-   Borrowings Today
-   Returns Today
-   Reservations Today / Ready for Pickup
-   Overdue Borrowings
-   Attendance Today
-   Unsettled Payments

Do not show metrics merely because they exist. Prioritize operational
value.

### Row 2 --- Attention / Quick Actions

Potential quick actions:

-   Scan Borrow
-   Scan Return
-   Reservation Queue
-   Add User
-   Add Book

Attention panel can surface:

-   overdue items;
-   reservations nearing expiry;
-   damaged/lost copies;
-   unsettled balances;
-   other actionable existing conditions.

Only use data already supported by the system.

### Row 3 --- Operational trend / recent activity

Use one or two high-value charts and a concise activity feed.

Do not turn Home into a duplicate of Analytics.

------------------------------------------------------------------------

# 22. Analytics

The current Analytics page is too long and gives too many sections equal
visual weight.

Rebuild it around decision hierarchy.

Suggested structure:

### Compact header

`Analytics`

Optional date range / refresh controls.

### Operational KPIs

Small set of high-value metrics.

### Actionable health

Highlight conditions requiring attention.

### Primary analytics

Use the most important charts at larger size:

-   circulation trend;
-   reservation activity;
-   attendance activity.

### Secondary analytics

Examples:

-   most borrowed titles;
-   collection health;
-   role distribution;
-   site traffic;
-   fine collections.

Use tabs, grouped sections, responsive grid composition, or progressive
disclosure where appropriate instead of a giant uninterrupted vertical
stack.

Charts should:

-   have readable axes;
-   have accessible legends;
-   use semantic colors;
-   work in light and dark themes;
-   handle all-zero datasets gracefully;
-   not use unnecessary gradients;
-   not rely solely on color to differentiate critical series where
    practical.

Do not invent new backend analytics just to fill space.

------------------------------------------------------------------------

# 23. Catalog

Make Catalog feel like a professional inventory workspace.

Prioritize:

-   search;
-   filters;
-   availability;
-   title/copy distinction;
-   category;
-   status;
-   common actions.

Suggested header:

``` text
Catalog                                  [Import/Export] [Add Book]
Manage titles, copies and availability.
```

Use a dense table/list as the primary view.

Where supported, surface:

-   title;
-   author;
-   ISBN;
-   category;
-   total copies;
-   available copies;
-   status;
-   actions.

Do not overload rows with buttons.

Book detail/edit views should clearly separate:

-   bibliographic information;
-   copies;
-   availability;
-   image;
-   metadata;
-   history where already available.

Preserve dynamic/form-builder behavior.

------------------------------------------------------------------------

# 24. Circulation

Treat Circulation as a **workstation**, not a generic form page.

This is one of the most operationally important screens.

The interface should make scanning extremely obvious.

Suggested structure:

``` text
Circulation
Process borrowing and returns.

[ Borrow ] [ Return ]

Borrow workflow:
1. Identify borrower
2. Scan/select copy
3. Review transaction
4. Confirm
```

Provide strong scan-ready input focus and visible borrower/book
confirmation.

Borrower context can show:

-   name;
-   ID;
-   role;
-   current borrowing count;
-   relevant restrictions;
-   relevant active loans if already supported.

Copy context can show:

-   title;
-   copy barcode;
-   availability/status;
-   relevant condition.

Do not modify scanner/backend logic.

Success should clearly confirm the completed transaction and prepare the
workstation for the next scan.

Return should be equally optimized.

------------------------------------------------------------------------

# 25. Reservations

Redesign Reservations as a queue/workflow.

Prioritize status and required action.

Potential views/tabs:

-   Pending
-   Approved
-   Ready
-   Fulfilled
-   Cancelled
-   All

Use the statuses actually supported by the application.

Rows/cards should make it easy to identify:

-   patron;
-   requested title;
-   request time/date;
-   status;
-   expiry/hold deadline;
-   available actions.

Do not turn every reservation into a large card if a table/queue is more
efficient.

------------------------------------------------------------------------

# 26. User Management

Use a **directory-first** model.

Creating users should be an action, not the default visual mode of the
page.

Suggested:

``` text
User Management                              [Create User]
Manage library accounts, roles and access.

[Search........................] [Role ▾] [Status ▾]

Users table
```

Support existing role hierarchy exactly.

Useful columns may include:

-   Name
-   Student/Employee ID
-   Role
-   Status
-   relevant account state
-   Actions

Create/edit flows should use the mixed form strategy.

Archiving/restoring, activation state and role operations must preserve
existing rules.

Destructive or access-changing operations require clear confirmation.

------------------------------------------------------------------------

# 27. Holidays

Prefer a compact management experience.

A calendar-oriented view can be used if it genuinely improves the
existing functionality, with an accompanying list/table for precise
management.

Show:

-   date;
-   holiday name;
-   active state;
-   actions.

Do not add scheduling/business logic that does not exist.

------------------------------------------------------------------------

# 28. Restrictions

Redesign as an operational management screen rather than a generic card
collection.

Prioritize:

-   affected user;
-   restriction reason/type;
-   status;
-   relevant date;
-   actions.

Preserve existing rules and data model.

------------------------------------------------------------------------

# 29. Clearance

Design for fast verification.

Make the user's clearance state and blockers immediately understandable.

Where existing data supports it, clearly separate blockers such as:

-   active loans;
-   overdue items;
-   unsettled payments;
-   other existing restrictions.

Do not invent new clearance rules.

------------------------------------------------------------------------

# 30. Bulletin Posts

Treat this as a lightweight content-management interface.

Primary view:

-   post list/table;
-   status;
-   author;
-   date;
-   engagement summary where already available;
-   actions.

Creation/editing may use a dedicated editor when content complexity
warrants it.

Preview should resemble the public-facing result where practical.

Preserve image upload behavior.

------------------------------------------------------------------------

# 31. About Page Editor

Treat this as content editing, not a generic admin form.

Use:

-   clearly grouped content sections;
-   editable fields;
-   image controls where supported;
-   preview where feasible;
-   save state/feedback.

Do not change the public page's data contract without necessity.

------------------------------------------------------------------------

# 32. Subscriptions

Use a clean management table/grid depending on existing content
structure.

Support:

-   title;
-   description;
-   URL;
-   image;
-   active state;
-   edit/archive actions.

Use a drawer or dedicated editor depending on field complexity.

------------------------------------------------------------------------

# 33. Notifications

Separate management/administrative notification functionality from the
top-bar personal notification affordance.

Design according to existing capabilities.

Use clear read/unread state, timestamps and type indicators where
relevant.

Do not change WebSocket behavior.

------------------------------------------------------------------------

# 34. Audit Logs

Audit Logs should feel like a serious system trail.

Prioritize density and scanability.

Suggested structure:

``` text
Audit Logs
Track important changes and system activity.

[Search] [Category] [Action] [Date range] [Apply]
```

Then a dense table/feed with:

-   timestamp;
-   category;
-   action;
-   actor;
-   target/details;
-   relevant metadata.

Avoid large card-per-event layouts unless an event needs expanded
detail.

Use expandable rows/detail panels for verbose metadata if needed.

Audit information should visually emphasize **who did what and when**.

------------------------------------------------------------------------

# 35. Reports

Reports should be distinct from Analytics.

**Analytics = visual operational insight.**\
**Reports = historical records, filtering, review and
export/report-oriented workflows.**

Use compact tabs where needed for:

-   Circulation
-   Reservations
-   other existing report categories

Prioritize:

-   date range;
-   status;
-   search/filtering;
-   summary counts;
-   result table;
-   export/print actions only if currently supported.

Do not invent exports that the backend cannot produce.

------------------------------------------------------------------------

# 36. Attendance Logs

Make Attendance Logs much denser.

Current large metric blocks and filter sections consume too much space.

Suggested:

``` text
Attendance Logs                        [Refresh]
Review today's attendance or history.

[ Today | History ]

Time In     Time Out     Inside Now

[All | Time In | Time Out] [Search........................]

Attendance table
```

History mode may expose date filters.

Table should prioritize:

-   name / ID;
-   role;
-   type;
-   timestamp.

Preserve existing attendance semantics.

------------------------------------------------------------------------

# 37. Payments

Rename or restructure labels where it improves clarity, but preserve all
behavior.

The page should make three things immediately clear:

1.  current fine configuration;
2.  outstanding/unsettled exposure;
3.  how staff settle a payment.

Avoid excessive explanatory copy.

Suggested top summary:

-   Fine Rate
-   Borrowers With Balance
-   Total Outstanding

Fine configuration is a setting, not a hero feature.

The settlement workflow should prioritize finding the patron/borrowing,
verifying the balance and confirming settlement.

Use confirmation for irreversible payment actions.

Do not modify fine calculations.

------------------------------------------------------------------------

# 38. Backup

Treat Backup as a system utility.

Clearly separate:

-   create/download backup;
-   restore behavior if currently supported;
-   history/status where currently available;
-   warnings.

Backup/restore actions deserve strong confirmation and clear risk
messaging.

Do not modify SQL backup mechanics.

------------------------------------------------------------------------

# 39. Role-Aware UI

The admin shell must continue to respect all existing roles and
permissions.

Do not solve permission differences only with CSS visibility.

Existing authorization remains authoritative.

Navigation should adapt to the current role while retaining the same
design language.

If an action is unavailable due to permissions, follow existing behavior
and avoid implying that the user can perform it.

------------------------------------------------------------------------

# 40. Responsive Behavior

This is primarily a desktop operations system, so desktop usability
comes first without neglecting smaller screens.

Suggested breakpoints should follow the project's existing conventions.

### Large desktop

-   expanded sidebar by default;
-   multi-column dashboards;
-   dense tables;
-   comfortable content width.

### Laptop

-   maintain full operational functionality;
-   slightly tighter gaps;
-   avoid horizontal overflow;
-   sidebar can be collapsed manually.

### Tablet

-   sidebar becomes overlay/drawer or compact rail as appropriate;
-   dashboard grids reduce columns;
-   filter toolbars wrap intelligently.

### Mobile

Admin functionality should remain usable where practical.

-   sidebar becomes drawer;
-   tables may use horizontal scrolling or purpose-designed compact
    representations;
-   primary actions remain reachable;
-   dialogs fit viewport;
-   no clipped controls.

Do not convert every table to cards automatically. Horizontal scrolling
is acceptable for genuinely tabular operational data when implemented
well.

------------------------------------------------------------------------

# 41. Accessibility

Target WCAG AA-level usability.

Requirements:

-   sufficient contrast;
-   keyboard-accessible controls;
-   visible focus states;
-   semantic HTML;
-   proper form labels;
-   accessible dialog focus management;
-   tooltips not required to understand essential information;
-   icon buttons have accessible names;
-   status never communicated by color alone;
-   charts have accompanying labels/legends and meaningful accessible
    context;
-   reduced-motion preferences respected;
-   minimum reasonable target sizes.

Focus rings may use maroon/gold-compatible tokens but must remain
clearly visible in both themes.

------------------------------------------------------------------------

# 42. Motion

Use motion sparingly.

Good uses:

-   sidebar collapse;
-   drawer/dialog transitions;
-   small hover/focus transitions;
-   tab/content transitions when subtle;
-   toast entry/exit.

Avoid:

-   animated dashboard numbers on every load;
-   excessive card movement;
-   decorative parallax;
-   long transitions;
-   bouncing icons.

Typical transitions should feel fast: roughly 120--220ms.

Respect `prefers-reduced-motion`.

------------------------------------------------------------------------

# 43. Charts

Create a shared chart styling layer.

Requirements:

-   same typography as application;
-   subtle grid lines;
-   no excessive borders;
-   theme-aware tooltips;
-   semantic series colors;
-   accessible legend;
-   graceful zero-state;
-   responsive container;
-   consistent date formatting.

Brand maroon and gold may anchor chart palettes, but additional series
need distinguishable semantic colors.

Do not make every chart maroon vs gold if that harms comprehension.

------------------------------------------------------------------------

# 44. Iconography

Use one icon family consistently, preferably the project's existing icon
library.

Rules:

-   consistent stroke width;
-   common sizes;
-   icons support labels rather than replace them unnecessarily;
-   avoid decorative icon boxes everywhere;
-   use icon-only actions only when conventional or supported by
    tooltip/accessibility label.

Gold icons should be reserved for intentional branded emphasis, not
every card.

------------------------------------------------------------------------

# 45. Content & Microcopy

Reduce unnecessary instructional text.

Use **helpful, concise contextual copy**.

Bad:

> This section keeps broader health indicators separate from today's
> operational queue.

Better:

> Collection and account health at a glance.

Or omit the sentence entirely if the heading is enough.

Prefer:

-   clear nouns;
-   clear verbs;
-   concise status descriptions;
-   specific confirmation messages.

Do not remove guidance where a workflow is genuinely complex.

------------------------------------------------------------------------

# 46. Scroll Behavior

The current sidebar scrollbar is a specific visual problem.

Fix it as part of the redesign.

General rules:

-   page should normally own vertical scrolling;
-   avoid unnecessary nested scroll regions;
-   sticky elements must not trap content;
-   sidebar overflow should be visually subtle;
-   custom scrollbar styling, if used, must remain usable;
-   avoid always-visible bright OS-style scrollbars inside branded
    panels where CSS/browser support permits refinement.

Do not hide scrollbars in a way that makes scrolling undiscoverable or
inaccessible.

------------------------------------------------------------------------

# 47. Component Inventory

Create/refactor reusable components approximately along these
responsibilities where appropriate:

``` text
AdminShell
AdminSidebar
AdminTopbar
AdminBreadcrumbs
PageHeader

Button
IconButton
Badge
Avatar
Tooltip
DropdownMenu
Tabs

Card
MetricCard
AlertCard
EmptyState
Skeleton
Callout

Input
SearchInput
Select
DatePicker
DateRangePicker
Checkbox
Radio
Textarea
FormField

DataTable
TableToolbar
FilterBar
Pagination
RowActions

Dialog
AlertDialog
Drawer / Sheet
Popover

StatGroup
ChartCard
ChartLegend

UserSummary
BookSummary
BorrowingSummary
ReservationSummary

Toast / Notification feedback
```

Do not create abstraction merely for abstraction's sake. Shared
components should correspond to genuinely repeated UI patterns.

------------------------------------------------------------------------

# 48. Global CSS / Token Requirements

Centralize design primitives.

At minimum establish reusable variables for:

``` css
/* brand */
--brand-maroon
--brand-gold

/* backgrounds/surfaces */
--background
--surface-1
--surface-2
--surface-3

/* text */
--foreground
--foreground-secondary
--foreground-muted

/* borders */
--border
--border-strong

/* semantic */
--success
--warning
--danger
--info

/* interaction */
--focus-ring
--hover
--selected

/* geometry */
--radius-sm
--radius-md
--radius-lg

/* shell */
--sidebar-width
--sidebar-collapsed-width
--topbar-height
```

If the project already has semantic shadcn/Tailwind variables,
extend/refactor those rather than creating a conflicting second token
system.

Pages should consume semantic tokens rather than literal hex colors.

------------------------------------------------------------------------

# 49. Maintainability Rules

The redesign must not produce a CSS/code maintenance problem.

Requirements:

-   reuse existing sound primitives where possible;
-   refactor weak shared components rather than cloning them;
-   use global tokens;
-   keep page components focused on composition/business UI;
-   extract repeated admin patterns;
-   avoid giant monolithic components;
-   avoid deeply nested conditional JSX where practical;
-   keep role logic explicit and understandable;
-   preserve TypeScript typing on the frontend;
-   do not weaken types to accelerate redesign;
-   no unnecessary dependencies;
-   do not duplicate API fetching logic solely because screens were
    redesigned.

If a component is shared by public/student and admin interfaces, avoid
breaking the other interface. Split variants or create admin-specific
composition when necessary.

------------------------------------------------------------------------

# 50. Functional Preservation Checklist

Before considering any redesigned module complete, verify:

-   all existing buttons/actions still exist;
-   forms still submit the same required data;
-   validation still works;
-   role restrictions still work;
-   loading states work;
-   errors remain visible;
-   empty datasets work;
-   search works;
-   filters work;
-   pagination works where present;
-   scanner flows work;
-   QR/barcode flows work;
-   upload flows work;
-   notifications work;
-   theme switching works;
-   responsive layout does not hide actions;
-   keyboard operation is possible;
-   no backend endpoint was changed merely for UI convenience.

------------------------------------------------------------------------

# 51. Implementation Strategy

Do **not** redesign every page independently from scratch.

Recommended sequence:

## Phase 1 --- Audit

Inspect:

-   all admin routes;
-   all admin components;
-   role guards;
-   current API usage;
-   shared UI primitives;
-   global CSS;
-   theme implementation;
-   responsive behavior.

Build a route/module inventory before deleting or replacing UI.

## Phase 2 --- Foundation

Implement/refactor:

-   theme tokens;
-   typography;
-   spacing;
-   surfaces;
-   buttons;
-   inputs;
-   badges;
-   tables;
-   dialogs/drawers;
-   page header;
-   sidebar;
-   top bar;
-   responsive shell.

## Phase 3 --- High-Impact Workflows

Redesign first:

1.  Admin Home
2.  Circulation
3.  Catalog
4.  Reservations
5.  User Management

These establish most repeated patterns.

## Phase 4 --- Reporting

Redesign:

-   Analytics
-   Reports
-   Audit Logs
-   Attendance Logs

## Phase 5 --- Administrative/System

Redesign:

-   Payments
-   Restrictions
-   Clearance
-   Holidays
-   Backup

## Phase 6 --- Content Management

Redesign:

-   Bulletin Posts
-   About editor
-   Subscriptions
-   Notifications

## Phase 7 --- Consistency Pass

Check:

-   spacing;
-   typography;
-   buttons;
-   table density;
-   status colors;
-   dark mode;
-   light mode;
-   responsive behavior;
-   empty/loading/error states;
-   focus states;
-   permissions;
-   overflow.

------------------------------------------------------------------------

# 52. Definition of Done

The redesign is complete only when:

1.  **Every admin-facing route** uses the new visual system.
2.  Light and dark themes both look intentionally designed.
3.  The sidebar is compact, collapsible and no longer visually dominated
    by an ugly scrollbar.
4.  Admin pages display substantially more useful information above the
    fold.
5.  Operational screens prioritize actions over decorative presentation.
6.  EUC identity is clearly visible without overwhelming the workspace.
7.  Tables, forms, filters, dialogs, badges and states are consistent.
8.  Responsive behavior is coherent.
9.  The codebase uses shared tokens/components rather than duplicated
    page styling.
10. Existing functionality and backend behavior remain intact.
11. No role loses functionality it previously had.
12. No page remains visually stranded in the old admin design.
13. Accessibility and keyboard interaction are preserved or improved.
14. The finished product feels like a **new professional EUC Library
    administration system**, not a lightly modified version of the old
    dashboard.

------------------------------------------------------------------------

# 53. Final Design Principle

When making a design decision, prioritize in this order:

**Function → Clarity → Consistency → Institutional Identity →
Decoration**

The admin interface exists to help librarians and staff complete real
operational work quickly and confidently.

The redesign should therefore feel:

> **Modern in structure. Institutional in identity. Efficient in
> operation.**

Use **Option B's warm, restrained institutional light theme** and
**Option A's deep, refined institutional dark theme** as the visual
anchors, while redesigning the complete admin experience into one
coherent, scalable system.
