import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import useAboutSettings from "./hooks/useAboutSettings";
import AboutHeader from "./components/AboutHeader";
import MissionHistory from "./components/MissionHistory";
import PoliciesFacilities from "./components/PoliciesFacilities";
import StaffGrid from "./components/StaffGrid";
import SpacesGrid from "./components/SpacesGrid";
import { ContentCardsSkeleton } from "@/components/ui/content-skeletons";

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

      <AboutHeader libraryName={library_name} />

      <main className="bg-background pt-7 sm:pt-8">
        {loading ? (
          <LoadingIndicator />
        ) : (
          <>
            <MissionHistory
              missionTitle={mission_title}
              missionText={mission_text}
              historyTitle={history_title}
              historyText={history_text}
            />
            <PoliciesFacilities policies={policies} facilities={facilities} />
            <StaffGrid staff={staff} />
            <SpacesGrid spaces={spaces} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default About;
