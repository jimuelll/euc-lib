import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import AnnouncementsSection from "@/components/AnnouncementsSection";
import QuickAccessSection from "@/components/QuickAccessSection";
import LibraryHoursSection from "@/components/LibraryHoursSection";
import AboutPreviewSection from "@/components/AboutPreviewSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <QuickAccessSection />
        <AnnouncementsSection />
        <LibraryHoursSection />
        <AboutPreviewSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
