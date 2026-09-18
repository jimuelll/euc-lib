import SectionLabel from "./ui/SectionLabel";
import SectionHeading from "./ui/SectionHeading";

interface MissionHistoryProps {
  missionTitle: string;
  missionText: string;
  historyTitle: string;
  historyText: string;
}

const MissionHistory = ({
  missionTitle,
  missionText,
  historyTitle,
  historyText,
}: MissionHistoryProps) => (
  <div className="border-b border-border">
    <div className="container px-4 sm:px-6">
      <div className="grid md:grid-cols-2 border-l border-t border-border">
        <div className="border-r border-b border-border bg-background p-8 md:p-10">
          <SectionLabel>Mission & Vision</SectionLabel>
          <SectionHeading>{missionTitle}</SectionHeading>
          <p className="text-sm text-muted-foreground leading-relaxed">{missionText}</p>
        </div>
        <div className="border-r border-b border-border bg-background p-8 md:p-10">
          <SectionLabel>Library History</SectionLabel>
          <SectionHeading>{historyTitle}</SectionHeading>
          <p className="text-sm text-muted-foreground leading-relaxed">{historyText}</p>
        </div>
      </div>
    </div>
  </div>
);

export default MissionHistory;