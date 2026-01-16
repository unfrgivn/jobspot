import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useToast } from "../components/ui/toast";
import { 
  ArrowRight, 
  Briefcase, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Plus, 
  TrendingUp, 
  Calendar,
  Building2,
  MapPin,
  Video,
  ExternalLink,
  Link2
} from "lucide-react";

const normalizeDbTimestamp = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  if (trimmed.includes("T")) {
    return hasTimezone ? trimmed : `${trimmed}Z`;
  }

  const [datePart, timePart] = trimmed.split(" ");
  if (!timePart) return trimmed;
  if (timePart.endsWith("Z")) {
    return `${datePart}T${timePart}`;
  }

  const offsetMatch = timePart.match(/([+-]\d{2})(?::?(\d{2}))?$/);
  if (offsetMatch) {
    const offsetHours = offsetMatch[1];
    const offsetMinutes = offsetMatch[2] ?? "00";
    const timeWithoutOffset = timePart.slice(0, timePart.length - offsetMatch[0].length);
    return `${datePart}T${timeWithoutOffset}${offsetHours}:${offsetMinutes}`;
  }

  return `${datePart}T${timePart}Z`;
};

const parseUTCDate = (dateString: string) => new Date(normalizeDbTimestamp(dateString));

interface PipelineStats {
  wishlist: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
  withdrawn: number;
  total: number;
}

interface Task {
  id: string;
  kind: string;
  due_at: string | null;
  status: string;
  role_title: string | null;
  company_name: string | null;
}

interface Application {
  id: string;
  role_id: string;
  status: string;
  role_title: string;
  company_name: string;
  company_logo_url: string | null;
  location: string | null;
  compensation_range: string | null;
  created_at: string;
}

interface UpcomingInterview {
  id: string;
  scheduled_at: string;
  interview_type: string | null;
  duration_minutes: number | null;
  location: string | null;
  video_link: string | null;
  role_id: string;
  role_title: string;
  company_name: string;
  company_logo_url: string | null;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  htmlLink?: string;
  conferenceLink?: string;
  linkedRoleId?: string;
}

