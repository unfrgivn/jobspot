import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Kanban, PlusCircle, Settings, Briefcase, CheckSquare, WifiOff, LogOut, User } from "lucide-react";
import { cn } from "../lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ProfileCompletionBanner } from "./ProfileCompletionBanner";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/pipeline", icon: Kanban, label: "Pipeline" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/roles/new", icon: PlusCircle, label: "Add Role" },
];

export function Layout() {
  const location = useLocation();
  const [backendConnected, setBackendConnected] = useState(true);
  const { user, logout } = useAuth();

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health", { 
          method: "GET",
          signal: AbortSignal.timeout(3000)
        });
        setBackendConnected(response.ok);
      } catch {
        setBackendConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container flex h-16 items-center px-4 mx-auto" style={{ maxWidth: "1600px" }}>
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">JobSpot</span>
            <span className="sm:hidden">Jobs</span>
          </Link>
          
          {!backendConnected && (
            <div className="flex-1 flex justify-center px-4">
              <div className="bg-orange-100 border border-orange-300 text-orange-800 px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                <span>Backend disconnected</span>
              </div>
            </div>
          )}
          
          <nav className={cn("hidden md:flex items-center gap-1", backendConnected ? "ml-auto" : "")}>
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-4 pl-4 ml-2 border-l h-8">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full transition-colors hover:bg-muted/60 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <span className="text-sm font-medium pl-1">
                    {user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User"}
                  </span>
                  <div className="relative h-8 w-8 rounded-full overflow-hidden border bg-muted shadow-sm">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name || "User"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user?.name && <p className="font-medium">{user.name}</p>}
                    {user?.email && <p className="w-[200px] truncate text-xs text-muted-foreground">{user.email}</p>}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <nav className="ml-auto flex md:hidden items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center justify-center rounded-md p-2 transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={item.label}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative h-8 w-8 ml-2 rounded-full overflow-hidden border bg-muted hover:opacity-80 transition-opacity outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name || "User"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user?.name && <p className="font-medium">{user.name}</p>}
                    {user?.email && <p className="w-[200px] truncate text-xs text-muted-foreground">{user.email}</p>}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>
      <ProfileCompletionBanner />
      <main className="container py-6 px-4 mx-auto" style={{ maxWidth: "1600px" }}>
        <Outlet />
      </main>
    </div>
  );
}

