import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import PasswordChangeModal from "./PasswordChangeModal";

const PasswordChangeGate = () => {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading || !user?.must_change_password || location.pathname === "/change-password") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/88 backdrop-blur-sm px-4">
      <PasswordChangeModal
        title="Password Update Required"
        description="Your account is signed in, but library features stay locked until you change your password."
      />
    </div>
  );
};

export default PasswordChangeGate;
