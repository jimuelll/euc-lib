import { Library, ChevronDown, LogOut, Bell, ExternalLink } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { sidebarSections, getInitials, resolveCurrentItem, resolveCurrentSection } from "../AdminLayoutData";

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
    <Sidebar collapsible="icon" className="border-r-0" style={{ background: "hsl(var(--sidebar-background))" }}>
      <SidebarHeader className="p-0">
        <div
          className="h-[4px] w-full"
          style={{ background: "linear-gradient(90deg, hsl(var(--sidebar-primary)), hsl(var(--sidebar-primary) / 0.45))" }}
        />

        <div className={cn("flex items-center gap-3 px-4 py-4", collapsed && "justify-center px-3")}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center border"
            style={{
              background: "linear-gradient(180deg, hsl(var(--sidebar-primary) / 0.2), hsl(var(--sidebar-primary) / 0.08))",
              borderColor: "hsl(var(--sidebar-primary) / 0.35)",
            }}
          >
            <Library className="h-4 w-4" style={{ color: "hsl(var(--sidebar-primary))" }} />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex flex-col">
              <span
                className="truncate text-[11px] font-bold uppercase leading-none tracking-[0.18em]"
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

        <div className="mx-0 h-px" style={{ background: "hsl(var(--sidebar-border))" }} />

        {!collapsed ? (
          <div className="flex items-center gap-3 bg-[linear-gradient(180deg,hsl(var(--sidebar-primary)/0.05),transparent)] px-4 py-4">
            <Avatar className="h-9 w-9 shrink-0 border" style={{ borderColor: "hsl(var(--sidebar-primary) / 0.3)" }}>
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
                className="truncate text-[12px] font-bold leading-tight"
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
            <Avatar className="h-7 w-7 border" style={{ borderColor: "hsl(var(--sidebar-primary) / 0.3)" }}>
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

      <SidebarContent className="px-0 py-2">
        {visibleSections.map((section, sectionIndex) => (
          <SidebarGroup key={section.label} className="p-0">
            {sectionIndex > 0 && (
              <div className="mx-3 my-1" style={{ height: "1px", background: "hsl(var(--sidebar-border))" }} />
            )}

            {!collapsed ? (
              <Collapsible defaultOpen>
                <CollapsibleTrigger
                  className="group flex w-full items-center justify-between px-4 py-2 transition-colors"
                  style={{ color: "hsl(var(--sidebar-foreground) / 0.35)" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-px w-2 shrink-0" style={{ background: "hsl(var(--sidebar-primary) / 0.5)" }} />
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
                              className="flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
                              style={({ isActive }: { isActive: boolean }) => ({
                                fontFamily: "var(--font-heading)",
                                color: isActive
                                  ? "hsl(var(--sidebar-primary))"
                                  : "hsl(var(--sidebar-foreground) / 0.65)",
                                background: isActive
                                  ? "linear-gradient(90deg, hsl(var(--sidebar-primary) / 0.16), transparent)"
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
                              ? "linear-gradient(180deg, hsl(var(--sidebar-primary) / 0.18), transparent)"
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "hsl(var(--destructive))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground) / 0.4)";
            }}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminTopbar({ pathname }: { pathname: string }) {
  const current = resolveCurrentItem(pathname);
  const currentSection = current ? resolveCurrentSection(current.url) : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-md">
      <div className="h-[2px] w-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--warning)),transparent_70%)]" />
      <div className="flex h-14 items-center justify-between px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground" />

          <div className="h-5 w-px bg-border" />

          {current && (
            <div className="flex items-center gap-2">
              <div className="h-px w-5 shrink-0 bg-warning" />
              <span
                className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground sm:block"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {currentSection?.label}
              </span>
              <span className="hidden text-xs text-muted-foreground/30 sm:block">/</span>
              <span
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {current.title}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 border border-border/70 bg-card px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:border-warning/40 hover:text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">View Site</span>
          </a>

          <div className="mx-0.5 h-4 w-px bg-border" />

          <button
            className="relative flex h-9 w-9 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-card hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-3.5 w-3.5" />
            <span
              className="absolute right-2 top-2 h-1.5 w-1.5 ring-2 ring-background"
              style={{ background: "hsl(var(--warning))", borderRadius: 0 }}
            />
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
