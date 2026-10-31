import { allSidebarItems, canAccessItem } from "@/features/admin/layout/AdminLayoutData";

// Small, eagerly loaded index: the page header help button reads it on every admin page.
// Full walkthroughs live in guide-content.ts and load only with the guide page.

export type GuideSection = "Start here" | "Desk" | "Records" | "Publishing" | "Insights" | "Settings";

export interface GuideTopicIndex {
  id: string;
  title: string;
  section: GuideSection;
  /** Admin page this topic explains. Sub-paths (for example receipts) match too. */
  path?: string;
  extraPaths?: string[];
  summary: string;
  quickTips: string[];
  /** Tips for one tab, keyed by the page's `?tab=` value. */
  tabTips?: Record<string, { label: string; tips: string[] }>;
  defaultTab?: string;
}

export const guideSections: GuideSection[] = ["Start here", "Desk", "Records", "Publishing", "Insights", "Settings"];

export const guideTopics: GuideTopicIndex[] = [
  {
    id: "getting-started",
    title: "Getting around the admin",
    section: "Start here",
    summary: "The sidebar, the top bar, tool search, notifications and your account menu.",
    quickTips: [
      "Press Ctrl K anywhere to search for a tool by name or by a word like “fines” or “holds”.",
      "The sidebar only lists tools your role can open.",
      "Quick tasks in the top bar jump straight to Borrow or Return.",
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    section: "Start here",
    path: "/admin",
    summary: "Today’s desk picture: what is overdue, waiting or due, and the latest transactions.",
    quickTips: [
      "Each tile is a shortcut. Select it to open the filtered list behind the number.",
      "“Unavailable” means the figure could not load. It is never shown as zero.",
      "Use Refresh after a busy period; the page does not update on its own.",
    ],
  },
  {
    id: "borrow-return",
    title: "Borrow & Return",
    section: "Desk",
    path: "/admin/circulation",
    summary: "Check books out and in at the desk, then review every loan in History.",
    defaultTab: "transaction",
    quickTips: [
      "Switch Borrow / Return with the control at the top of the Desk transaction panel.",
      "Confirm stays disabled until everything checks out; the line under it says what is missing.",
      "Ordinary loans and on-time returns can be undone for 60 seconds from the session list.",
    ],
    tabTips: {
      transaction: {
        label: "Desk",
        tips: [
          "Borrow: scan the patron’s ID first, then the copy’s accession number.",
          "Return: just scan the copy. The borrower is found automatically.",
          "A return does not settle fines. Record payment from the return result or in Clearance.",
        ],
      },
      history: {
        label: "History",
        tips: [
          "History opens on Needs action: overdue and due-soon loans first.",
          "Select a summary tile to filter, or search by patron, book, ID or ISBN.",
          "Export downloads every page that matches the current filters as CSV.",
        ],
      },
    },
  },
  {
    id: "reservations",
    title: "Reservations",
    section: "Desk",
    path: "/admin/reservations",
    summary: "Prepare requested books, mark them ready and hand them over at pickup.",
    quickTips: [
      "Work top to bottom: ready pickups with the nearest deadline come first, then the oldest pending requests.",
      "Mark ready only when a copy is on the shelf; the button explains when none is available.",
      "Process pickup opens Borrow with the patron and book already filled in.",
    ],
  },
  {
    id: "clearance",
    title: "Clearance & Fines",
    section: "Desk",
    path: "/admin/clearance",
    summary: "See who still owes books or money, take cash payments and clear patrons.",
    quickTips: [
      "Blocked patrons have overdue items; Fines only patrons returned everything but still owe money.",
      "Record only cash you have already received. A receipt is created automatically.",
      "Adjusting or waiving a fine needs a reason, which is saved to the audit trail.",
    ],
    tabTips: {
      queue: { label: "Review queue", tips: ["Tiles filter the queue: Blocked, Fines only or All.", "Open a row to see the patron’s full clearance record."] },
      patron: { label: "Find a patron", tips: ["Scan a library ID or type a name to open one patron directly.", "Overdue items link straight to the return desk."] },
    },
  },
  {
    id: "attendance",
    title: "Attendance",
    section: "Desk",
    path: "/admin/attendance",
    summary: "Who is inside the library right now, and the record of every completed visit.",
    quickTips: [
      "Today refreshes every 30 seconds while the page is open.",
      "Use Manual entry when a patron cannot use the scanner.",
      "Time out all closes every open visit; use it at closing time only.",
    ],
  },
  {
    id: "users",
    title: "Users",
    section: "Records",
    path: "/admin/users",
    summary: "Find patrons and staff, create accounts, and control who may borrow.",
    quickTips: [
      "Search by name or library ID; filters for role and borrowing access are under Filters.",
      "New accounts get an invitation email and stay locked until the person sets a password.",
      "Inactive means access is off, or the student’s academic term is missing or expired.",
    ],
  },
  {
    id: "catalog",
    title: "Catalog",
    section: "Records",
    path: "/admin/catalog",
    summary: "Book records, their physical copies, accession numbers and labels.",
    quickTips: [
      "A record describes the title; copies are the physical books that can be lent.",
      "Needs holdings lists titles with no lendable, accessioned copy yet.",
      "Scan an ISBN into the search box to find a title instantly.",
    ],
    tabTips: {
      records: { label: "Records", tips: ["Open a record to edit details or manage its copies.", "Add record can fill details from an ISBN lookup."] },
      holdings: { label: "Holdings", tips: ["Holdings lists every physical copy across the catalog.", "Select a copy to edit its accession number, condition or location."] },
    },
  },
  {
    id: "website-content",
    title: "Website Content",
    section: "Publishing",
    path: "/admin/content",
    summary: "Edit the public homepage, About page, bulletin, events, subscriptions and library notes.",
    quickTips: [
      "Save draft keeps changes private; nothing is public until you choose Publish.",
      "A dot on a tab means unsaved edits; a number means saved drafts waiting to publish.",
      "Preview shows the page as visitors will see it, at phone or desktop width.",
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    section: "Publishing",
    path: "/admin/notifications",
    summary: "Send announcements to patrons and check the automatic alerts the system sends.",
    quickTips: [
      "New notification lets you target everyone, a role, or specific patrons.",
      "The recipient count is live; check it before sending.",
      "Failed lists messages that could not be delivered, with Resend in the row menu.",
    ],
  },
  {
    id: "email-deliveries",
    title: "Email Deliveries",
    section: "Publishing",
    path: "/admin/library-emails",
    extraPaths: ["/admin/account-emails"],
    summary: "Check whether library and account emails were queued, accepted and delivered.",
    quickTips: [
      "Search by recipient address, delivery ID or Brevo message ID.",
      "The daily allowance is shared; account and security emails have a reserve.",
      "Open a row to see each attempt and the provider’s response.",
    ],
  },
  {
    id: "moderation",
    title: "Moderation",
    section: "Publishing",
    path: "/admin/moderation",
    summary: "Review bulletin comments that readers reported or the screening held back.",
    quickTips: [
      "Read the conversation context before deciding.",
      "Hide comment sends your reason to the author.",
      "Dismiss reports closes the case and leaves the comment visible.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    section: "Insights",
    path: "/admin/analytics",
    summary: "Charts of borrowing, visitors and the collection, plus an AI-written report.",
    quickTips: [
      "The date range at the top applies to every activity chart and to the AI Report.",
      "Inventory figures are current snapshots and ignore the date range.",
      "Use the Verify links to check a number against the source records.",
    ],
  },
  {
    id: "reports",
    title: "Reports",
    section: "Insights",
    path: "/admin/reports",
    summary: "Look up any record across the system, or produce a formal report to print or export.",
    defaultTab: "explore",
    quickTips: [
      "Explore Records is a live lookup; Reports builds institutional outputs.",
      "Exports use your chosen columns and every matching record (up to 10,000 rows).",
      "Saved presets are stored in this browser only.",
    ],
  },
  {
    id: "audit-logs",
    title: "Audit Logs",
    section: "Insights",
    path: "/admin/audit-logs",
    summary: "A read-only record of who changed what, and when.",
    quickTips: [
      "Filters apply instantly and stay in the address bar, so you can share a link.",
      "Expand an event to see the before and after values.",
      "Sign-ins and sign-outs are hidden unless you turn them on.",
    ],
  },
  {
    id: "academic-calendar",
    title: "Academic Calendar",
    section: "Settings",
    path: "/admin/settings/academic",
    summary: "Terms, programs, holidays and departments the rest of the system relies on.",
    defaultTab: "terms",
    quickTips: [
      "The current term decides which student accounts are active.",
      "Active holidays push due dates for new loans; existing loans keep theirs.",
      "Archive instead of delete when an entry is still referenced.",
    ],
  },
  {
    id: "loan-policies",
    title: "Loan Policies",
    section: "Settings",
    path: "/admin/settings/loan-policies",
    summary: "Loan length and overdue fine for each book type.",
    quickTips: [
      "Changes apply to new loans only. Existing loans keep their saved terms.",
      "Every change asks for a reason, which is kept in the policy history.",
      "The policy preview shows the due date and fine before you save.",
    ],
  },
  {
    id: "catalog-fields",
    title: "Catalog Fields",
    section: "Settings",
    path: "/admin/settings/catalog-fields",
    summary: "The fields on the cataloging form and which ones the public catalog shows.",
    quickTips: [
      "A field’s key is permanent once created; the label can change.",
      "Archiving keeps existing values; nothing is deleted from records.",
      "Reorder only in Global order view with no filters applied.",
    ],
  },
  {
    id: "ai-recommendations",
    title: "AI Recommendations",
    section: "Settings",
    path: "/admin/settings/ai",
    summary: "Keep book summaries and matching data current so reading suggestions stay useful.",
    quickTips: [
      "Only book data is sent to outside services. No patron data is sent.",
      "Preview the scope before refreshing; start small with a book limit.",
      "Books with no ISBN or no online synopsis need a summary typed by staff.",
    ],
  },
  {
    id: "backup",
    title: "Backup & Restore",
    section: "Settings",
    path: "/admin/settings/backup",
    summary: "Save cloud snapshots of library data and restore one if something goes wrong.",
    quickTips: [
      "Save a snapshot before any large import or clean-up.",
      "Restoring replaces current data and signs everyone out.",
      "A safety snapshot is saved first, so a restore can itself be undone.",
    ],
  },
];

const sidebarItemFor = (path?: string) => (path ? allSidebarItems.find(item => item.url === path) : undefined);

export const canReadTopic = (topic: GuideTopicIndex, role?: string) => {
  const item = sidebarItemFor(topic.path);
  return !item || canAccessItem(item, role);
};

/** Roles that can open the page a topic explains, or undefined when everyone can. */
export const topicRoles = (topic: GuideTopicIndex) => sidebarItemFor(topic.path)?.roles;

const matches = (pathname: string, path: string) => pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));

export function findTopicForPath(pathname: string) {
  return guideTopics.find(topic => [topic.path, ...(topic.extraPaths ?? [])].some(path => path && matches(pathname, path)));
}

export const guideTopicHref = (id: string) => `/admin/user-guide?topic=${encodeURIComponent(id)}`;
