import { Link } from "react-router-dom";
import { AdminPage, AdminPanel } from "@/features/admin";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import AccountEmailPanel from "../components/AccountEmailPanel";
import SuperAdminProfileEditor from "../components/SuperAdminProfileEditor";
export default function EditProfile() {
 const {user}=useAuth();
 const staff=["staff","admin","super_admin"].includes(user?.role||"");
 const body=<div className="mx-auto max-w-3xl space-y-6"><Link to={staff?"/admin":"/my-library"} className="text-action underline">Back to {staff?"library desk":"My Library"}</Link><AdminPage title="My account" description="Your library identity and email access."><AdminPanel title="Account details"><p className="font-heading text-xl">{user?.name}</p><p className="capitalize">{user?.role.replace(/_/g," ")}</p>{user?.role==="super_admin"&&<SuperAdminProfileEditor/>}<AccountEmailPanel/><Button asChild className="mt-5"><Link to="/change-password">Change password</Link></Button>{user?.role!=="super_admin"&&<p className="mt-4 text-muted-foreground">Contact authorized library staff to update other account details.</p>}</AdminPanel></AdminPage></div>;
 return <div className="min-h-screen bg-background">{!staff&&<Navbar/>}<main data-library-design className="px-4 py-8">{body}</main>{!staff&&<Footer/>}</div>;
}
