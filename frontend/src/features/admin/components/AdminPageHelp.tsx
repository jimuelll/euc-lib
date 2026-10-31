import { Link, useInRouterContext, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findTopicForPath, guideTopicHref } from "@/features/user-guide/guide-index";
import { AdminIcon } from "./AdminIcon";

/** Round "i" beside a page title with the key points for that page and its current tab. */
export function AdminPageHelp() {
  return useInRouterContext() ? <PageHelpPopover /> : null;
}

function PageHelpPopover() {
  const location = useLocation();
  const topic = location.pathname === "/admin/user-guide" ? undefined : findTopicForPath(location.pathname);
  if (!topic) return null;
  const tab = new URLSearchParams(location.search).get("tab") ?? topic.defaultTab;
  const tabHelp = tab ? topic.tabTips?.[tab] : undefined;
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="admin-page-help-trigger" aria-label={`Help for ${topic.title}`} title="Help for this page">
        <AdminIcon name="information" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} className="admin-page-help">
      <p className="admin-page-help-eyebrow">Page help</p>
      <h2>{topic.title}</h2>
      <p className="admin-page-help-summary">{topic.summary}</p>
      {tabHelp && <section aria-label={`${tabHelp.label} tab`}>
        <h3>On the {tabHelp.label} tab</h3>
        <ul>{tabHelp.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>
      </section>}
      <section aria-label="Key points">
        <h3>Key points</h3>
        <ul>{topic.quickTips.map(tip => <li key={tip}>{tip}</li>)}</ul>
      </section>
      <Link className="admin-page-help-link" to={guideTopicHref(topic.id)}>
        Open full guide with screen map
        <AdminIcon name="arrowRight" />
      </Link>
    </PopoverContent>
  </Popover>;
}
