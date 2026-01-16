import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useToast } from "../components/ui/toast";
import { 
  ExternalLink, 
  GripVertical, 
  RefreshCw, 
  Building2, 
  MapPin, 
  Calendar,
  AlertCircle,
  Plus
} from "lucide-react";

const parseUTCDate = (dateString: string) => {
  return new Date(dateString.includes('Z') ? dateString : dateString + 'Z');
};

type Status = "wishlist" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

interface Application {
  id: string;
  role_id: string;
  status: Status;
  role_title: string;
  company_name: string;
  company_logo_url: string | null;
  job_url: string | null;
  location: string | null;
  compensation_range: string | null;
  created_at: string;
  notes?: string;
}

const COLUMNS: { status: Status; label: string; color: string; bg: string }[] = [
  { status: "wishlist", label: "Wishlist", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
  { status: "applied", label: "Applied", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  { status: "interviewing", label: "Interviewing", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  { status: "offer", label: "Offer", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
];

export function Pipeline() {
  const { addToast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingRoles, setRefreshingRoles] = useState<Set<string>>(new Set());
  const [draggedApp, setDraggedApp] = useState<Application | null>(null);

  const loadApplications = () => {
    return fetch("/api/applications")
      .then((r) => r.json() as Promise<Application[]>)
      .then(setApplications);
  };

  useEffect(() => {
    loadApplications().finally(() => setLoading(false));
  }, []);

  const handleRefreshRole = async (roleId: string) => {
    setRefreshingRoles((prev) => new Set(prev).add(roleId));
    try {
      const response = await fetch(`/api/roles/${roleId}/refresh`, { method: "POST" });
      const result = await response.json();
      
      if (response.ok && result.updated) {
        await loadApplications();
      }
    } catch (error) {
      console.error(`Failed to refresh role ${roleId}:`, error);
      addToast({ title: "Failed to refresh role", variant: "error" });
    } finally {
      setRefreshingRoles((prev) => {
        const next = new Set(prev);
        next.delete(roleId);
        return next;
      });
    }
  };

  const handleRefreshPipeline = async () => {
    setRefreshing(true);
    const pipelineRoles = applications
      .filter((a) => ["wishlist", "applied", "interviewing", "offer"].includes(a.status))
      .filter((a) => a.job_url);

    const refreshPromises = pipelineRoles.map((app) => handleRefreshRole(app.role_id));
    
    try {
      await Promise.allSettled(refreshPromises);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDragStart = (app: Application) => {
    setDraggedApp(app);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: Status) => {
    if (!draggedApp || draggedApp.status === status) {
      setDraggedApp(null);
      return;
    }

    setApplications((apps) =>
      apps.map((a) => (a.id === draggedApp.id ? { ...a, status } : a))
    );

    await fetch(`/api/applications/${draggedApp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setDraggedApp(null);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white/50 backdrop-blur-sm z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Manage your applications and interview process.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefreshPipeline}
            disabled={refreshing}
            className="h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Sync All"}
          </Button>
          <Button size="sm" asChild className="h-9">
            <Link to="/roles/new">
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add Role
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex h-full gap-4 min-w-[1000px]">
          {COLUMNS.map((column) => {
            const columnApps = applications.filter((a) => a.status === column.status);
            return (
              <div
                key={column.status}
                className="flex flex-col w-80 shrink-0"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.status)}
              >
                <div className={`flex items-center justify-between mb-3 px-1`}>
                  <div className="flex items-center gap-2">
                    <h2 className={`font-semibold text-sm ${column.color}`}>{column.label}</h2>
                    <Badge variant="secondary" className="px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center text-[10px] font-mono">
                      {columnApps.length}
                    </Badge>
                  </div>
                </div>

                <div className={`flex-1 rounded-xl p-2 bg-slate-50/50 border border-slate-200/60 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent`}>
                  {columnApps.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-100 rounded-lg">
                      <p className="text-xs text-muted-foreground font-medium">No roles in {column.label}</p>
                    </div>
                  ) : (
                    columnApps.map((app) => {
                      const isRefreshing = refreshingRoles.has(app.role_id);
                      return (
                        <Card
                          key={app.id}
                          draggable={!isRefreshing}
                          onDragStart={() => handleDragStart(app)}
                          className={`
                            group relative border shadow-sm hover:shadow-md transition-all duration-200 
                            ${isRefreshing ? "opacity-60" : "cursor-grab active:cursor-grabbing hover:-translate-y-0.5"}
                            bg-white
                          `}
                        >
                          {isRefreshing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-lg z-20">
                              <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                            </div>
                          )}
                          
                          <CardContent className="p-3 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-50 border flex items-center justify-center text-slate-400 group-hover:border-blue-100 transition-colors overflow-hidden">
                                {app.company_logo_url ? (
                                  <img 
                                    src={app.company_logo_url} 
                                    alt={app.company_name}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <Building2 className="h-5 w-5 group-hover:text-blue-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link 
                                  to={`/roles/${app.role_id}`}
                                  className="block font-medium text-sm text-slate-900 truncate hover:text-blue-600 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {app.company_name}
                                </Link>
                                <p className="text-xs text-muted-foreground truncate">{app.role_title}</p>
                              </div>
                              <GripVertical className="h-4 w-4 text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <div className="flex flex-col gap-1.5 pt-1">
                              {app.location && (
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{app.location}</span>
                                </div>
                              )}
                                <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                  <Calendar className="h-3 w-3" />
                                  {parseUTCDate(app.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </div>
                                {app.job_url && (
                                  <a
                                    href={app.job_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-slate-300 hover:text-blue-500 transition-colors"
                                    title="View Job Post"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 border-t bg-slate-50/50">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Archived Applications</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {applications
            .filter((a) => a.status === "rejected" || a.status === "withdrawn")
            .map((app) => (
              <Link 
                key={app.id} 
                to={`/roles/${app.role_id}`}
                className="group flex items-center gap-2 pl-2 pr-3 py-1 bg-white border rounded-full text-xs text-muted-foreground hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${app.status === 'rejected' ? 'bg-red-400' : 'bg-slate-400'}`} />
                <span className="font-medium max-w-[150px] truncate">{app.company_name}</span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className="max-w-[150px] truncate opacity-75">{app.role_title}</span>
              </Link>
            ))}
          {applications.filter((a) => a.status === "rejected" || a.status === "withdrawn").length === 0 && (
            <span className="text-xs text-muted-foreground italic px-2">No archived applications yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
