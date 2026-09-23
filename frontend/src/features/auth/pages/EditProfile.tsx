import { Link } from "react-router-dom";
import { AdminPage, AdminPanel } from "@/features/admin";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";

const EditProfile = () => {
  const { user } = useAuth();

  const userName = user?.name ?? "Library User";
  const userInitials = userName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (["staff", "admin", "super_admin"].includes(user?.role ?? "")) return <main className="mx-auto max-w-3xl px-4 py-8"><Link to="/admin" className="mb-6 inline-block text-sm text-action">Back to library desk</Link><AdminPage title="My account" description="Your signed-in library account."><AdminPanel title="Account details"><dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Name</dt><dd className="mt-1 font-medium">{userName}</dd></div><div><dt className="text-sm text-muted-foreground">Role</dt><dd className="mt-1 font-medium capitalize">{user?.role.replace(/_/g, " ")}</dd></div></dl><p className="mt-6 text-sm text-muted-foreground">Contact an authorized administrator to update your account details.</p><Button asChild className="mt-5"><Link to="/change-password">Change password</Link></Button></AdminPanel></AdminPage></main>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-lg">
          <div className="flex items-center gap-3">
            <UserCog className="h-6 w-6 text-primary" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Edit Profile</h1>
          </div>

          <div className="mt-8 rounded-lg border bg-card p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading font-semibold text-foreground">{userName}</p>
                <Button variant="outline" size="sm" className="mt-1 text-xs">
                  Change Avatar
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <Input defaultValue={userName} className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input defaultValue="user@college.edu" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">ID Number</label>
                <Input defaultValue="2026-00123" className="mt-1.5" disabled />
              </div>
            </div>

            <Button className="w-full">Save Changes</Button>
            <p className="text-xs text-muted-foreground text-center">
              Profile changes require backend integration.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EditProfile;
