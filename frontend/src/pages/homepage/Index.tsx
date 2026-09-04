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
        <div className="border-b border-border bg-secondary/35">
          <div className="container grid gap-0 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.25fr)] lg:px-12 xl:px-16">
            <AboutPreviewSection />
            <AnnouncementsSection />
          </div>
        </div>
        <LibraryHoursSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
