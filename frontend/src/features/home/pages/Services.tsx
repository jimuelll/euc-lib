import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap } from "@/components/ui/library-glyphs";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";
import "@/components/layout/library-pages.css";

const services = [
  { icon: BookOpen, title: "Borrowing & Reservation", description: "Manage your book borrowing activity and reservations through your library account.", link: "/services/borrowing" },
  { icon: GraduationCap, title: "Academic Subscriptions", description: "Explore academic resources and research materials through your library account.", link: "/services/subscriptions" },
];
const steps = [["Sign in", "Use your library account"], ["Find a book", "Search the catalogue"], ["Reserve", "Hold it for pickup"], ["Pick up", "At the circulation desk"]];

export default function Services() {
  const { isLoggedIn } = useAuth();
  return <div className="min-h-screen bg-background">
    <Navbar />
    <main data-library-design className="library-information-page"><div className="library-information-inner">
      <header className="library-information-heading"><div className="library-information-kicker">EUC Library</div><h1>Library services</h1><p>Explore the services that support your academic journey.</p></header>
      {!isLoggedIn && <div className="library-service-note"><p>Services below need a library account.</p><Link to="/login" className="library-information-button is-outline">Sign in</Link></div>}
      <div className="library-service-list">{services.map(({ icon: Icon, title, description, link }) => <article className="library-service-row" key={title}>
        <div className="library-service-plate" aria-hidden="true"><Icon /></div>
        <div><h2>{title}</h2><p>{description}</p></div>
        <Link to={isLoggedIn ? link : "/login"} className="library-information-button" aria-label={`${isLoggedIn ? "Open" : "Sign in to open"} ${title}`}>{isLoggedIn ? "Open" : "Sign in to open"}<ArrowRight aria-hidden="true" /></Link>
      </article>)}</div>
      <section className="library-borrowing-guide" aria-labelledby="borrowing-guide-title">
        <h2 id="borrowing-guide-title" className="library-information-section-title">How borrowing works</h2>
        <ol className="library-borrowing-steps">{steps.map(([title, description], index) => <li key={title}><b aria-hidden="true">{index + 1}</b><span>{title}</span><small>{description}</small></li>)}</ol>
      </section>
    </div></main><Footer />
  </div>;
}
