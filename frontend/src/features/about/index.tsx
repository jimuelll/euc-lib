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
export { default as AboutPreviewSection } from "./components/AboutPreviewSection";

export default function About() {
  const { data, loading, error, retry } = useAboutSettings();
  const mission = !!data?.mission_text?.trim();
  const history = !!data?.history_text?.trim();
  const policies = data?.policies ?? [];
  const facilities = data?.facilities ?? [];
  const staff = data?.staff ?? [];
  const spaces = data?.spaces ?? [];
  const hasContent = mission || history || policies.length || facilities.length || staff.length || spaces.length;
  return <div className="min-h-screen bg-background">
    <Navbar />
    <main data-library-design className="library-information-page">
      <div className="library-information-inner">
        <AboutHeader libraryName={data?.library_name || "Enverga-Candelaria Library"} />
        {loading ? <div className="py-16"><ContentCardsSkeleton cards={3} /></div> : <>
          {error && <div className="service-error" role="alert">
            <p>{data ? "Library information could not be refreshed. Showing previously loaded information." : "Library information could not be loaded."}</p>
            <button className="service-link" onClick={() => void retry()}>Try again</button>
          </div>}
          {!hasContent && !error && <p className="service-empty">Library information has not been published yet.</p>}
          {!!hasContent && data && <div className="library-about-layout">
            <nav className="library-about-rail" aria-label="On this page">
              {mission && <a href="#about-mission">{data.mission_title || "Mission & vision"}</a>}
              {history && <a href="#about-history">{data.history_title || "Library history"}</a>}
              {(policies.length > 0 || facilities.length > 0) && <a href="#about-rules">Library rules and resources</a>}
              {staff.length > 0 && <a href="#about-staff">Meet the team</a>}
              {spaces.length > 0 && <a href="#about-spaces">Our facilities</a>}
            </nav>
            <div className="library-about-content">
              <MissionHistory missionTitle={data.mission_title || "Mission & vision"} missionText={data.mission_text || ""} historyTitle={data.history_title || "Library history"} historyText={data.history_text || ""} />
              <PoliciesFacilities policies={policies} facilities={facilities} />
              <StaffGrid staff={staff} />
              <SpacesGrid spaces={spaces} />
            </div>
          </div>}
        </>}
      </div>
    </main>
    <Footer />
  </div>;
}
