import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PasswordChangeModal from "@/components/auth/PasswordChangeModal";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const ChangePassword = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

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
