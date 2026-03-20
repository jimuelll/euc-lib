import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { QrCode, CheckCircle2, Camera, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type ScanMode = "idle" | "time-in-success" | "time-out-success";

const ScanQR = () => {
  const [scanState, setScanState] = useState<ScanMode>("idle");

  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateString = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const handleScan = (type: "in" | "out") => {
    setScanState(type === "in" ? "time-in-success" : "time-out-success");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-24">
        <div className="container flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <QrCode className="h-12 w-12 text-primary" />
          </motion.div>
          <h1 className="mt-4 font-heading text-3xl font-bold text-foreground">
            Attendance Scanner
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Scan the library QR code to log your attendance. Choose Time In when arriving and Time Out when leaving.
          </p>

          <div className="mt-10 flex flex-col items-center gap-6">
            {scanState === "idle" ? (
              <>
                <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-card">
                  <span className="absolute top-0 left-0 h-6 w-6 rounded-tl-2xl border-t-4 border-l-4 border-primary" />
                  <span className="absolute top-0 right-0 h-6 w-6 rounded-tr-2xl border-t-4 border-r-4 border-primary" />
                  <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
                  <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-primary" />

                  {/* Scanning line animation */}
                  <motion.div
                    className="absolute left-4 right-4 h-0.5 bg-primary/60 rounded-full"
                    animate={{ top: ["15%", "85%", "15%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />

                  <div className="animate-pulse text-center">
                    <Camera className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Camera preview placeholder
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button size="lg" onClick={() => handleScan("in")} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Time In
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => handleScan("out")} className="gap-2">
                    <LogOut className="h-4 w-4" />
                    Time Out
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Backend integration required for real scanning.
                </p>
              </>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4 rounded-lg border bg-card p-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                >
                  <CheckCircle2 className="h-16 w-16 text-success" />
                </motion.div>
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {scanState === "time-in-success" ? "Time In Recorded!" : "Time Out Recorded!"}
                </h2>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{dateString}</p>
                  <p className="text-lg font-semibold text-foreground">{timeString}</p>
                  <p className="text-xs">
                    {scanState === "time-in-success"
                      ? "Your arrival has been logged. Have a productive visit!"
                      : "Your departure has been logged. See you next time!"}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setScanState("idle")}>
                  Scan Again
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ScanQR;
