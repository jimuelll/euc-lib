import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HeroSection, LibraryHoursSection } from "@/features/site-content";
import { AboutPreviewSection } from "@/features/about";
import { AnnouncementsSection } from "@/features/bulletin/AnnouncementsSection";
import { RecommendationStrip } from "@/features/recommendations";
import { useAuth } from "@/context/AuthContext";
import "../home-editorial.css";

const Index = () => {
  const { user } = useAuth();
  return (
    <div className="homepage-shell min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        {user ? <div data-library-design className="border-b border-border bg-secondary/20"><div className="container px-5 py-8 sm:px-8 lg:px-12 xl:px-16"><div className="space-y-5"><RecommendationStrip personal materialType="book" /><RecommendationStrip personal materialType="thesis" /></div></div></div> : null}
        <div data-library-design className="overflow-hidden border-b border-border bg-secondary/35">
          <div className="container min-w-0 px-5 py-8 sm:px-8 lg:px-12 xl:px-16">
            <div className="home-editorial grid min-w-0 overflow-hidden border border-border">
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
