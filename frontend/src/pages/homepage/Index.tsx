import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import QuickAccessSection from "@/components/QuickAccessSection";
import LibraryHoursSection from "@/components/LibraryHoursSection";
import AboutPreviewSection from "@/components/AboutPreviewSection";
import { AnnouncementsSection } from "@/pages/homepage/bulletin/AnnouncementsSection";

const Index = () => {
  return (
    <div className="homepage-shell min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <QuickAccessSection />
        <div className="overflow-hidden border-b border-border bg-secondary/35">
          <div className="container min-w-0 px-5 py-8 sm:px-8 lg:px-12 xl:px-16">
            <div className="grid min-w-0 overflow-hidden border border-border lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <AboutPreviewSection />
            <AnnouncementsSection />
            </div>
          </div>
        </div>
        <LibraryHoursSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
