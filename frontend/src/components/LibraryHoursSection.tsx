import { Clock, MapPin, Mail, Phone } from "lucide-react";
import { motion } from "framer-motion";

const contactItems = [
  [
    {
      icon: Clock,
      title: "Operating Hours",
      content: (
        <div className="space-y-1">
          <p>Monday – Friday: 7:00 AM – 9:00 PM</p>
          <p>Saturday: 8:00 AM – 5:00 PM</p>
          <p>Sunday: Closed</p>
        </div>
      ),
    },
    { icon: MapPin, title: "Address", content: <p>123 University Avenue, Building C, 2nd Floor</p> },
  ],
  [
    { icon: Mail, title: "Email", content: <p>library@college.edu</p> },
    { icon: Phone, title: "Phone", content: <p>(555) 123-4567</p> },
  ],
];

const LibraryHoursSection = () => {
  return (
    <section className="py-24">
      <div className="container">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="font-heading text-2xl font-semibold text-foreground"
        >
          Library Hours & Location
        </motion.h2>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {contactItems.map((col, colIdx) => (
            <div key={colIdx} className="space-y-4">
              {col.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: colIdx === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.15 }}
                    whileHover={{ x: 4 }}
                    className="group flex items-start gap-3 rounded-lg p-3 -mx-3 transition-colors hover:bg-accent/50"
                  >
                    <motion.div
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Icon className="mt-0.5 h-5 w-5 text-primary" />
                    </motion.div>
                    <div>
                      <h3 className="font-heading text-sm font-medium text-foreground">{item.title}</h3>
                      <div className="mt-1 text-sm text-muted-foreground">{item.content}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LibraryHoursSection;
