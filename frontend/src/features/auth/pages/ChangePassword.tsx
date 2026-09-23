import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PasswordChangeModal from "@/features/auth/components/PasswordChangeModal";
import { useAuth } from "@/context/AuthContext";
import { Link, Navigate } from "react-router-dom";

const ChangePassword = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (["staff", "admin", "super_admin"].includes(user.role)) return <main className="mx-auto max-w-lg px-4 py-8">{!user.must_change_password && <Link to="/admin" className="mb-6 inline-block text-sm text-action">Back to library desk</Link>}<PasswordChangeModal description={user.must_change_password ? "Update your password to unlock the rest of the system." : "Choose a new password for your library account."} /></main>;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="pointer-events-none select-none opacity-30 blur-[3px]">
        <Navbar />
        <main className="flex items-center justify-center py-24 px-4">
          <p className="text-muted-foreground">Account Security</p>
        </main>
        <Footer />
      </div>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm px-4">
        <PasswordChangeModal
          description={
            user.must_change_password
              ? "Update your password to unlock the rest of the system."
              : "You can update your password here whenever you need to."
          }
        />
      </div>
    </div>
  );
};

export default ChangePassword;
