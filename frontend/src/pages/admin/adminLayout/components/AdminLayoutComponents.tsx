import { Library, ChevronDown, LogOut, Bell, ExternalLink } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
  SidebarHeader, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { sidebarSections, getInitials, resolveCurrentItem, resolveCurrentSection } from "../AdminLayoutData";

// ── AdminSidebar ──────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const visibleSections = sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(user?.role ?? "")),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{ background: "hsl(var(--sidebar-background))" }}
    >
      {/* ── Brand header ── */}
      <SidebarHeader className="p-0">
        <div className="h-[3px] w-full" style={{ background: "hsl(var(--sidebar-primary))" }} />

        <div className={cn("flex items-center gap-3 px-4 py-4", collapsed && "justify-center px-3")}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center border"
            style={{
              background: "hsl(var(--primary) / 0.18)",
              borderColor: "hsl(var(--primary) / 0.35)",
            }}
          >
            <Library className="h-4 w-4" style={{ color: "hsl(var(--primary-foreground))" }} />
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.18em] leading-none truncate"
                style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--sidebar-foreground))" }}
              >
                EUC Library
              </span>
              <span
                className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--sidebar-foreground) / 0.4)" }}
              >
                Admin Dashboard
              </span>
            </div>
          )}
        </div>

        <div className="h-px mx-0" style={{ background: "hsl(var(--sidebar-border))" }} />

        {/* ── Profile card ── */}
        {!collapsed ? (
          <div className="px-4 py-4 flex items-center gap-3">
            <Avatar
              className="h-9 w-9 shrink-0 border"
              style={{ borderColor: "hsl(var(--sidebar-primary) / 0.3)" }}
            >
              <AvatarFallback
                className="text-[11px] font-bold"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: "hsl(var(--sidebar-primary) / 0.15)",
                  color: "hsl(var(--sidebar-primary))",
                }}
              >
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p
                className="text-[12px] font-bold truncate leading-tight"
                style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--sidebar-foreground))" }}
              >
                {user?.name ?? "Administrator"}
              </p>
              <p
                className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] capitalize"
                style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--sidebar-foreground) / 0.4)" }}
              >
                {user?.role?.replace("_", " ") ?? "Administrator"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-3">
            <Avatar
              className="h-7 w-7 border"
              style={{ borderColor: "hsl(var(--sidebar-primary) / 0.3)" }}
            >
              <AvatarFallback
                className="text-[10px] font-bold"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: "hsl(var(--sidebar-primary) / 0.15)",
                  color: "hsl(var(--sidebar-primary))",
                }}
              >
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <div className="h-px" style={{ background: "hsl(var(--sidebar-border))" }} />
      </SidebarHeader>

      {/* ── Nav ── */}
      <SidebarContent className="px-0 py-2">
        {visibleSections.map((section, sectionIndex) => (
          <SidebarGroup key={section.label} className="p-0">

            {sectionIndex > 0 && (
              <div
                className="mx-3 my-1"
                style={{ height: "1px", background: "hsl(var(--sidebar-border))" }}
              />
            )}

            {!collapsed ? (
              <Collapsible defaultOpen>
                <CollapsibleTrigger
                  className="group flex w-full items-center justify-between px-4 py-2 transition-colors"
                  style={{ color: "hsl(var(--sidebar-foreground) / 0.35)" }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-px w-2 shrink-0"
                      style={{ background: "hsl(var(--sidebar-primary) / 0.5)" }}
                    />
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.25em]"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {section.label}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                      <SidebarMenuItem key={item.title} className="px-2">
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end={item.url === "/admin"}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
                              )}
                              style={({ isActive }: { isActive: boolean }) => ({
                                fontFamily: "var(--font-heading)",
                                color: isActive
                                  ? "hsl(var(--sidebar-primary))"
                                  : "hsl(var(--sidebar-foreground) / 0.65)",
                                background: isActive
                                  ? "hsl(var(--sidebar-primary) / 0.12)"
                                  : "transparent",
                                borderLeft: isActive
                                  ? "2px solid hsl(var(--sidebar-primary))"
                                  : "2px solid transparent",
                              })}
                            >
                              <item.icon className="h-3.5 w-3.5 shrink-0" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              /* Collapsed — icons only */
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title} className="px-1.5">
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/admin"}
                          title={item.title}
                          className="flex items-center justify-center py-2 transition-colors"
                          style={({ isActive }: { isActive: boolean }) => ({
                            color: isActive
                              ? "hsl(var(--sidebar-primary))"
                              : "hsl(var(--sidebar-foreground) / 0.5)",
                            background: isActive
                              ? "hsl(var(--sidebar-primary) / 0.12)"
                              : "transparent",
                          })}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer — logout ── */}
      <SidebarFooter className="p-0">
        <div className="h-px" style={{ background: "hsl(var(--sidebar-border))" }} />
        <div className={cn("p-3", collapsed && "flex justify-center")}>
          <button
            onClick={logout}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors",
              collapsed ? "justify-center" : "w-full",
            )}
            style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--sidebar-foreground) / 0.4)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "hsl(var(--destructive))"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground) / 0.4)"; }}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ── AdminTopbar ───────────────────────────────────────────────────────────────

export function AdminTopbar({ pathname }: { pathname: string }) {
  const current = resolveCurrentItem(pathname);
  const currentSection = current ? resolveCurrentSection(current.url) : undefined;

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/90 backdrop-blur-md px-4">

      {/* Left — trigger + breadcrumb */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />

        <div className="h-4 w-px bg-border" />

        {current && (
          <div className="flex items-center gap-2">
            <div className="h-px w-3 bg-warning shrink-0" />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hidden sm:block"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {currentSection?.label}
            </span>
            <span className="text-muted-foreground/30 hidden sm:block text-xs">/</span>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {current.title}
            </span>
          </div>
        )}
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-colors"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <ExternalLink className="h-3 w-3" />
          <span className="hidden sm:inline">View Site</span>
        </a>

        <div className="h-4 w-px bg-border mx-0.5" />

        <button
          className="relative flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          <span
            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 ring-2 ring-background"
            style={{ background: "hsl(var(--warning))", borderRadius: 0 }}
          />
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
