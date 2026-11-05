import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminIcon, AdminPage } from "@/features/admin";
import { guideContent } from "../guide-content";
import { canReadTopic, guideSections, guideTopicHref, guideTopics, topicRoles, type GuideTopicIndex } from "../guide-index";
import { GuideScreenMap } from "../components/GuideScreenMap";
import "../user-guide.css";

const roleNames: Record<string, string> = { staff: "Staff", admin: "Administrators", super_admin: "Super administrators" };

const describeRoles = (topic: GuideTopicIndex) => {
  const roles = topicRoles(topic);
  return roles ? `${roles.map(role => roleNames[role] ?? role).join(" and ")} only` : "Everyone with admin access";
};

const searchText = (topic: GuideTopicIndex) => {
  const content = guideContent[topic.id];
  return [
    topic.title, topic.summary, ...topic.quickTips, content?.purpose,
    ...(content?.tasks.flatMap(task => [task.title, task.when, ...task.steps, task.result]) ?? []),
    ...(content?.terms?.flatMap(term => [term.term, term.meaning]) ?? []),
    ...(content?.screens.flatMap(screen => screen.callouts.flatMap(callout => [callout.title, callout.body])) ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
};

export default function AdminUserGuide() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");

  const topics = useMemo(() => guideTopics.filter(topic => canReadTopic(topic, user?.role)), [user?.role]);
  const requested = params.get("topic");
  const topic = topics.find(item => item.id === requested) ?? topics[0];

  const term = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!term) return topics.map(item => ({ topic: item, tasks: [] as { index: number; title: string }[] }));
    return topics.flatMap(item => {
      const tasks = (guideContent[item.id]?.tasks ?? []).flatMap((task, index) => task.title.toLowerCase().includes(term) ? [{ index, title: task.title }] : []);
      return searchText(item).includes(term) ? [{ topic: item, tasks }] : [];
    });
  }, [term, topics]);

  useEffect(() => {
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else document.getElementById("admin-main")?.scrollTo({ top: 0 });
  }, [requested, location.hash]);

  const position = topic ? topics.indexOf(topic) : -1;
  const previous = position > 0 ? topics[position - 1] : undefined;
  const next = position >= 0 && position < topics.length - 1 ? topics[position + 1] : undefined;

  return <AdminPage title="Help & user guide" description="Walkthroughs for every tool you can open, with annotated screen maps.">
    <div className="guide-layout">
      <nav className="guide-nav" aria-label="Guide topics">
        <label className="guide-search">
          <span className="sr-only">Search the guide</span>
          <AdminIcon name="search" />
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search, e.g. “receipt” or “holiday”" />
        </label>
        <label className="guide-picker">
          <span className="sr-only">Choose a topic</span>
          <select value={topic?.id} onChange={event => navigate(guideTopicHref(event.target.value))}>
            {guideSections.map(section => {
              const inSection = matches.filter(match => match.topic.section === section);
              return inSection.length ? <optgroup key={section} label={section}>{inSection.map(match => <option key={match.topic.id} value={match.topic.id}>{match.topic.title}</option>)}</optgroup> : null;
            })}
          </select>
        </label>
        <div className="guide-nav-list">
          {guideSections.map(section => {
            const inSection = matches.filter(match => match.topic.section === section);
            if (!inSection.length) return null;
            return <section key={section}>
              <h2>{section}</h2>
              <ul>{inSection.map(match => <li key={match.topic.id}>
                <Link to={guideTopicHref(match.topic.id)} aria-current={topic?.id === match.topic.id ? "page" : undefined}>{match.topic.title}</Link>
                {match.tasks.length > 0 && <ul className="guide-nav-tasks">{match.tasks.map(task => <li key={task.index}><Link to={`${guideTopicHref(match.topic.id)}#task-${task.index + 1}`}>{task.title}</Link></li>)}</ul>}
              </li>)}</ul>
            </section>;
          })}
          {term && !matches.length && <p className="guide-nav-empty">Nothing matches “{query.trim()}”. Try a shorter word.</p>}
        </div>
      </nav>

      <div className="guide-main">
        {topic && <GuideTopic topic={topic} />}
        {topic && <nav className="guide-pager" aria-label="Previous and next topic">
          {previous ? <Link to={guideTopicHref(previous.id)}><span>Previous</span>{previous.title}</Link> : <span />}
          {next ? <Link to={guideTopicHref(next.id)} data-next><span>Next</span>{next.title}</Link> : <span />}
        </nav>}
      </div>
    </div>
  </AdminPage>;
}

function GuideTopic({ topic }: { topic: GuideTopicIndex }) {
  const content = guideContent[topic.id];
  return <article className="guide-article" aria-labelledby="guide-topic-title">
    <header className="guide-article-header">
      <p className="guide-eyebrow">{topic.section} · {describeRoles(topic)}</p>
      <h2 id="guide-topic-title">{topic.title}</h2>
      <p className="guide-lead">{content?.purpose ?? topic.summary}</p>
      {topic.path && <Button asChild variant="outline"><Link to={topic.path}>Open {topic.title}<AdminIcon name="arrowRight" /></Link></Button>}
    </header>

    <section className="guide-keypoints" aria-labelledby="guide-keypoints">
      <h3 id="guide-keypoints">Key points</h3>
      <ul>{topic.quickTips.map(tip => <li key={tip}>{tip}</li>)}</ul>
    </section>

    {content?.screens.map((screen, index) => <section key={screen.title} className="guide-block" aria-label={`Screen map: ${screen.title}`}>
      {index === 0 && <h3>Screen map</h3>}
      <p className="guide-block-hint">Hover or tab through a callout to highlight that part of the screen.</p>
      <GuideScreenMap screen={screen} />
    </section>)}

    {content && content.tasks.length > 0 && <section className="guide-block" aria-labelledby="guide-tasks">
      <h3 id="guide-tasks">How to…</h3>
      <div className="guide-tasks">
        {content.tasks.map((task, index) => <section key={task.title} id={`task-${index + 1}`} className="guide-task" aria-labelledby={`task-${index + 1}-title`}>
          <h4 id={`task-${index + 1}-title`}>{task.title}</h4>
          {task.when && <p className="guide-task-when">{task.when}</p>}
          <ol>{task.steps.map((step, stepIndex) => <li key={step}><span aria-hidden="true">{stepIndex + 1}</span><p>{step}</p></li>)}</ol>
          {task.result && <p className="guide-task-result"><AdminIcon name="clearance" /><span><strong>What happens next: </strong>{task.result}</span></p>}
        </section>)}
      </div>
    </section>}

    {content?.terms && <section className="guide-block" aria-labelledby="guide-terms">
      <h3 id="guide-terms">What the labels mean</h3>
      <dl className="guide-terms">{content.terms.map(item => <div key={item.term}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl>
    </section>}

    {content?.cautions && <section className="guide-cautions" aria-labelledby="guide-cautions">
      <h3 id="guide-cautions"><AdminIcon name="warning" />Before you rely on it</h3>
      <ul>{content.cautions.map(caution => <li key={caution}>{caution}</li>)}</ul>
    </section>}

    {content?.related && <section className="guide-related" aria-labelledby="guide-related">
      <h3 id="guide-related">Related</h3>
      <ul>{content.related.flatMap(id => guideTopics.find(item => item.id === id) ?? []).map(item => <li key={item.id}><Link to={guideTopicHref(item.id)}>{item.title}</Link></li>)}</ul>
    </section>}
  </article>;
}
