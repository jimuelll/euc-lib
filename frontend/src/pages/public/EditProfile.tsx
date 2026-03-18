import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRole } from "@/hooks/use-role";

const EditProfile = () => {
  const { userName, userInitials } = useRole();

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
