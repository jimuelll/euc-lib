import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import useAboutSettings from "./hooks/useAboutSettings";
import AboutHeader from "./components/AboutHeader";
import MissionHistory from "./components/MissionHistory";
import PoliciesFacilities from "./components/PoliciesFacilities";
import StaffGrid from "./components/StaffGrid";
import SpacesGrid from "./components/SpacesGrid";

const LoadingIndicator = () => (
  <div className="container px-4 sm:px-6 py-16 flex items-center justify-center">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="h-3 w-3 rounded-full bg-warning/60 animate-pulse" />
      Loading page content…
    </div>
  </div>
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

      <main className="bg-background">
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