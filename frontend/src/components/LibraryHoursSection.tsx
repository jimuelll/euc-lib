import { Clock, MapPin, Mail, Phone } from "lucide-react";
import { motion } from "framer-motion";

const hours = [
  { day: "Monday – Friday", time: "7:00 AM – 9:00 PM", open: true  },
  { day: "Saturday",        time: "8:00 AM – 5:00 PM", open: true  },
  { day: "Sunday",          time: "Closed",             open: false },
];

const contactDetails = [
  { icon: MapPin, label: "Address", value: "123 University Avenue, Building C, 2nd Floor" },
  { icon: Mail,   label: "Email",   value: "library@college.edu"                           },
  { icon: Phone,  label: "Phone",   value: "(555) 123-4567"                                },
];

const LibraryHoursSection = () => {
  return (
    <section className="py-16 sm:py-24 border-t border-border">
      <div className="container px-4 sm:px-6">

        {/* ── Section label ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-10 sm:mb-14"
        >
          <div className="h-px w-6 bg-warning" />
          <p
            className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Hours & Location
          </p>
        </motion.div>

        <div className="grid gap-0 md:grid-cols-2 border-l border-t border-border">

          {/* ── Operating Hours — left column, maroon header band ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="border-r border-b border-border flex flex-col"
          >
            {/* Maroon column header */}
            <div className="flex items-center gap-3 bg-primary px-8 py-5">
              <Clock className="h-4 w-4 text-primary-foreground/60 shrink-0" />
              <h3
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Operating Hours
              </h3>
            </div>

            {/* Hours rows */}
            <div className="flex-1 px-8 py-6 border-t border-primary/20">
              {hours.map((row, i) => (
                <motion.div
                  key={row.day}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                  className={`flex items-center justify-between py-4 gap-4 ${
                    i < hours.length - 1 ? "border-b border-border" : ""
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
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── Contact Details — right column ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="border-r border-b border-border flex flex-col"
          >
            {/* Matching header — neutral so the two panels feel related but distinct */}
            <div className="flex items-center gap-3 bg-muted/60 px-8 py-5 border-b border-border">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <h3
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Contact & Location
              </h3>
            </div>

            {/* Contact rows */}
            <div className="flex-1 px-8 py-6">
              {contactDetails.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                    className={`flex items-start gap-4 py-4 ${
                      i < contactDetails.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    {/* Icon badge — maroon tinted */}
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-primary/8 border border-primary/15">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>

                    <div className="min-w-0">
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-1"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {item.label}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {item.value}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

        </div>

        {/* ── Gold bottom rule — sealing the section like a document footer ── */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="h-[2px] bg-warning/30 origin-left mt-0"
        />

      </div>
    </section>
  );
};

export default LibraryHoursSection;