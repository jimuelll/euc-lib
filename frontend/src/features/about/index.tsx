import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import useAboutSettings from "./hooks/useAboutSettings";
import AboutHeader from "./components/AboutHeader";
import MissionHistory from "./components/MissionHistory";
import PoliciesFacilities from "./components/PoliciesFacilities";
import StaffGrid from "./components/StaffGrid";
import SpacesGrid from "./components/SpacesGrid";
import { ContentCardsSkeleton } from "@/components/ui/content-skeletons";
import "@/components/layout/library-pages.css";

export * from "./api/about.service";
export { default as AdminAbout } from "./admin/Index";
export { default as AboutPreviewSection } from "./components/AboutPreviewSection";

const LoadingIndicator = () => (
  <div className="container px-4 py-16 sm:px-6"><ContentCardsSkeleton cards={3} /></div>
);

const About = () => {
  const { data, loading } = useAboutSettings();

  const {
    library_name,
    mission_title,
    mission_text,
    history_title,
    history_text,
    policies,
    facilities,
    staff,
    spaces,
  } = data;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main data-library-design className="library-information-page">
        <div className="library-information-inner">
        <AboutHeader libraryName={library_name} />
        {loading ? (
          <LoadingIndicator />
        ) : (
          <div className="library-about-layout">
            <nav className="library-about-rail" aria-label="On this page">
              <a href="#about-mission">{mission_title}</a>
              <a href="#about-history">{history_title}</a>
              {(policies.length > 0 || facilities.length > 0) && <a href="#about-rules">Library rules and resources</a>}
              {staff.length > 0 && <a href="#about-staff">Meet the team</a>}
              {spaces.length > 0 && <a href="#about-spaces">Our facilities</a>}
            </nav>
            <div className="library-about-content">
            <MissionHistory
              missionTitle={mission_title}
              missionText={mission_text}
              historyTitle={history_title}
              historyText={history_text}
            />
            <PoliciesFacilities policies={policies} facilities={facilities} />
            <StaffGrid staff={staff} />
            <SpacesGrid spaces={spaces} />
            </div>
          </div>
        )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
