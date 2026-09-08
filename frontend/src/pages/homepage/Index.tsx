import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import QuickAccessSection from "@/components/QuickAccessSection";
import LibraryHoursSection from "@/components/LibraryHoursSection";
import AboutPreviewSection from "@/components/AboutPreviewSection";
import { AnnouncementsSection } from "@/pages/homepage/bulletin/AnnouncementsSection";
import { RecommendationStrip } from "@/components/recommendations/RecommendationStrip";
import { useAuth } from "@/context/AuthContext";

const Index = () => {
  const { user } = useAuth();
  return (
    <div className="homepage-shell min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <QuickAccessSection />
        {user ? <div className="border-b border-border bg-secondary/20"><div className="container px-5 py-8 sm:px-8 lg:px-12 xl:px-16"><div className="space-y-5"><RecommendationStrip personal materialType="book" /><RecommendationStrip personal materialType="thesis" /></div></div></div> : null}
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
