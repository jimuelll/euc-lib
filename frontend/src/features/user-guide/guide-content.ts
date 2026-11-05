// Walkthroughs for each admin page. Kept in code so they change with the screens they describe.
// Screen maps are simplified wireframes: `areas` is a CSS grid-template-areas layout and each
// callout points at one region by id.

export type GuideRegionKind =
  | "sidebar" | "topbar" | "header" | "help" | "tabs" | "chips" | "tiles" | "search"
  | "list" | "panel" | "button" | "drawer" | "chart" | "pill";

export interface GuideRegion {
  id: string;
  kind: GuideRegionKind;
  label: string;
  items?: string[];
  tone?: "primary" | "attention" | "success" | "danger";
}

export interface GuideCallout {
  region: string;
  title: string;
  body: string;
}

export interface GuideScreen {
  title: string;
  caption: string;
  columns: string;
  areas: string[];
  regions: GuideRegion[];
  callouts: GuideCallout[];
}

export interface GuideTask {
  title: string;
  when?: string;
  steps: string[];
  result?: string;
}

export interface GuideTopicContent {
  purpose: string;
  screens: GuideScreen[];
  tasks: GuideTask[];
  terms?: { term: string; meaning: string }[];
  cautions?: string[];
  related?: string[];
}

const header = (title: string, items?: string[]): GuideRegion => ({ id: "head", kind: "header", label: title, items });

