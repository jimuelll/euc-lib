import PublicPageMasthead from "@/components/PublicPageMasthead";

interface AboutHeaderProps { libraryName: string; }

const AboutHeader = ({ libraryName }: AboutHeaderProps) => (
  <PublicPageMasthead
    title="About the Library"
    description={`Our history, mission, staff, and facilities — everything you need to know about ${libraryName}.`}
  />
);

export default AboutHeader;