interface RoleOption {
  id: string;
  title: string;
  company_name: string;
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'wishlist': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'applied': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'interviewing': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'offer': return 'bg-green-100 text-green-700 border-green-200';
    case 'rejected': return 'bg-red-50 text-red-600 border-red-100';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function getTaskIcon(kind: string) {
  switch (kind) {
    case 'followup': return <AlertCircle className="h-4 w-4 text-amber-500" />;
    case 'prep': return <Briefcase className="h-4 w-4 text-blue-500" />;
    case 'thank_you': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    default: return <Clock className="h-4 w-4 text-slate-400" />;
  }
}

export function Dashboard() {
  const { addToast } = useToast();
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState<UpcomingInterview[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json() as Promise<PipelineStats>),
      fetch("/api/tasks?status=pending").then((r) => r.json() as Promise<Task[]>),
      fetch("/api/applications?limit=5").then((r) => r.json() as Promise<Application[]>),
      fetch("/api/interviews/upcoming").then((r) => r.json() as Promise<UpcomingInterview[]>),
      fetch("/api/calendar/events").then((r) => r.json() as Promise<{ events: CalendarEvent[]; connected: boolean }>),
      fetch("/api/roles?status=active").then((r) => r.json() as Promise<RoleOption[]>),
    ])
      .then(([statsData, tasksData, appsData, interviewsData, calendarData, rolesData]) => {
        setStats(statsData);
        setTasks(tasksData.slice(0, 5));
        setRecentApps(appsData.slice(0, 5));
        setUpcomingInterviews(interviewsData.slice(0, 5));
        setCalendarEvents(calendarData.events || []);
        setCalendarConnected(calendarData.connected || false);
        setRoles(rolesData || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLinkEvent = async (event: CalendarEvent, roleId: string) => {
    setLinkingEventId(event.id);
    try {
      await fetch(`/api/calendar/events/${event.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: roleId,
          summary: event.summary,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          conferenceLink: event.conferenceLink,
        }),
      });
      setCalendarEvents(prev => prev.map(e => 
        e.id === event.id ? { ...e, linkedRoleId: roleId } : e
      ));
    } catch (error) {
      console.error("Failed to link event:", error);
      addToast({ title: "Failed to link event to role", variant: "error" });
    } finally {
      setLinkingEventId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your career center...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { 
      label: "Wishlist", 
      value: stats?.wishlist ?? 0, 
      color: "text-slate-600",
      bg: "bg-slate-50",
      icon: <Briefcase className="h-4 w-4 text-slate-500" />
    },
    { 
      label: "Applied", 
      value: stats?.applied ?? 0, 
      color: "text-blue-600",
      bg: "bg-blue-50",
      icon: <TrendingUp className="h-4 w-4 text-blue-500" />
    },
    { 
      label: "Interviewing", 
      value: stats?.interviewing ?? 0, 
      color: "text-purple-600",
      bg: "bg-purple-50",
      icon: <Calendar className="h-4 w-4 text-purple-500" />
    },
    { 
      label: "Offers", 
      value: stats?.offer ?? 0, 
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      icon: <CheckCircle className="h-4 w-4 text-emerald-500" />
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your progress and manage your pipeline.</p>
        </div>
        <Button asChild className="gap-2 shadow-sm hover:shadow-md transition-all">
          <Link to="/roles/new">
            <Plus className="h-4 w-4" />
            Add Role
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <div className={`p-2 rounded-full ${stat.bg}`}>
                  {stat.icon}
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <h2 className={`text-3xl font-bold ${stat.color}`}>{stat.value}</h2>
                <span className="text-xs text-muted-foreground font-medium">roles</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1 shadow-sm h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest roles you've interacted with</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link to="/pipeline">View Pipeline <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {recentApps.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed rounded-lg border-slate-100">
                <div className="p-3 bg-slate-50 rounded-full mb-3">
                  <Briefcase className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">No applications started yet</p>
                <Button variant="link" size="sm" className="mt-1 h-auto p-0" asChild>
                  <Link to="/roles/new">Add your first role</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentApps.map((app) => (
                  <Link 
                    key={app.id} 
                    to={`/roles/${app.role_id}`}
                    className="block group"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all duration-200">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-white border shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                          {app.company_logo_url ? (
                            <img 
                              src={app.company_logo_url} 
                              alt={app.company_name}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-blue-600 transition-colors">
                            {app.role_title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                            {app.company_name}
                            {app.location && (
                              <>
                                <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3" /> {app.location}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(app.status)}`}>
                        {app.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Tasks */}
        <Card className="col-span-1 shadow-sm h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Priority Actions
                </CardTitle>
                <CardDescription>Upcoming tasks and follow-ups</CardDescription>
              </div>
              <Badge variant="secondary" className="font-normal">
                {tasks.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {tasks.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed rounded-lg border-slate-100">
                <div className="p-3 bg-slate-50 rounded-full mb-3">
                  <CheckCircle className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">You're all caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending tasks found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-white hover:shadow-sm transition-all duration-200"
                  >
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-full bg-slate-50">
                      {getTaskIcon(task.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {task.kind.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        at <span className="font-medium text-slate-700">{task.company_name}</span>
                        <span className="text-slate-300">•</span>
                        {task.role_title}
                      </p>
                    </div>
                    {task.due_at && (
                      <div className="shrink-0 flex flex-col items-end">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          parseUTCDate(task.due_at) < new Date() 
                            ? 'bg-red-50 text-red-600' 
                            : 'bg-slate-50 text-slate-600'
                        }`}>
                          {parseUTCDate(task.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Interviews */}
      {upcomingInterviews.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  Upcoming Interviews
                </CardTitle>
                <CardDescription>Your scheduled interviews</CardDescription>
              </div>
              <Badge variant="secondary" className="font-normal bg-purple-50 text-purple-700">
                {upcomingInterviews.length} scheduled
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingInterviews.map((interview) => {
                const interviewDate = parseUTCDate(interview.scheduled_at);
                const isToday = interviewDate.toDateString() === new Date().toDateString();
                const isTomorrow = interviewDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                
                return (
                  <Link
                    key={interview.id}
                    to={`/roles/${interview.role_id}`}
                    className="block group"
                  >
                    <div className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                      isToday ? 'border-purple-200 bg-purple-50/50' : 'border-slate-100 hover:border-purple-100'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-white border shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                            {interview.company_logo_url ? (
                              <img 
                                src={interview.company_logo_url} 
                                alt={interview.company_name}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <Building2 className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-purple-600 transition-colors">
                              {interview.role_title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {interview.company_name}
                            </p>
                          </div>
                        </div>
                        {interview.interview_type && (
                          <Badge variant="outline" className="shrink-0 text-xs capitalize">
                            {interview.interview_type.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-purple-500" />
                          <span className={`font-medium ${isToday ? 'text-purple-700' : 'text-slate-700'}`}>
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : interviewDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-muted-foreground">
                            {interviewDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        {interview.duration_minutes && (
                          <span className="text-xs text-muted-foreground">
                            {interview.duration_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Calendar Events */}
      {calendarConnected && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Calendar Events
                </CardTitle>
                <CardDescription>Upcoming events from Google Calendar</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {calendarEvents.length > 0 && (
                  <Badge variant="secondary" className="font-normal bg-blue-50 text-blue-700">
                    {calendarEvents.length} upcoming
                  </Badge>
                )}
                <Button variant="ghost" size="sm" asChild className="text-xs">
                  <Link to="/settings">
                    Settings <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {calendarEvents.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed rounded-lg border-slate-100">
                <div className="p-3 bg-slate-50 rounded-full mb-3">
                  <Calendar className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {calendarEvents.slice(0, 9).map((event) => {
                  const startDate = new Date(event.startTime);
                  const endDate = new Date(event.endTime);
                  const isToday = startDate.toDateString() === new Date().toDateString();
                  const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                  const durationMins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
                  
                  return (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                        isToday ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 hover:border-blue-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {event.summary}
                          </p>
                          {event.location && (
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {event.conferenceLink && (
                            <a
                              href={event.conferenceLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md hover:bg-blue-100 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Video className="h-4 w-4 text-blue-600" />
                            </a>
                          )}
                          {event.htmlLink && (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4 text-slate-500" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className={`font-medium ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-muted-foreground">
                            {startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {durationMins} min
                          </span>
                          {event.linkedRoleId ? (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              <Link2 className="h-3 w-3 mr-1" />
                              Linked
                            </Badge>
                          ) : roles.length > 0 && (
                            <select
                              className="text-xs border rounded px-1.5 py-0.5 bg-white cursor-pointer hover:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleLinkEvent(event, e.target.value);
                                }
                              }}
                              disabled={linkingEventId === event.id}
                            >
                              <option value="">Link to role...</option>
                              {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.title} @ {role.company_name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