export const guideContent: Record<string, GuideTopicContent> = {
  "getting-started": {
    purpose: "Every admin page shares the same frame: a sidebar of tools on the left, a top bar with search and your account, and the page itself. Learn this frame once and every page works the same way.",
    screens: [{
      title: "The admin frame",
      caption: "What stays on screen no matter which tool you open.",
      columns: "10rem 1.4fr 1fr 4.5rem 4.5rem",
      areas: ["side search quick bell acct", "side head head head help", "side page page page page", "side page page page page"],
      regions: [
        { id: "side", kind: "sidebar", label: "EUC Library", items: ["Dashboard", "Desk", "Borrow & Return", "Reservations", "Clearance & Fines", "Records", "Users", "Catalog", "Help & user guide"] },
        { id: "search", kind: "search", label: "Find a tool   Ctrl K" },
        { id: "quick", kind: "pill", label: "Quick tasks" },
        { id: "bell", kind: "pill", label: "Bell" },
        { id: "acct", kind: "pill", label: "Account" },
        { id: "head", kind: "header", label: "Page title", items: ["Refresh"] },
        { id: "help", kind: "help", label: "i" },
        { id: "page", kind: "panel", label: "Page content", items: ["Tabs", "Filters and search", "List or form"] },
      ],
      callouts: [
        { region: "side", title: "Sidebar", body: "Tools grouped as Desk, Records, Publishing, Insights and Settings. You only see what your role can open. Groups other than Desk and Records fold away; select a heading to expand it." },
        { region: "search", title: "Find a tool", body: "Press Ctrl K from any page and type a tool name or a plain word: “fines”, “holds”, “scan”, “holidays”. Arrow keys pick a result, Enter opens it, Esc closes." },
        { region: "quick", title: "Quick tasks", body: "One click to Borrow a copy or Return a copy, from anywhere in the admin." },
        { region: "bell", title: "Notifications", body: "Alerts meant for staff. A dot means unread items. Mark all read clears the dot; Manage notifications opens the full page (administrators)." },
        { region: "acct", title: "Account menu", body: "Your name and role, View public website, Change password, light or dark theme, and Sign out." },
        { region: "help", title: "Page help", body: "The small i button next to every page title opens tips for that page and the tab you are on, with a link to its full section in this guide." },
      ],
    }],
    tasks: [
      { title: "Jump to a tool without the sidebar", steps: ["Press Ctrl K (or select Find a tool in the top bar).", "Type part of the tool name or a related word, for example “overdue” finds Clearance & Fines.", "Use the arrow keys to highlight a result and press Enter."], result: "The page opens. Tools your role cannot use never appear in the results." },
      { title: "Get help on the page you are looking at", steps: ["Find the round i button just right of the page title.", "Select it to read the key points for this page and the current tab.", "Choose Open full guide for the complete walkthrough with screen maps."] },
      { title: "Finish your shift on a shared computer", steps: ["Open the account menu in the top-right corner.", "Choose Sign out.", "Close the browser window if other people use the machine."], result: "Your session ends on this device. Unsaved drafts in open drawers are lost, so save first." },
    ],
    terms: [
      { term: "Staff", meaning: "Desk work: Borrow & Return, Reservations, Clearance & Fines, Users and Catalog." },
      { term: "Administrator", meaning: "Staff tools plus Attendance, Website Content, Notifications, Moderation, Analytics, Reports and the Academic Calendar." },
      { term: "Super administrator", meaning: "Everything, including Loan Policies, Catalog Fields, AI Recommendations, Backup & Restore, Email Deliveries and Audit Logs." },
      { term: "Unavailable", meaning: "A number could not be loaded. The admin never shows a missing figure as 0; use Refresh or Retry." },
    ],
    cautions: ["Most lists keep their filters, search and open record in the address bar. Copy the URL to share exactly what you see with a colleague.", "Drawers with unsaved edits ask before closing. Escape, the backdrop and the close button all trigger the same check."],
    related: ["dashboard", "borrow-return"],
  },

  dashboard: {
    purpose: "The Dashboard is the starting point for a shift. It answers three questions quickly: what needs action now, how busy today has been, and what just happened at the desk. Every number is a link to the records behind it.",
    screens: [{
      title: "Dashboard",
      caption: "Read top to bottom: act on the top row, then glance at today’s totals.",
      columns: "1fr 1fr 1fr 1fr",
      areas: ["head head head head", "desk desk out out", "totals totals totals totals", "recent recent recent links", "overview overview overview overview"],
      regions: [
        header("Dashboard", ["Refresh"]),
        { id: "desk", kind: "panel", label: "Desk actions", items: ["Borrow a copy", "Return a copy"], tone: "primary" },
        { id: "out", kind: "tiles", label: "Outstanding items", items: ["Overdue loans", "Unpaid fines", "Ready reservations"], tone: "attention" },
        { id: "totals", kind: "tiles", label: "Today’s totals", items: ["Borrowings", "Returns", "New reservations", "Attendance"] },
        { id: "recent", kind: "list", label: "Recent transactions", items: ["Patron", "Action", "Time"] },
        { id: "links", kind: "panel", label: "Quick links", items: ["Reports", "Catalog", "Users"] },
        { id: "overview", kind: "panel", label: "Library overview (administrators)", items: ["Catalog titles", "Available to borrow", "Damaged / lost copies"] },
      ],
      callouts: [
        { region: "head", title: "Refresh", body: "The Dashboard does not update by itself. The Updated time shows when figures were last loaded; select Refresh after a busy period." },
        { region: "desk", title: "Desk actions", body: "Borrow a copy and Return a copy open Borrow & Return already set to the right mode." },
        { region: "out", title: "Outstanding items", body: "Red or green numbers need someone. Overdue loans opens History filtered to overdue; Unpaid fines opens the Clearance queue; Ready reservations opens holds waiting for pickup." },
        { region: "totals", title: "Today’s totals", body: "Counts since midnight (Manila time). Borrowings and Returns open circulation History." },
        { region: "recent", title: "Recent transactions", body: "The latest loans and returns from every desk. View history shows the full list." },
        { region: "overview", title: "Library overview", body: "Administrators only: collection size, copies available, and damaged or lost copies that may need attention." },
      ],
    }],
    tasks: [
      { title: "Start a shift", steps: ["Open the Dashboard and check the Updated time under the title.", "Look at Outstanding items first. A non-zero Ready reservations means patrons may arrive for pickups.", "Select Overdue loans to see who to contact or expect.", "Use Borrow a copy or Return a copy when the first patron arrives."] },
    ],
    terms: [
      { term: "Ready reservations", meaning: "Books already set aside and waiting for the patron to collect them." },
      { term: "Unpaid fines", meaning: "Total outstanding balance across all patrons, using the same calculation as Clearance & Fines." },
    ],
    cautions: ["If a banner says “Showing the last available data”, the latest refresh failed. Figures are from the time shown, not now."],
    related: ["borrow-return", "reservations", "clearance"],
  },

  "borrow-return": {
    purpose: "Borrow & Return is the circulation desk. The Desk tab records loans and returns one at a time, with checks that stop a loan the library should not make. The History tab is the full record of every loan, with filters for what needs follow-up.",
    screens: [
      {
        title: "Desk tab: borrowing",
        caption: "Work left to right: patron, then copy, then confirm in the summary.",
        columns: "1.15fr 1fr 0.85fr",
        areas: ["head head head", "tabs tabs tabs", "mode mode summary", "patron copy summary", "patron copy confirm", "session session session"],
        regions: [
          header("Borrow & Return"),
          { id: "tabs", kind: "tabs", label: "Tabs", items: ["Desk", "History"] },
          { id: "mode", kind: "chips", label: "Desk transaction", items: ["Borrow", "Return"], tone: "primary" },
          { id: "patron", kind: "panel", label: "1  Patron", items: ["Scan an ID or search by name", "Active loans · unpaid fines", "Clearance status"] },
          { id: "copy", kind: "panel", label: "2  Copy", items: ["Scan or type an accession number", "Search the catalog", "Available / On loan / Reserved"] },
          { id: "summary", kind: "panel", label: "Transaction summary", items: ["Patron", "Copy", "Estimated due"] },
          { id: "confirm", kind: "button", label: "Confirm borrow", tone: "primary" },
          { id: "session", kind: "list", label: "Recently processed this session", items: ["Patron borrowed Title", "Undo"] },
        ],
        callouts: [
          { region: "mode", title: "Borrow or Return", body: "Choose the transaction first. The page focuses the right scan box for you, so a QR scanner can be used straight away." },
          { region: "patron", title: "Step 1: Patron", body: "Scan the library ID, use the camera button, or type a name and pick a suggestion. The card shows real active loans, unpaid balance and whether clearance allows borrowing." },
          { region: "copy", title: "Step 2: Copy", body: "Scan the accession number. Not sure which copy? Search the catalog, then View copies. Each copy shows if it is Available, On loan, Reserved, Reference only or missing an accession or policy." },
          { region: "summary", title: "Transaction summary", body: "Shows who, what and the estimated due date from the book’s loan policy. Blockers appear here in plain words, with Open clearance when the patron owes items or fines." },
          { region: "confirm", title: "Confirm borrow", body: "Disabled until everything is valid. The line underneath always says why, for example “Select a copy to continue” or “Resolve clearance before borrowing.”" },
          { region: "session", title: "Session list and Undo", body: "Every successful loan or return from this visit to the page. Ordinary loans and on-time returns show Undo for 60 seconds. The list clears when you leave or reload." },
        ],
      },
      {
        title: "History tab",
        caption: "The full loan record, opened on what needs action.",
        columns: "1fr 1fr 1fr",
        areas: ["head head head", "tabs tabs tabs", "tiles tiles tiles", "search search search", "list list list"],
        regions: [
          header("Borrow & Return", ["Refresh", "View archive", "Export"]),
          { id: "tabs", kind: "tabs", label: "Tabs", items: ["Desk", "History"] },
          { id: "tiles", kind: "tiles", label: "Summary", items: ["Overdue loans", "Active loans", "Today’s activity"], tone: "attention" },
          { id: "search", kind: "search", label: "Search patron, book, ID or ISBN" },
          { id: "list", kind: "list", label: "Circulation history", items: ["Patron", "Book", "Due", "Status", "Return"] },
        ],
        callouts: [
          { region: "head", title: "Archive and Export", body: "View archive shows returned loans that were archived. Export downloads every record that matches the current filters as a CSV file." },
          { region: "tabs", title: "Overdue badge", body: "The number on the History tab is the count of overdue loans, visible even while you work on the Desk tab." },
          { region: "tiles", title: "Summary tiles", body: "Select a tile to filter: overdue (oldest deadline first), active loans and due within 24 hours, or today’s activity." },
          { region: "search", title: "Search and dates", body: "Search by patron name, library ID, book title or ISBN. The Borrowed date filter has Today, This week and This month presets." },
          { region: "list", title: "Rows", body: "Each live loan has Return; overdue rows also have View fine. Select a row for details: borrowed, due and returned times, who issued it, fines and notes." },
        ],
      },
    ],
    tasks: [
      { title: "Lend a book", steps: ["On the Desk tab, make sure Borrow is selected.", "Scan the patron’s library ID (or type their name and pick them).", "Check the patron card. If it says Clearance required, stop and select Open clearance.", "Scan the copy’s accession number.", "Read the Transaction summary: patron, copy and estimated due date.", "Select Confirm borrow (or press Enter when the button has focus)."], result: "The loan appears in Recently processed this session with an Undo button for 60 seconds." },
      { title: "Take a book back", when: "The borrower does not need to be present.", steps: ["Switch the Desk transaction to Return.", "Scan or type the copy identifier.", "Check the result: borrower, due date and whether it is On time or overdue.", "If a fine is shown, either Record cash payment (only if you received the money) or leave it for Clearance.", "Select Confirm return."], result: "The copy becomes available again. Any reservation for that title can now be prepared." },
      { title: "Fix a mistake right away", steps: ["Find the transaction in Recently processed this session.", "Select Undo before the 60 seconds run out."], result: "The loan or return is reversed and logged. Pickup loans and anything involving a fine cannot be undone this way; ask an administrator to correct it in Clearance." },
      { title: "Follow up on overdue books", steps: ["Open the History tab (the badge shows how many are overdue).", "Select the Overdue loans tile.", "Open a row to see the patron’s contact email and the accrued fine.", "Use Export if you need a list to send or print."] },
    ],
    terms: [
      { term: "Accession number", meaning: "The library’s unique number for one physical copy. A copy cannot be lent without one." },
      { term: "Needs policy", meaning: "The copy’s book type has no loan policy, so no due date can be calculated. Fix it in Catalog or Loan Policies." },
      { term: "Reference only", meaning: "The copy is for use inside the library and cannot be borrowed." },
      { term: "Reserved", meaning: "The copy is set aside for someone else’s reservation. It can only be lent through that reservation’s pickup." },
      { term: "Legacy loan", meaning: "An older loan with no linked copy record. It can still be returned; the identifier may be missing." },
    ],
    cautions: ["Returning a book does not settle its fine. The patron stays on the Clearance queue until the balance is paid, adjusted or waived.", "The due date shown before checkout is an estimate. The book’s loan policy, including holidays, sets the final date when you confirm.", "A damaged copy adds an inspection check to the confirmation. Note the damage before lending."],
    related: ["clearance", "reservations", "catalog"],
  },

  reservations: {
    purpose: "Patrons reserve books from the public catalog. Reservations is where staff find those requests, set a copy aside, tell the patron it is ready, and hand it over before the pickup deadline.",
    screens: [{
      title: "Reservations",
      caption: "The queue is sorted so the most urgent work is at the top.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tiles tiles tiles", "chips search search", "list list drawer", "list list drawer"],
      regions: [
        header("Reservations", ["Refresh", "View archive"]),
        { id: "tiles", kind: "tiles", label: "Summary", items: ["Pending to prepare", "Ready for pickup", "Expiring soon / expired"], tone: "attention" },
        { id: "chips", kind: "chips", label: "Filter", items: ["Needs action", "Closed", "All"] },
        { id: "search", kind: "search", label: "Search patron, ID, book or author" },
        { id: "list", kind: "list", label: "Outstanding reservations", items: ["Patron", "Book", "Status", "Deadline", "Mark ready"] },
        { id: "drawer", kind: "drawer", label: "Reservation details", items: ["Current status", "Pickup deadline", "Contact", "Request history", "Process pickup"] },
      ],
      callouts: [
        { region: "tiles", title: "Summary tiles", body: "Select one to filter. Pending to prepare are new requests; Ready for pickup are on the hold shelf; Expiring soon / expired have a pickup deadline within 24 hours or already passed." },
        { region: "chips", title: "Needs action", body: "The default: pending plus ready holds. Closed shows fulfilled, cancelled and expired requests." },
        { region: "list", title: "Queue order", body: "Ready pickups with the nearest deadline first, then the oldest pending requests. Deadlines turn urgent at 24 hours and again at 6 hours; pending requests older than 7 days are flagged." },
        { region: "drawer", title: "Details drawer", body: "Status, deadline, the patron’s contact, notes and the request history. Process pickup and Cancel reservation live here." },
      ],
    }],
    tasks: [
      { title: "Prepare a new request", steps: ["Select the Pending to prepare tile.", "Pull a copy of the book from the shelf.", "Select Mark ready on that row."], result: "The hold moves to Ready for pickup, a pickup deadline is set and the patron is notified. If no copy is free, the button explains why; wait for a return." },
      { title: "Hand over a reserved book", steps: ["Search for the patron or open the row from Ready for pickup.", "Select Process pickup.", "Borrow & Return opens with the patron and reserved book already filled in.", "Scan the copy you set aside and select Confirm borrow."], result: "The reservation closes as Fulfilled and the loan starts." },
      { title: "Cancel a hold", steps: ["Open the reservation.", "Choose Cancel reservation.", "Type a short reason (the patron will see it) and confirm."], result: "The hold closes as Cancelled and the copy is released." },
    ],
    terms: [
      { term: "Pending", meaning: "Requested by the patron; no copy set aside yet." },
      { term: "Ready", meaning: "A copy is on the hold shelf and the pickup window is running." },
      { term: "Expired", meaning: "The pickup deadline passed without collection." },
      { term: "Fulfilled", meaning: "The patron collected the book and the loan was recorded." },
    ],
    cautions: ["Only scan the copy you actually set aside during pickup. Borrow & Return rejects a copy of a different book.", "Archived records leave the list but can be restored from View archive."],
    related: ["borrow-return", "notifications"],
  },

  clearance: {
    purpose: "Clearance & Fines decides whether a patron may borrow or reserve. A patron is blocked while they have overdue books, and stays on the queue as Fines only until their balance is settled. This is also where cash payments are recorded and receipts are printed.",
    screens: [
      {
        title: "Review queue",
        caption: "Who still owes something, most serious first.",
        columns: "1fr 1fr 1fr",
        areas: ["head head head", "tabs tabs tabs", "tiles tiles tiles", "search search search", "list list list"],
        regions: [
          header("Clearance & Fines", ["Refresh", "Export"]),
          { id: "tabs", kind: "tabs", label: "Tabs", items: ["Review queue", "Find a patron"] },
          { id: "tiles", kind: "tiles", label: "Filters", items: ["Blocked patrons", "Fines-only patrons", "All patrons"], tone: "danger" },
          { id: "search", kind: "search", label: "Search patron name, ID or overdue book" },
          { id: "list", kind: "list", label: "Review queue", items: ["Patron", "Status", "Oldest due", "Outstanding", "Review patron"] },
        ],
        callouts: [
          { region: "tabs", title: "Two ways in", body: "Review queue lists everyone who owes something. Find a patron opens one person directly by scanning their ID or typing a name." },
          { region: "tiles", title: "Queue filters", body: "Blocked patrons have overdue items. Fines-only patrons returned everything but still owe money. All includes the combined unpaid balance." },
          { region: "list", title: "Review patron", body: "Opens the patron’s clearance record. Rows are ordered Blocked first, then by amount owed." },
        ],
      },
      {
        title: "Patron clearance record",
        caption: "Everything one patron owes, with the actions to settle it.",
        columns: "1fr 1fr",
        areas: ["status status", "items fines", "items pay"],
        regions: [
          { id: "status", kind: "panel", label: "Patron clearance", items: ["Status: Blocked / Fines only / Cleared", "Outstanding balance", "Checklist"], tone: "danger" },
          { id: "items", kind: "list", label: "Overdue items", items: ["Book", "Due", "Return"] },
          { id: "fines", kind: "list", label: "Fine records", items: ["Book", "Amount", "Status", "⋯"] },
          { id: "pay", kind: "button", label: "Record full payment", tone: "primary" },
        ],
        callouts: [
          { region: "status", title: "Status and checklist", body: "Shows exactly what stands between the patron and borrowing: “Overdue items must be returned”, unpaid fines, or Cleared for borrowing and reservations." },
          { region: "items", title: "Overdue items", body: "Each item has Return, which opens the return desk with that copy already filled in." },
          { region: "fines", title: "Fine row menu", body: "Administrators can Adjust fine (reduce by an amount), Waive outstanding fine, or Correct transaction. Each needs a reason for the audit trail." },
          { region: "pay", title: "Record payment", body: "Record full payment pays the whole balance; Record partial payment lets you enter an amount. Both show a confirmation with the exact amount, then create a receipt." },
        ],
      },
    ],
    tasks: [
      { title: "Accept a cash payment", steps: ["Open the patron (Find a patron, or Review patron in the queue).", "Count the cash you have received.", "Select Record full payment, or Record partial payment and type the amount received.", "Check the confirmation: patron, outstanding balance and amount to record.", "Confirm payment, then select Print receipt and give it to the patron."], result: "The balance drops, a numbered receipt is saved and the patron is notified. If the balance changed while you were working, the payment is rejected so nobody is charged twice; refresh and try again." },
      { title: "Clear a blocked patron", steps: ["Open the patron’s record.", "Return each item under Overdue items using its Return button.", "Back on the record, settle any fines that the late returns created.", "Confirm the status reads Cleared."] },
      { title: "Reduce or waive a fine (administrators)", steps: ["Open the fine row menu (⋯) under Fine records.", "Choose Adjust fine and enter the amount to reduce, or Waive outstanding fine.", "Type the reason, for example “Book returned in drop box before due date”.", "Select Confirm adjustment."], result: "The change and your reason appear in Audit Logs." },
      { title: "Reprint a receipt", steps: ["Open the patron’s record.", "Find the payment under clearance activity and select Receipt.", "Select Print receipt."] },
    ],
    terms: [
      { term: "Blocked", meaning: "Has at least one overdue item. Cannot borrow or reserve." },
      { term: "Fines only", meaning: "All items are back, but money is still owed. Cannot borrow until it is settled." },
      { term: "Cleared", meaning: "Nothing owed. Borrowing and reservations are allowed." },
      { term: "Correct transaction", meaning: "Reverse a payment recorded in error. Requires a reason and is kept in the audit trail." },
    ],
    cautions: ["Record only cash already in your hand. The receipt is generated the moment you confirm.", "Fines on overdue items keep growing until the book is returned. Return the item first, then take payment."],
    related: ["borrow-return", "users", "loan-policies"],
  },

  attendance: {
    purpose: "Attendance tracks library visits from the entrance scanner. Today shows who is inside right now; History is one row per completed visit for reporting.",
    screens: [{
      title: "Attendance: Today",
      caption: "Live view of the building. Updates every 30 seconds.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tabs tabs tabs", "tiles tiles tiles", "search search search", "list list list"],
      regions: [
        header("Attendance", ["Export", "Manual entry", "Time out all"]),
        { id: "tabs", kind: "tabs", label: "Tabs", items: ["Today", "History"] },
        { id: "tiles", kind: "tiles", label: "Summary", items: ["Inside now", "Arrivals", "Departures"] },
        { id: "search", kind: "search", label: "Search name or library ID" },
        { id: "list", kind: "list", label: "Attendance visits", items: ["Patron", "Time in", "Duration", "Time out"] },
      ],
      callouts: [
        { region: "head", title: "Manual entry and Time out all", body: "Manual entry records a visit for a patron who cannot use the scanner, with the same scanner rules. Time out all ends every open visit at once, for closing time; you are asked to confirm." },
        { region: "tiles", title: "Tiles filter the list", body: "Inside now are open visits; Arrivals and Departures are today’s scans in and out. Counts cover all of today, not just the visible page." },
        { region: "list", title: "Visit rows", body: "New rows highlight briefly when they arrive. Time out ends one visit." },
      ],
    }],
    tasks: [
      { title: "Log a visitor manually", steps: ["Select Manual entry in the page header.", "Type the patron’s library ID.", "Choose Time in or Time out.","Select Record attendance."], result: "The visit appears under Inside now." },
      { title: "Close the library for the day", steps: ["Check Inside now for anyone still listed.", "Select Time out all and confirm."], result: "Open visits end with the current time, so History shows a duration for each." },
      { title: "Pull last month’s visits", steps: ["Open History.", "Set the date range and, if needed, the Type filter.", "Select Export."] },
    ],
    terms: [
      { term: "Time out missing", meaning: "The visit was never closed with a scan out or Time out." },
    ],
    related: ["analytics", "reports"],
  },

  users: {
    purpose: "Users holds every account: students, employees, staff and administrators. Use it to look someone up, create accounts, fix details, check their borrowing, and turn access on or off.",
    screens: [
      {
        title: "Users list",
        caption: "Find someone, then open their record.",
        columns: "1fr 1fr 1fr",
        areas: ["head head head", "chips chips filters", "search search search", "list list list"],
        regions: [
          header("Users", ["Export", "Create user"]),
          { id: "chips", kind: "chips", label: "Status", items: ["Active", "Inactive", "Archived", "All"] },
          { id: "filters", kind: "pill", label: "Filters: Role · Borrowing access · Sort" },
          { id: "search", kind: "search", label: "Search name or library ID" },
          { id: "list", kind: "list", label: "User records", items: ["Patron", "Role", "Borrowing", "Access", "View account"] },
        ],
        callouts: [
          { region: "head", title: "Create user", body: "Opens the new account form. Export downloads the current list, or only the rows you have selected." },
          { region: "chips", title: "Status chips", body: "Active can sign in and borrow. Inactive has access off, or a student whose term is missing or expired. Archived accounts are retired but kept for history." },
          { region: "filters", title: "Filters", body: "Narrow by role, or by Borrowing access: Needs attention shows people with overdue items or unpaid fines. Sort by name or Overdue and fines first." },
          { region: "list", title: "Rows", body: "Borrowing shows current loans and unpaid fines at a glance. Select a row or View account to open the record." },
        ],
      },
      {
        title: "User record",
        caption: "One drawer with every section of the account.",
        columns: "1fr 1.6fr",
        areas: ["title title", "nav body", "nav body", "nav danger"],
        regions: [
          { id: "title", kind: "header", label: "Patron name", items: ["View library QR"] },
          { id: "nav", kind: "panel", label: "Sections", items: ["Identity", "Academic", "Access", "Borrowing", "Account emails"] },
          { id: "body", kind: "panel", label: "Fields", items: ["Library ID · Username", "Program / term", "Role · Status", "Reset password"] },
          { id: "danger", kind: "panel", label: "Danger zone", items: ["Archive user"], tone: "danger" },
        ],
        callouts: [
          { region: "title", title: "Library QR", body: "Shows the patron’s QR code for the scanner. Download PNG or Print label for a replacement card." },
          { region: "nav", title: "Sections", body: "Jump between parts of the record. Borrowing lists books on loan, reservations and unpaid fines with links to Clearance and history." },
          { region: "body", title: "Editing", body: "Change details and select Save changes. Changing a role asks you to confirm because it changes what the person can open." },
          { region: "danger", title: "Archive user", body: "Only possible once the person has no loans, unpaid fines or active reservations. The blockers are listed here." },
        ],
      },
    ],
    tasks: [
      { title: "Create an account", steps: ["Select Create user.", "Enter the library ID (student or employee number), full name and email.", "Choose the role and, for students, the program and academic term.", "Select Create and send invitation."], result: "The person receives an email to set their password. The account stays locked until they do. Resend invitation is in the record if it was missed." },
      { title: "Find out why someone cannot borrow", steps: ["Search for them and open the record.", "Check Access: an Inactive status or an expired term stops borrowing.", "Check Borrowing: overdue items or unpaid fines also block. Select Review clearance to settle them."] },
      { title: "Reset a password", steps: ["Open the record and choose Reset password.", "Either Send recovery email, or type and confirm a new password.", "Save changes and confirm."], result: "A typed password must be changed at the person’s next sign-in." },
      { title: "Print a replacement library card label", steps: ["Open the record.", "Select View library QR in the header.", "Choose Print label (allow pop-ups if asked) or Download PNG."] },
    ],
    terms: [
      { term: "Library ID", meaning: "The student or employee number. It is what the scanner and desk search use." },
      { term: "Scanner account", meaning: "A device account that can open only the scan page. Its password is managed by administrators." },
      { term: "Archived", meaning: "Retired account. Kept for loan and payment history, can be restored." },
    ],
    cautions: ["You cannot give anyone a role higher than your own, or change your own role.", "Save or discard edits before archiving; the danger zone waits until the form is clean."],
    related: ["clearance", "academic-calendar", "email-deliveries"],
  },

  catalog: {
    purpose: "Catalog holds two kinds of data. A record describes a title (author, ISBN, subject). Holdings are the physical copies of that title, each with its own accession number, condition, location and loan policy. A title can only be lent when it has at least one active, accessioned copy.",
    screens: [
      {
        title: "Catalog records",
        caption: "Titles, with the problems that stop lending called out.",
        columns: "1fr 1fr 1fr",
        areas: ["head head head", "tabs tabs tabs", "chips search filters", "list list list"],
        regions: [
          header("Catalog", ["Export", "Import", "Add record"]),
          { id: "tabs", kind: "tabs", label: "Tabs", items: ["Records", "Holdings"] },
          { id: "chips", kind: "chips", label: "Status", items: ["Active", "Needs holdings", "Archived", "All"], tone: "attention" },
          { id: "search", kind: "search", label: "Search by ISBN, title or author" },
          { id: "filters", kind: "pill", label: "Filters: Material · Loan policy" },
          { id: "list", kind: "list", label: "Catalogue records", items: ["☐", "Title and author", "Identifier", "Holdings", "Manage copies"] },
        ],
        callouts: [
          { region: "head", title: "Add, Import, Export", body: "Add record creates one title and its first copies. Import takes a CSV and shows a validated preview before anything is saved. Export downloads the current list." },
          { region: "tabs", title: "Records vs Holdings", body: "Records lists titles. Holdings lists every physical copy across the catalog, for stock checks and label printing." },
          { region: "chips", title: "Needs holdings", body: "Titles with no lendable copy: no copies, no accession number, or no loan policy. Work this list down to zero." },
          { region: "search", title: "Search", body: "Type or paste an ISBN, title or author into the box. Results update as you type." },
          { region: "list", title: "Select and act", body: "Tick rows to Archive, Assign policy or Print copy labels in bulk. Manage copies opens the record on its Copies tab." },
        ],
      },
      {
        title: "Record drawer",
        caption: "Details and copies for one title.",
        columns: "1fr 1fr",
        areas: ["title title", "tabs tabs", "body body", "footer footer"],
        regions: [
          { id: "title", kind: "header", label: "Book title", items: ["Print holdings record"] },
          { id: "tabs", kind: "tabs", label: "Sections", items: ["Details", "Copies", "Image", "Circulation"] },
          { id: "body", kind: "panel", label: "Copies", items: ["Accession · Condition · Location · State", "Add copy", "Print QR label"] },
          { id: "footer", kind: "button", label: "Save changes", tone: "primary" },
        ],
        callouts: [
          { region: "tabs", title: "Sections", body: "Details is the bibliographic record. Copies is the physical inventory. Image is the cover. Circulation explains the loan policy and links to current loans." },
          { region: "body", title: "Copies", body: "Add copy, edit accession numbers, mark condition (good, damaged, lost), retire or restore a copy. Save and next moves to the following copy after a successful save." },
          { region: "footer", title: "Save changes", body: "Saves the record fields. Copy changes are saved separately on each copy, and image changes save immediately." },
        ],
      },
    ],
    tasks: [
      { title: "Add a new book", steps: ["Select Add record.", "Enter the ISBN to fill details automatically, or type them.", "Choose the material type and loan policy.", "Add the initial copies with their accession numbers.", "Save. Use Add record and add another for a pile of new books."], result: "If the ISBN already exists you are offered to add a copy to that record instead." },
      { title: "Make a title lendable", when: "It appears under Needs holdings.", steps: ["Select the Needs holdings chip.", "Open the record and go to Copies.", "Add a copy, or give the existing copy an accession number.", "Make sure the record has a loan policy (Assign policy).", "Save the copy."], result: "The title leaves Needs holdings and can be borrowed." },
      { title: "Print spine or QR labels", steps: ["Tick the records on the Records tab (or open a single record).", "Select Print copy labels, or Print QR label from the copy.", "Allow pop-ups if your browser asks."] },
      { title: "Retire a title", steps: ["Open the record.", "Go to the danger zone and choose Archive."], result: "Blocked while copies are on loan or reserved. Archived records can be restored." },
    ],
    terms: [
      { term: "Record", meaning: "The description of a title. One record can have many copies." },
      { term: "Copy / holding", meaning: "One physical book with its own accession number." },
      { term: "Accession voided", meaning: "A retired accession number. It can never be reused." },
      { term: "Thesis", meaning: "A thesis record. Uses its own fields and is usually reference only." },
    ],
    cautions: ["Changing a copy’s loan policy affects only new loans.", "Fields on the form come from Catalog Fields; ask a super administrator to add or change one."],
    related: ["borrow-return", "loan-policies", "catalog-fields"],
  },

  "website-content": {
    purpose: "Website Content edits the public site: Homepage, About, Bulletin, Events and Subscriptions, plus the library notes shown in this guide. Edits are private drafts until published, so you can work on changes over several sessions.",
    screens: [{
      title: "Website Content editor",
      caption: "Pick a section, edit, preview, publish.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tabs tabs tabs", "intro intro actions", "body body body", "footer footer footer"],
      regions: [
        header("Website Content", ["Publish all"]),
        { id: "tabs", kind: "tabs", label: "Sections", items: ["Homepage", "About", "Bulletin", "Events", "Subscriptions", "User guide"] },
        { id: "intro", kind: "panel", label: "Section description", items: ["View on site"] },
        { id: "actions", kind: "pill", label: "Preview · Add" },
        { id: "body", kind: "panel", label: "Editor", items: ["Fields", "Image uploader with crop", "Image description"] },
        { id: "footer", kind: "panel", label: "Publishing footer", items: ["2 unsaved changes", "Discard", "Save draft", "Publish"], tone: "primary" },
      ],
      callouts: [
        { region: "head", title: "Publish all", body: "Appears when several sections have drafts. Publishes every section together; if one fails, none are published." },
        { region: "tabs", title: "Tab markers", body: "A dot means unsaved edits on this computer. A number means saved drafts (or, on Events, upcoming events) waiting." },
        { region: "actions", title: "Preview and Add", body: "Preview shows the draft as visitors will see it, at phone or desktop width. Add creates a post, event, resource, staff member or hours row depending on the tab." },
        { region: "body", title: "Images", body: "JPG, PNG or WebP up to 5 MB. Crop with the mouse or keyboard and write a description so screen-reader users know what the image shows." },
        { region: "footer", title: "Footer", body: "Save draft keeps changes private. Publish makes this section public. Discard removes only your unpublished changes." },
      ],
    }],
    tasks: [
      { title: "Post a bulletin announcement", steps: ["Open the Bulletin tab and select Add post.", "Write the title and content, choose the post type and add a cover image if you have one.", "Save draft and Preview.", "Choose Publish, or Publish and notify to also alert patrons."], result: "Publish and notify shows how many people will be notified before you confirm." },
      { title: "Change opening hours", steps: ["Open the Homepage tab.", "Edit the Operating hours rows (Add hours for a new day range).", "Save draft, check Preview, then Publish."] },
      { title: "Schedule an event", steps: ["Open Events and select Add event.", "Fill in the title, start date and time, optional end and location, and a registration URL if any.", "Publish when ready."], result: "Upcoming events appear on the public bulletin; past events stay listed as a record." },
      { title: "Add a library note to this guide", steps: ["Open the User guide tab and select Add module.", "Choose which roles see it and which admin page it relates to.", "Write the steps and any warnings, then Publish."], result: "It appears under Library notes in this guide." },
    ],
    terms: [
      { term: "Draft", meaning: "Saved but not public. Other administrators can see and continue it." },
      { term: "Pinned", meaning: "A bulletin post kept at the top of the public bulletin." },
      { term: "Hidden", meaning: "A subscription resource kept in the list but not shown on the site." },
    ],
    cautions: ["If another administrator publishes the same section while you edit, you are asked to load the latest version. Your edits are retained until you choose.", "Guide addresses are locked after publishing so existing links keep working."],
    related: ["notifications", "moderation"],
  },

  notifications: {
    purpose: "Notifications are messages patrons see in the app, and optionally by email. Announcements are the ones staff write; System alerts are sent automatically, such as due-date reminders and ready pickups.",
    screens: [{
      title: "Notifications",
      caption: "Every message, its audience and how it was delivered.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tabs tabs tabs", "chips chips chips", "list list drawer", "list list drawer"],
      regions: [
        header("Notifications", ["Refresh", "Export", "New notification"]),
        { id: "tabs", kind: "tabs", label: "Tabs", items: ["Announcements", "System alerts"] },
        { id: "chips", kind: "chips", label: "Source", items: ["Manual", "Automatic", "Failed", "All"], tone: "danger" },
        { id: "list", kind: "list", label: "Notification records", items: ["Title", "Audience", "Published / Scheduled", "In-app reads", "⋯"] },
        { id: "drawer", kind: "drawer", label: "New notification", items: ["Audience: Everyone / By role / Specific patrons", "Title · Message", "Also send by email", "Send now / Schedule", "Patron preview"] },
      ],
      callouts: [
        { region: "head", title: "New notification", body: "Opens the compose drawer." },
        { region: "chips", title: "Failed", body: "Messages that could not be delivered. Open the row menu (⋯) to Resend." },
        { region: "list", title: "Row menu", body: "Resend, Duplicate (start a new message from this one) and Expire (remove it from patrons’ lists, or cancel a scheduled one)." },
        { region: "drawer", title: "Compose", body: "Choose the audience and watch the live recipient count. Add an optional image, a link to a bulletin post, an expiry, and email delivery. The preview shows what patrons will see." },
      ],
    }],
    tasks: [
      { title: "Send an announcement", steps: ["Select New notification.", "Choose the audience: Everyone, By role, or search for Specific patrons.", "Write a clear title and message.", "Tick Also send by email if it matters outside the app.", "Choose Send now, or Schedule with a future date and time.", "Check the recipient count in the confirmation and send."] },
      { title: "Point patrons to a bulletin post", steps: ["In the compose drawer, use Link a bulletin post.", "Search for a published post and choose it."], result: "The notification opens the post and uses its main image." },
    ],
    terms: [
      { term: "In-app reads", meaning: "How many recipients opened it in the app. Email opens are not counted." },
      { term: "Expires", meaning: "After this time the message disappears from patrons’ lists. Leave empty to keep it." },
    ],
    cautions: ["If no recipients have a verified email, untick email to send in-app only.", "Routine emails share a daily allowance. When it is used up, routine sending pauses; account and security emails still go out."],
    related: ["email-deliveries", "website-content"],
  },

  "email-deliveries": {
    purpose: "Email Deliveries is the delivery log for every email the system queued: notices to patrons and account emails such as invitations and password recovery. Use it to answer “did they get my email?”.",
    screens: [{
      title: "Email Deliveries",
      caption: "Search for an address, open the delivery, read the attempts.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "allow allow allow", "tabs tabs tabs", "search search filters", "list list drawer"],
      regions: [
        header("Email Deliveries", ["Refresh"]),
        { id: "allow", kind: "panel", label: "Shared daily email allowance", items: ["Routine capacity left", "Account/security reserve"] },
        { id: "tabs", kind: "tabs", label: "Tabs", items: ["Manual notifications", "Automated notices"] },
        { id: "search", kind: "search", label: "Recipient address, delivery ID or Brevo ID" },
        { id: "filters", kind: "pill", label: "Status · Purpose · Dates" },
        { id: "list", kind: "list", label: "Delivery records", items: ["Recipient", "Purpose", "Status", "Attempts"] },
        { id: "drawer", kind: "drawer", label: "Email delivery details", items: ["Recorded times", "Send attempts", "Result and diagnostics"] },
      ],
      callouts: [
        { region: "allow", title: "Daily allowance", body: "How many routine emails can still go out today. A reserve is kept so invitations and password emails are never blocked by announcements." },
        { region: "tabs", title: "Library vs account", body: "Library emails covers notices and announcements. Account emails (its own sidebar link) covers invitations, verification and recovery." },
        { region: "drawer", title: "Details", body: "Each attempt, the provider’s message ID and the reason for any failure. Failed deliveries can be resent from Notifications." },
      ],
    }],
    tasks: [
      { title: "Check whether a patron got an email", steps: ["Search for their email address.", "Open the most recent delivery.", "Read the status and the Result and diagnostics section."], result: "Accepted means the provider took it; it may still land in spam. Failed shows the reason." },
    ],
    cautions: ["Only emails this application queued appear here."],
    related: ["notifications", "users"],
  },

  moderation: {
    purpose: "Bulletin comments that readers report, or that automatic screening holds back, wait here for an administrator’s decision.",
    screens: [{
      title: "Moderation",
      caption: "Queue on the left, the case on the right.",
      columns: "1fr 1.4fr",
      areas: ["head head", "summary summary", "list case", "list decide"],
      regions: [
        header("Moderation", ["Refresh"]),
        { id: "summary", kind: "chips", label: "Review status", items: ["Awaiting review", "Resolved", "Dismissed", "All cases"], tone: "attention" },
        { id: "list", kind: "list", label: "Comment review", items: ["Comment", "Reason", "Reported"] },
        { id: "case", kind: "panel", label: "Comment under review", items: ["Conversation context", "Reports", "Open post"] },
        { id: "decide", kind: "panel", label: "Record a decision", items: ["Hide comment", "Dismiss reports / close case", "Reason"], tone: "primary" },
      ],
      callouts: [
        { region: "summary", title: "Status", body: "Awaiting review is the work to do. Resolved and Dismissed are past decisions." },
        { region: "case", title: "Context", body: "The comment with the surrounding thread (first 20 replies) and who reported it. Some cases have no reports because screening raised them." },
        { region: "decide", title: "Decision", body: "Hide comment removes it from the site and sends your reason to the author. Dismiss reports closes the case and leaves it visible." },
      ],
    }],
    tasks: [
      { title: "Decide a case", steps: ["Open the oldest case under Awaiting review.", "Read the comment in its conversation context; use Open post if you need more.", "Choose Hide comment or Dismiss reports / close case.", "Write a short, respectful reason and record the decision."] },
    ],
    cautions: ["Reporter identities are visible only to administrators. Do not share them.", "Use Copy case link to ask a colleague for a second opinion."],
    related: ["website-content"],
  },

  analytics: {
    purpose: "Analytics turns circulation, attendance and catalog data into charts for a date range you choose, and can write a plain-language report with the AI Report tab.",
    screens: [{
      title: "Analytics",
      caption: "One date range drives every activity chart.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "range range range", "tabs tabs tabs", "kpi kpi kpi", "chart chart side"],
      regions: [
        header("Operations Analytics", ["Refresh", "Export", "Print / PDF"]),
        { id: "range", kind: "pill", label: "Date range: Last 30 days ▾" },
        { id: "tabs", kind: "tabs", label: "Views", items: ["Overview", "Circulation", "Visitors", "Collection", "AI Report"] },
        { id: "kpi", kind: "tiles", label: "Key figures", items: ["Borrowed", "Returned", "Library arrivals"] },
        { id: "chart", kind: "chart", label: "Borrowed and returned" },
        { id: "side", kind: "panel", label: "Needs attention", items: ["Overdue loans", "Verify circulation figures"] },
      ],
      callouts: [
        { region: "range", title: "Date range", body: "Presets or a custom range. It applies to activity charts and to the AI Report’s evidence. Inventory and loan status are always today’s snapshot." },
        { region: "tabs", title: "Views", body: "Overview summarizes everything. Circulation, Visitors and Collection go deeper. AI Report writes a summary you can save." },
        { region: "kpi", title: "Key figures", body: "Each figure links to its detailed view. A comparison line appears only when the previous period has data." },
        { region: "side", title: "Verify links", body: "Jump to the records behind a number, for example Verify in Attendance, before you quote it in a report." },
        { region: "head", title: "Export and print", body: "Export the current tab and range as CSV, or Print / PDF with the library name, your name and the time." },
      ],
    }],
    tasks: [
      { title: "Prepare a monthly summary", steps: ["Set the date range to last month.", "Open Overview and check the key figures.", "Open AI Report, optionally type a question such as “Which programs borrowed the most?”, and generate.", "Read it, use Verify links for any figure you will quote, then Save to reports or Copy brief."], result: "Saved briefs are kept under Reports > Saved briefs." },
    ],
    terms: [
      { term: "Arrivals", meaning: "Check-ins at the entrance scanner." },
      { term: "Scans", meaning: "All check-ins, check-outs and borrowing scans together." },
      { term: "Website visitors", meaning: "The sum of daily unique visitors, kept separate from page views." },
    ],
    cautions: ["The AI Report is a draft. Check every figure against the linked records before sharing it."],
    related: ["reports", "attendance"],
  },

  reports: {
    purpose: "Reports has three tabs. Explore Records is a live lookup across any type of record. Reports produces standard institutional outputs, such as Daily Library Users or Holdings Inventory, to print or export. Saved briefs keeps AI reports from Analytics.",
    screens: [{
      title: "Explore Records",
      caption: "Choose what to look at, filter it, pick columns, export.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tabs tabs tabs", "type search dates", "filters filters export", "table table table"],
      regions: [
        header("Reports", ["Updated · Refresh"]),
        { id: "tabs", kind: "tabs", label: "Tabs", items: ["Explore Records", "Reports", "Saved briefs"] },
        { id: "type", kind: "pill", label: "Record type: Borrowings ▾" },
        { id: "search", kind: "search", label: "Search records" },
        { id: "dates", kind: "pill", label: "Date range" },
        { id: "filters", kind: "chips", label: "Use filters", items: ["Status: Overdue ×", "Saved presets", "Reset filters"] },
        { id: "export", kind: "pill", label: "Choose columns · Export · Print" },
        { id: "table", kind: "list", label: "Results", items: ["Name", "Title", "Borrowed", "Due", "Status"] },
      ],
      callouts: [
        { region: "type", title: "Record type", body: "Users, Catalog, Borrowings, Reservations, Fines, Attendance, Notifications or Academic subscriptions. Its description appears under the selector. Search and dates are kept when you switch." },
        { region: "filters", title: "Filters and presets", body: "Use filters opens fields specific to the type. Active filters appear as removable chips. Save current filters as a preset; presets are stored in this browser only." },
        { region: "export", title: "Columns and export", body: "Seven useful columns show by default; add more in Choose columns. CSV, Excel and Print / PDF use your columns and every matching record, up to 10,000 rows." },
        { region: "table", title: "Results", body: "Wide tables scroll sideways with the first column pinned. Select a column heading to sort." },
      ],
    }],
    tasks: [
      { title: "Produce a standard report", steps: ["Open the Reports tab.", "Choose a report, for example Statistics for Resource Usage or Top 10 Users.", "Set the period and any options, then select Run.", "Export to Excel or Print / Save as PDF."], result: "Printed and exported reports carry the library name, period, your name and the filters used." },
      { title: "List everyone who owes fines", steps: ["On Explore Records choose Fines.", "Filter to outstanding balances.", "Choose columns, then Export matching records."] },
      { title: "Repeat a past export", steps: ["Open Recent exports and print views.", "Re-run the entry."], result: "It exports current data with the same settings." },
    ],
    cautions: ["Every export is recorded in Audit Logs with who exported what.", "Recent history and presets are per device; they will not appear on another computer."],
    related: ["analytics", "audit-logs"],
  },

  "audit-logs": {
    purpose: "Audit Logs is the permanent, read-only history of changes: who did what, to which record, and what the values were before and after. Use it to investigate a disputed fine, an unexpected role change or a missing record.",
    screens: [{
      title: "Audit Logs",
      caption: "An investigation feed, newest first, grouped by day.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "search filters view", "chips chips chips", "feed feed feed"],
      regions: [
        header("Audit Logs", ["Refresh"]),
        { id: "search", kind: "search", label: "Search audit events" },
        { id: "filters", kind: "pill", label: "Category · Action · Actor · Dates" },
        { id: "view", kind: "pill", label: "Saved views · Density" },
        { id: "chips", kind: "chips", label: "Quick filters", items: ["High impact", "Security", "Show sign-ins and sign-outs"] },
        { id: "feed", kind: "list", label: "Events by day", items: ["Actor", "Action", "Record", "Time", "Before → After"] },
      ],
      callouts: [
        { region: "filters", title: "Filters", body: "Narrow by category, action, who did it, a record reference, or dates. Filters apply instantly and live in the URL." },
        { region: "view", title: "Saved views", body: "Name and save a set of filters you use often. Choose Compact or Comfortable density." },
        { region: "chips", title: "Quick filters", body: "High impact and Security show the events most worth checking. Sign-ins are hidden by default to reduce noise." },
        { region: "feed", title: "Event rows", body: "Select a row to expand the before and after values, the event ID and the page it came from. Sensitive values are shown as redacted." },
      ],
    }],
    tasks: [
      { title: "Find who changed a fine", steps: ["Choose the Clearance category (or search the patron’s name).", "Set the date range around the change.", "Expand the event to read the before and after amounts and the reason given."] },
    ],
    cautions: ["Nothing here can be edited or deleted.", "A banner announces new events without reshuffling the list you are reading. Select it to load them."],
    related: ["reports", "backup"],
  },

  "academic-calendar": {
    purpose: "The Academic Calendar holds the reference lists the rest of the system depends on: terms decide which student accounts are active, holidays move due dates, and programs and departments fill the account and catalog forms.",
    screens: [{
      title: "Academic Calendar",
      caption: "Four lists, the same controls on each.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tabs tabs tabs", "desc desc add", "chips search search", "list list list"],
      regions: [
        header("Academic Calendar"),
        { id: "tabs", kind: "tabs", label: "Sections", items: ["Academic terms", "Programs / Courses", "Holidays", "Departments"] },
        { id: "desc", kind: "panel", label: "What this list is for" },
        { id: "add", kind: "button", label: "Add …", tone: "primary" },
        { id: "chips", kind: "chips", label: "Status", items: ["Active", "Archived"] },
        { id: "search", kind: "search", label: "Search" },
        { id: "list", kind: "list", label: "Entries", items: ["Name", "Dates", "Used by", "Status", "⋯"] },
      ],
      callouts: [
        { region: "tabs", title: "Sections", body: "Counts on each tab load together. A dot means you have unsaved edits in that section." },
        { region: "add", title: "Add", body: "Opens a drawer. On Holidays there is also Import national holidays, which lists the year’s Philippine non-working days for you to tick." },
        { region: "list", title: "Row menu", body: "Edit, Archive, and on terms Set as current. Delete permanently appears only for entries nothing refers to. Reference counts link to the users and catalog records that use the entry." },
      ],
    }],
    tasks: [
      { title: "Start a new term", steps: ["Open Academic terms and select Add term.", "Enter the name and start and end dates, then save.", "When the term begins, open its row menu and choose Set as current."], result: "Students assigned to the current term are active; those on an expired term become Inactive until reassigned." },
      { title: "Add this year’s holidays", steps: ["Open Holidays and select Import national holidays.", "Review the list and untick any the library will not observe.", "Select Import selected. Add local holidays with Add holiday."] },
    ],
    cautions: ["Active holidays extend due dates for new loans only. Existing loans keep their dates.", "The current term cannot be archived. Set another term as current first.", "Archive rather than delete: archived programs keep old accounts and holdings correct."],
    related: ["users", "loan-policies"],
  },

  "loan-policies": {
    purpose: "Each book type has a loan policy: how long it may be borrowed and the overdue fine. The desk uses this to calculate due dates and fines.",
    screens: [{
      title: "Loan Policies",
      caption: "One row per book type.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tabs tabs tabs", "search search search", "list list drawer"],
      regions: [
        header("Loan Policies", ["Add book type"]),
        { id: "tabs", kind: "tabs", label: "Status", items: ["Active", "Archived", "All"] },
        { id: "search", kind: "search", label: "Search book types" },
        { id: "list", kind: "list", label: "Policies", items: ["Book type", "Loan duration", "Overdue fine", "Assigned books", "⋯"] },
        { id: "drawer", kind: "drawer", label: "Edit policy", items: ["Loan duration (days / hours)", "Overdue fine per day / hour", "Policy preview", "Why are the loan terms changing?"] },
      ],
      callouts: [
        { region: "list", title: "Assigned books", body: "How many titles use this policy. Select the count to open them in Catalog." },
        { region: "drawer", title: "Edit", body: "Set the duration and fine. Policy preview shows an example due date and fine. A reason is required and kept in View policy changes." },
      ],
    }],
    tasks: [
      { title: "Change a fine rate", steps: ["Open the policy’s row menu and choose Edit.", "Change the overdue fine and check the Policy preview.", "Read Impact before saving.", "Explain why the terms are changing and save."], result: "New loans use the new rate. Books already on loan keep the terms they were lent under." },
    ],
    cautions: ["Archiving a policy stops new loans, renewals and reservations for books of that type.", "Delete is only possible for a policy no book has ever used."],
    related: ["catalog", "clearance"],
  },

  "catalog-fields": {
    purpose: "Catalog Fields controls the cataloging form: which fields exist, which materials they apply to, which are required, and which the public catalog shows.",
    screens: [{
      title: "Catalog Fields",
      caption: "Every field on the form, with how often it is used.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "search filters view", "list list list"],
      regions: [
        header("Catalog Fields", ["Add field"]),
        { id: "search", kind: "search", label: "Search field labels or keys" },
        { id: "filters", kind: "pill", label: "Requirement · Origin · Public visibility" },
        { id: "view", kind: "pill", label: "View: Global order / grouped" },
        { id: "list", kind: "list", label: "Fields", items: ["Label / key", "Applies to", "Required", "Public", "Used in"] },
      ],
      callouts: [
        { region: "filters", title: "Filters", body: "Combine requirement, System or Custom origin, and public visibility. Clear filters shows the count of active filters." },
        { region: "view", title: "Order", body: "To reorder fields, choose Global order with All fields and no filters. Moves can be undone." },
        { region: "list", title: "Used in", body: "How many records have a value. Select the number to see them in Catalog. System fields have a lock icon." },
      ],
    }],
    tasks: [
      { title: "Add a custom field", steps: ["Select Add field.", "Enter the label and a permanent key, choose the type and the materials it applies to.", "Decide whether it is required and whether the public catalog shows it.", "Check the form preview and save."] },
    ],
    cautions: ["A field key cannot change after it is created.", "Saving warns you when a change would hide data, narrow the scope or remove options in use.", "Archiving a field keeps every saved value; restoring puts it back at the end of the order."],
    related: ["catalog"],
  },

  "ai-recommendations": {
    purpose: "Reading suggestions on the public catalog depend on each book having a synopsis and up-to-date matching data. This page shows coverage and refreshes that data from online sources.",
    screens: [{
      title: "AI Recommendations",
      caption: "Coverage at the top, the books that need work below.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "tiles tiles tiles", "refresh refresh refresh", "list list list"],
      regions: [
        header("AI Recommendations", ["Refresh book data"]),
        { id: "tiles", kind: "tiles", label: "Book data coverage", items: ["Missing synopsis", "Missing book details", "Missing AI data"] },
        { id: "refresh", kind: "panel", label: "Refresh scope", items: ["All active books / Only missing synopses / Only missing or failed", "Book limit", "No patron data sent"] },
        { id: "list", kind: "list", label: "Books", items: ["☐", "Title", "ISBN", "Status"] },
      ],
      callouts: [
        { region: "tiles", title: "Coverage", body: "Each card is a share of all active books, so one book can count in more than one card. Select a card to filter the list below." },
        { region: "refresh", title: "Refresh scope", body: "Choose which books to process and a limit. The preview shows how many will be sent before you start. Cancel stops after the current book." },
        { region: "list", title: "Manual synopsis", body: "Open a book with no online synopsis to type one. Staff-entered details are never overwritten." },
      ],
    }],
    tasks: [
      { title: "Fill in missing summaries", steps: ["Select Refresh book data.", "Choose Only missing synopses and a book limit, for example 100.", "Read the preview and confirm.", "When it finishes, filter to Missing synopsis and type summaries for what is left."] },
    ],
    cautions: ["Only book data (titles, ISBNs, synopses) is sent to outside services. Patron data is never sent.", "Each run is recorded in Audit Logs."],
    related: ["catalog"],
  },

  backup: {
    purpose: "Backup & Restore keeps copies of all library data. A snapshot is a copy stored in the cloud; a backup file is a copy you download. Restoring replaces current data, so it is guarded by several confirmations.",
    screens: [{
      title: "Backup & Restore",
      caption: "Health first, then the saved copies.",
      columns: "1fr 1fr 1fr",
      areas: ["head head head", "health health files", "list list list"],
      regions: [
        header("Backup & Restore", ["Schedule snapshots", "Save snapshot"]),
        { id: "health", kind: "panel", label: "Backup health", items: ["Last snapshot", "Last verified", "Health details"], tone: "success" },
        { id: "files", kind: "panel", label: "Backup files", items: ["Download current data", "Restore from file"], tone: "danger" },
        { id: "list", kind: "list", label: "Saved snapshots", items: ["Name", "Created", "Size", "Pinned", "Restore"] },
      ],
      callouts: [
        { region: "head", title: "Save and schedule", body: "Save snapshot makes a cloud copy now; add a reason in the notes. Schedule snapshots turns on automatic daily or weekly copies." },
        { region: "health", title: "Health", body: "Warns when the latest snapshot is over 24 hours old. Verify now checks a copy’s checksum and compatibility." },
        { region: "files", title: "Backup files", body: "Download current data saves a portable file; protect it with a password (AES-256-GCM). Restore from file reads one back after review." },
        { region: "list", title: "Snapshots", body: "The 30 newest unpinned snapshots are kept; older ones rotate out. Pin a copy to keep it. Restore is offered only after a copy is verified." },
      ],
    }],
    tasks: [
      { title: "Take a snapshot before a big change", steps: ["Select Save snapshot.", "Name it and write why, for example “Before importing 2026 acquisitions”.", "Save, then pin it from the row menu so it does not rotate out."] },
      { title: "Restore a snapshot", steps: ["Open the snapshot’s row and select Restore.", "Read the impact: what will be removed, what will come back, what will revert.", "Optionally send users an advance notice.", "Type RESTORE and your password, then select Restore and sign out all users."], result: "A safety snapshot of the current data is saved and verified first, so you can restore it to undo this." },
    ],
    cautions: ["Restoring signs everyone out, including you, and replaces all data with the snapshot’s.", "An unencrypted backup file can be read by anyone who has it. Use a password and store it safely."],
    related: ["audit-logs"],
  },
};
