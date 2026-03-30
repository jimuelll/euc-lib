import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface PasswordChangeModalProps {
  title?: string;
  description?: string;
}

const PasswordChangeModal = ({
  title = "Change Password",
  description = "Update your password to unlock the rest of the system.",
}: PasswordChangeModalProps) => {
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { changePassword } = useAuth();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Complete all password fields first.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await changePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="bg-primary relative overflow-hidden">
        <div className="h-[3px] w-full bg-warning" />
        <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-px bg-black/30" />

        <div className="relative z-10 px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="h-3.5 w-3.5 text-warning shrink-0" />
            <span
              className="text-[9px] font-bold uppercase tracking-[0.3em] text-warning"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Security Checkpoint
            </span>
          </div>
          <h1
            className="text-xl font-bold text-primary-foreground leading-tight"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
          >
            {title}
          </h1>
          <p className="mt-1.5 text-[12px] text-primary-foreground/45 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border border-border border-t-0 bg-card divide-y divide-border">
        <div className="px-6 pt-5 pb-4">
          <label
            className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
            htmlFor="old-password"
          >
            Current Password <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              id="old-password"
              type={showOld ? "text" : "password"}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              className="h-10 w-full border border-border bg-background px-3.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowOld((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              aria-label={showOld ? "Hide password" : "Show password"}
            >
              {showOld ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="px-6 pt-4 pb-4">
          <label
            className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
            htmlFor="new-password"
          >
            New Password <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              className="h-10 w-full border border-border bg-background px-3.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowNew((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="px-6 pt-4 pb-5">
          <label
            className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
            htmlFor="confirm-password"
          >
            Confirm New Password <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
              className="h-10 w-full border border-border bg-background px-3.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex gap-0">
            <div className="w-[3px] bg-destructive shrink-0" />
            <p
              className="flex-1 px-4 py-3 text-[11px] text-destructive bg-destructive/[0.04] leading-relaxed"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
            >
              {error}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {loading ? (
            <>
              <span className="inline-block h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Updating...
            </>
          ) : (
            "Update Password"
          )}
        </button>
      </form>
    </div>
  );
};

export default PasswordChangeModal;
