interface MissionHistoryProps { missionTitle: string; missionText: string; historyTitle: string; historyText: string; }

export default function MissionHistory({ missionTitle, missionText, historyTitle, historyText }: MissionHistoryProps) {
  return <>{[
    ["about-mission", "Mission & vision", missionTitle, missionText],
    ["about-history", "Library history", historyTitle, historyText],
  ].filter(([, , , text]) => text.trim()).map(([id, label, title, text]) => <section className="library-about-chapter" id={id} key={id} aria-labelledby={id + "-title"}>
    <div className="library-information-kicker">{label}</div>
    <h2 className="library-information-section-title" id={id + "-title"}>{title}</h2>
    <div className="library-about-body">{text.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
  </section>)}</>;
}
