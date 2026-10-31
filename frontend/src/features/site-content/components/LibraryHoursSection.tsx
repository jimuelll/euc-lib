import { Clock, MapPin, Mail, Phone } from "@/components/ui/library-glyphs";
import { LazyMotion, m, useReducedMotion } from "framer-motion";
import { useSiteContent } from "../useSiteContent";

const loadMotionFeatures = () => import("@/lib/motion-features").then((module) => module.default);

const hours = [
  { day: "Monday – Friday", time: "7:00 AM – 9:00 PM", open: true  },
  { day: "Saturday",        time: "8:00 AM – 5:00 PM", open: true  },
  { day: "Sunday",          time: "Closed",             open: false },
];

const LibraryHoursSection = () => {
  const reducedMotion = useReducedMotion();
  const { data: content } = useSiteContent();
  const visibleHours = content?.hours || hours;
  const visibleContact = content ? [
    { icon: MapPin, label: "Address", value: content.address }, { icon: Mail, label: "Email", value: content.contact_email }, { icon: Phone, label: "Phone", value: content.contact_phone },
  ].filter(item => item.value?.trim()) : [];
  return (
    <LazyMotion features={loadMotionFeatures}>
    <section id="library-hours" data-library-design className="border-b border-border bg-background py-16 sm:py-20">
      <div className="container px-5 sm:px-8 lg:px-12 xl:px-16">

        {/* ── Section label ── */}
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-9 flex items-center gap-3 sm:mb-11"
        >
          <div className="h-px w-8 bg-warning" />
          <p
            className="homepage-kicker text-primary"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Hours & Location
          </p>
        </m.div>

        <div className="grid gap-0 border-l border-t border-border md:grid-cols-2">

          {/* ── Operating Hours — left column, maroon header band ── */}
          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="border-r border-b border-border flex flex-col"
          >
            {/* Maroon column header */}
            <div className="flex items-center gap-3 bg-primary px-6 py-4 sm:px-8">
              <Clock className="h-4 w-4 text-primary-foreground/60 shrink-0" />
              <h3
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Operating Hours
              </h3>
            </div>

            {/* Hours rows */}
            <div className="flex-1 border-t border-primary/20 px-6 py-4 sm:px-8">
              {visibleHours.map((row, i) => (
                <m.div
                  key={row.day}
                  initial={reducedMotion ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                  className={`flex items-center justify-between gap-4 py-3.5 ${
                    i < visibleHours.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <span className="text-sm text-muted-foreground">{row.day}</span>

                  {row.open ? (
                    <span
                      className="text-[11px] font-bold tracking-[0.1em] uppercase text-foreground"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {row.time}
                    </span>
                  ) : (
                    /* Closed pill — gold, restrained */
                    <span
                      className="px-2.5 py-0.5 text-[9px] font-bold tracking-[0.2em] uppercase border border-warning/40 text-warning/70 bg-warning/8"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Closed
                    </span>
                  )}
                </m.div>
              ))}
            </div>
          </m.div>

          {/* ── Contact Details — right column ── */}
          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="border-r border-b border-border flex flex-col"
          >
            {/* Matching header — neutral so the two panels feel related but distinct */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-6 py-4 sm:px-8">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <h3
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Contact & Location
              </h3>
            </div>

            {/* Contact rows */}
            <div className="flex-1 px-6 py-4 sm:px-8">
              {!visibleContact.length && <p className="py-4 text-sm text-muted-foreground">Contact details are currently unavailable</p>}
              {visibleContact.map((item, i) => {
                const Icon = item.icon;
                return (
                  <m.div
                    key={item.label}
                    initial={reducedMotion ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                    className={`flex items-start gap-4 py-3.5 ${
                      i < visibleContact.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    {/* Icon badge — maroon tinted */}
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-primary/8 border border-primary/15">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>

                    <div className="min-w-0">
                      <p
                        className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/75"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {item.label}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {item.value}
                      </p>
                    </div>
                  </m.div>
                );
              })}
            </div>
          </m.div>

        </div>

        {/* ── Gold bottom rule — sealing the section like a document footer ── */}
        <m.div
          initial={reducedMotion ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="h-[2px] bg-warning/30 origin-left mt-0"
        />

      </div>
    </section>
    </LazyMotion>
  );
};

export default LibraryHoursSection;
