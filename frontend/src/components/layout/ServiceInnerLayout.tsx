import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "@/components/ui/library-glyphs";
import Navbar from "./Navbar";
import Footer from "./Footer";
import "./services-inner.css";

export default function ServiceInnerLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="min-h-screen bg-background"><Navbar />
    <main data-library-design className="service-inner-page"><div className="service-inner-container">
      <Link className="service-back" to="/services"><ArrowLeft aria-hidden="true" />Back to services</Link>
      <header className="service-inner-heading"><h1>{title}</h1><p>{description}</p></header>
      {children}
    </div></main><Footer />
  </div>;
}
