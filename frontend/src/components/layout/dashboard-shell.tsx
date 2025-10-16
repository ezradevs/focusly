import { MODULES, type ModuleId } from "@/constants/modules";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Library, LogIn, Loader2, LogOut, User2, Home, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthDialog } from "@/components/auth-dialog";
import { TutorChatbot } from "@/components/chatbot/tutor-chatbot";
import { useAuthStore } from "@/store/auth";
import { usePreferencesStore } from "@/store/preferences";

interface DashboardShellProps {
  activeModule?: ModuleId;
  onModuleChange?: (module: ModuleId) => void;
  showNavigation?: boolean;
  children: React.ReactNode;
}

function Navigation({
  activeModule,
  onModuleChange,
  onNavigate,
  isCollapsed,
}: {
  activeModule?: ModuleId;
  onModuleChange?: (module: ModuleId) => void;
  onNavigate?: () => void;
  isCollapsed?: boolean;
}) {
  const router = useRouter();
  const updatePreferences = usePreferencesStore((state) => state.update);

  const handleModuleClick = (moduleId: ModuleId) => {
    if (onModuleChange) {
      onModuleChange(moduleId);
    } else {
      // When no onModuleChange is provided (e.g., from dashboard), navigate to workspace
      updatePreferences({ lastModule: moduleId });
      router.push("/workspace");
    }
    onNavigate?.();
  };

  return (
    <aside className={cn("flex h-full flex-col gap-6 transition-all", isCollapsed && "items-center px-0")}>
      {!isCollapsed && (
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Focusly</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered study modules
          </p>
        </div>
      )}
      <nav className={cn("w-full space-y-1", isCollapsed && "px-0")}>
        <Link
          href="/"
          onClick={() => onNavigate?.()}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition md:hidden",
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-indigo-400 to-indigo-600 text-primary-foreground shadow-sm">
            <Home className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Dashboard</p>
          </div>
        </Link>

        <Link
          href="/profile"
          onClick={() => onNavigate?.()}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition md:hidden",
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-400 to-purple-600 text-primary-foreground shadow-sm">
            <User2 className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Profile</p>
          </div>
        </Link>

        <Link
          href="/settings"
          onClick={() => onNavigate?.()}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition md:hidden",
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-pink-400 to-pink-600 text-primary-foreground shadow-sm">
            <Settings className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Settings</p>
          </div>
        </Link>

        <Separator className="my-2 md:hidden" />

        {MODULES.map((module) => {
          const Icon = module.icon;
          const isActive = module.id === activeModule;
          return (
            <Tooltip key={module.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleModuleClick(module.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    isCollapsed && "justify-center"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-primary-foreground shadow-sm",
                      module.accent
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {!isCollapsed && (
                    <div className="flex-1">
                      <p className="text-sm font-medium">{module.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {module.description}
                      </p>
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p className="font-medium">{module.label}</p>
                  <p className="text-xs text-muted-foreground">{module.description}</p>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2">
        {!isCollapsed && (
          <div className="text-xs text-muted-foreground">
            <Separator className="mb-2" />
            <p>Data stays on your device until you choose to export.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function DashboardShell({
  activeModule,
  onModuleChange,
  showNavigation = false,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const isAuthenticated = status === "authenticated" && Boolean(user);
  const isLoadingAuth = status === "loading";
  const showSidebar = showNavigation || (activeModule !== undefined && onModuleChange !== undefined);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-muted/20">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-4">
            {showSidebar && (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="md:hidden"
                    aria-label="Toggle navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[320px] p-0">
                  <div className="h-full overflow-y-auto p-6">
                    <Navigation
                      activeModule={activeModule}
                      onModuleChange={onModuleChange}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}
            <div className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/" className="gap-2">
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/profile" className="gap-2">
                  <User2 className="h-4 w-4" />
                  Profile
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isAuthenticated}
                  className="gap-2"
                  asChild
                >
                  <Link href="/library">
                    <Library className="h-4 w-4" />
                    Library
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isAuthenticated
                  ? "View all your saved content"
                  : "Sign in to access your library"}
              </TooltipContent>
            </Tooltip>
            {isLoadingAuth ? (
              <Button variant="ghost" size="icon" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User2 className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {user.name ?? user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium">{user.name ?? "Signed in"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      void logout();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" className="gap-2" onClick={() => setAuthOpen(true)}>
                <LogIn className="h-4 w-4" />
                Sign in
              </Button>
            )}
            <ThemeToggle />
          </div>
          </div>
        </header>
        {showSidebar ? (
          <div className={cn(
            "mx-auto flex w-full max-w-[1400px] flex-1 gap-6 py-6 md:grid transition-all",
            sidebarCollapsed ? "md:grid-cols-[70px_1fr] pl-0 pr-4" : "md:grid-cols-[280px_1fr] px-4"
          )}>
            <div className={cn("hidden md:block relative", sidebarCollapsed && "px-0")}>
              <div className="sticky top-24 flex flex-col h-[calc(100vh-7rem)]">
                <Navigation
                  activeModule={activeModule}
                  onModuleChange={onModuleChange}
                  isCollapsed={sidebarCollapsed}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className={cn(
                    "mt-2 gap-2 border shadow-sm",
                    sidebarCollapsed && "w-full justify-center px-2"
                  )}
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <>
                      <ChevronLeft className="h-4 w-4" />
                      Collapse Navigation Bar
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="min-h-[calc(100vh-6rem)]">{children}</div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
            <div className="min-h-[calc(100vh-6rem)]">{children}</div>
          </div>
        )}
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <TutorChatbot />
    </TooltipProvider>
  );
}
