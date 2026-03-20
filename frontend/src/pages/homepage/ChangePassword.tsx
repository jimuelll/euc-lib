import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const ChangePassword = () => {
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { changePassword, user, loading: authLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await changePassword(oldPassword, newPassword);
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  // Wait for auth to settle before rendering anything
  if (authLoading) return null;

  // Not logged in — send to login
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Blurred background */}
      <div className="pointer-events-none select-none opacity-40 blur-[2px]">
        <Navbar />
        <main className="flex items-center justify-center py-24 px-4">
          <p className="text-muted-foreground">System Locked</p>
        </main>
        <Footer />
      </div>

      {/* Fullscreen modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
          <div className="text-center">
            <Lock className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
              Change Password
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You must update your password before continuing
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm">Current Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="h-11 w-full rounded-md border bg-background px-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showOld ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm">New Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 w-full rounded-md border bg-background px-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showNew ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-md border bg-background px-3"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" size="lg" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;