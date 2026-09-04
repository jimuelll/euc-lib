import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarCheck, GraduationCap, Library } from "lucide-react";
import { motion } from "framer-motion";

const quickLinks = [
  { title: "Find Resources", description: "Explore books, journals, and digital materials.", to: "/catalogue", icon: BookOpen, index: "01", label: "Search" },
  { title: "Plan Ahead", description: "Reserve library materials before you visit.", to: "/login", icon: CalendarCheck, index: "02", label: "Reserve" },
  { title: "Learn Without Limits", description: "Access services and academic subscriptions.", to: "/services", icon: GraduationCap, index: "03", label: "Access" },
  { title: "Library Services", description: "Get help with borrowing, research, and more.", to: "/services", icon: Library, index: "04", label: "Support" },
];

const QuickAccessSection = () => (
  <section className="border-b border-border bg-background">
    <div className="container px-5 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid border-l border-border md:grid-cols-[.86fr_1fr_1fr_1fr_1fr]">
        <div className="border-r border-border px-5 py-8 sm:px-7 lg:py-10">
          <p className="homepage-kicker flex items-center gap-3 text-primary"><span className="h-px w-7 bg-warning" />Our Services</p>
          <h2 className="mt-4 text-2xl font-bold tracking-[-.05em] text-foreground">Designed for every<br />academic step.</h2>
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">Search, reserve, access, and get support in one place.</p>
        </div>
        {quickLinks.map(({ title, description, to, icon: Icon, index, label }) => (
          <motion.div key={title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .35 }} className="border-r border-border">
            <Link to={to} className="group flex h-full min-h-[210px] flex-col px-5 py-8 transition-colors hover:bg-primary sm:px-7 lg:py-10">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-[.18em] uppercase text-muted-foreground group-hover:text-white/65"><span>{index} / {label}</span><Icon className="h-4 w-4 text-warning" /></div>
              <h3 className="mt-auto text-lg font-bold leading-[1.03] tracking-[-.045em] text-foreground transition-colors group-hover:text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground transition-colors group-hover:text-white/75">{description}</p>
              <ArrowRight className="mt-6 h-4 w-4 text-warning transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default QuickAccessSection;
