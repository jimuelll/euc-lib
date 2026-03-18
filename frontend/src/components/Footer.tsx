import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t bg-card">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <BookOpen className="h-5 w-5 text-primary" />
              College Library
            </div>
            <p className="text-sm text-muted-foreground">
              Modernizing library operations through digital solutions for students and staff.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-heading text-sm font-semibold text-foreground">Quick Links</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/services" className="hover:text-foreground transition-colors">Services</Link>
              <Link to="/catalogue" className="hover:text-foreground transition-colors">Catalogue</Link>
            </nav>
          </div>

          <div className="space-y-3">
            <h4 className="font-heading text-sm font-semibold text-foreground">Resources</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/bulletin" className="hover:text-foreground transition-colors">Bulletin</Link>
              <Link to="/login" className="hover:text-foreground transition-colors">Login</Link>
              <span className="cursor-default">Privacy Policy</span>
              <span className="cursor-default">Terms of Use</span>
            </nav>
          </div>

          <div className="space-y-3">
            <h4 className="font-heading text-sm font-semibold text-foreground">Contact</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>123 University Avenue</p>
              <p>library@college.edu</p>
              <p>(555) 123-4567</p>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} College Library Management System. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
