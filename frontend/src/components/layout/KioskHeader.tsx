import { ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LibraryDesignProvider } from "@/components/ui/library-design";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ThemeToggle from "./ThemeToggle";
import { HeaderBrand, HeaderAvatar } from "./HeaderIdentity";
import { getUserInitials } from "./navbar.utils";
import "./kiosk-layout.css";
export default function KioskHeader({station}:{station:"scanner"|"opac"}) {
  const {user,logout}=useAuth();const label=station==="scanner"?"Scanner":"Catalogue";
  return <LibraryDesignProvider enabled={false}><header className="kiosk-header sticky top-0 z-50 border-b border-primary-foreground/15 bg-primary">
    <div className="h-[3px] w-full bg-warning" />
    <div className="container flex h-14 items-center justify-between gap-2">
      <HeaderBrand to={station==="scanner"?"/scan-qr":"/catalogue"}/>
      <div className="kiosk-header-controls flex items-center gap-0.5 shrink-0">
        <span className="kiosk-station-chip" aria-label={`${label} station`}><span aria-hidden="true"/><span>{label}<span className="hidden sm:inline"> station</span></span></span>
        <div className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"><ThemeToggle/></div>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="flex min-h-11 items-center gap-2 px-2 py-1.5 hover:bg-primary-foreground/10 transition-colors" aria-label={`Account menu: ${user?.name || "Library account"}`}><HeaderAvatar initials={getUserInitials(user?.name)}/><ChevronDown className="h-3 w-3 text-primary-foreground/40" aria-hidden="true"/></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={12} className="rounded-md border-border/60 shadow-lg min-w-[200px]" onCloseAutoFocus={event=>{if(station==="scanner"){const input=document.getElementById('kiosk-scanned-id');if(input){event.preventDefault();input.focus({preventScroll:true});}}}}>
            <div className="px-3 py-2.5 bg-primary border-b border-border/30"><p className="text-[12px] font-bold tracking-[0.1em] uppercase text-primary-foreground" style={{fontFamily:"var(--font-heading)"}}>{user?.name || "Library account"}</p><p className="text-xs text-primary-foreground/80 tracking-[0.15em] uppercase mt-0.5">{station==="scanner"?"Scanner":"OPAC"}</p></div>
            <DropdownMenuItem onSelect={()=>void logout()} className="min-h-11 rounded-md text-[12px] tracking-wide text-destructive focus:text-destructive"><LogOut className="mr-2.5 h-3.5 w-3.5" aria-hidden="true"/>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header></LibraryDesignProvider>;
}
