import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Activity, 
  Terminal, 
  Database, 
  Globe, 
  Cpu,
  RefreshCw,
  Info,
  User,
  Loader2,
  FileText,
  Sparkles,
  Clock,
  Calendar,
  Link2,
  Unlink
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { useToast } from "../components/ui/toast";
import { cn } from "../lib/utils";

interface DoctorCheck {
  name: string;
  status: "ok" | "error" | "warning";
  message: string;
}

interface DoctorResult {
  checks: DoctorCheck[];
  allOk: boolean;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  about_me: string | null;
  why_looking: string | null;
  experience_json: string | null;
  cover_letter_tone: string | null;
  cover_letter_structure: string | null;
  resume_text: string | null;
  resume_file_path: string | null;
  created_at: string;
  updated_at: string;
}

type SettingsTab = "profile" | "context" | "integrations" | "diagnostics" | "data" | "about";

interface NavItemProps {
  tab: SettingsTab;
  currentTab: SettingsTab;
  onClick: (tab: SettingsTab) => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

function NavItem({ tab, currentTab, onClick, icon, label, description }: NavItemProps) {
  const isActive = tab === currentTab;
  return (
    <button
      onClick={() => onClick(tab)}
      className={cn(
        "w-full text-left px-4 py-3 rounded-lg transition-all",
        "flex items-start gap-3",
        isActive 
          ? "bg-slate-900 text-white shadow-md" 
          : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <span className={cn("mt-0.5", isActive ? "text-white" : "text-slate-400")}>
        {icon}
      </span>
      <div>
        <p className={cn("font-medium text-sm", isActive ? "text-white" : "text-slate-900")}>
          {label}
        </p>
        {description && (
          <p className={cn("text-xs mt-0.5", isActive ? "text-slate-300" : "text-slate-500")}>
            {description}
          </p>
        )}
      </div>
    </button>
  );
}

function getCheckIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('database') || lower.includes('db')) return <Database className="h-4 w-4" />;
  if (lower.includes('api') || lower.includes('key')) return <Terminal className="h-4 w-4" />;
  if (lower.includes('network') || lower.includes('internet')) return <Globe className="h-4 w-4" />;
  return <Cpu className="h-4 w-4" />;
}

export function Settings() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [doctorResult, setDoctorResult] = useState<DoctorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  interface CandidateContext {
    resume_parsed_at?: string;
    linkedin_scraped_at?: string;
    portfolio_scraped_at?: string;
    updated_at: string;
    executive_summary?: string;
    key_strengths?: string;
    leadership_narrative?: string;
    technical_expertise?: string;
    impact_highlights?: string;
    career_trajectory?: string;
    full_context?: string;
  }
  const [candidateContext, setCandidateContext] = useState<CandidateContext | null>(null);
  const [refreshingContext, setRefreshingContext] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [calendars, setCalendars] = useState<{ id: string; summary: string; primary?: boolean }[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("primary");
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    linkedin_url: "",
    portfolio_url: "",
    about_me: "",
    why_looking: "",
  });

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setUploadingResume(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append("file", file);

      const response = await fetch(`/api/profile/${profile.id}/resume`, {
        method: "POST",
        body: formDataObj,
      });

      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        window.dispatchEvent(new Event("candidate-context-updated"));
      } else {
        console.error("Failed to upload resume");
        addToast({ title: "Failed to upload resume", variant: "error" });
      }
    } catch (error) {
      console.error("Failed to upload resume:", error);
      addToast({ title: "Failed to upload resume", variant: "error" });
    } finally {
      setUploadingResume(false);
      event.target.value = "";
    }
  };

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const response = await fetch("/api/profile");
      const data = await response.json();
      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          linkedin_url: data.linkedin_url || "",
          portfolio_url: data.portfolio_url || "",
          about_me: data.about_me || "",
          why_looking: data.why_looking || "",
        });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      addToast({ title: "Failed to load profile", variant: "error" });
    } finally {
      setProfileLoading(false);
    }
  };

  const loadCandidateContext = async () => {
    try {
      const response = await fetch("/api/candidate-context");
      if (response.ok) {
        const data = await response.json();
        setCandidateContext(data);
      }
    } catch (error) {
      console.error("Failed to load candidate context:", error);
      addToast({ title: "Failed to load candidate context", variant: "error" });
    }
  };

  const refreshCandidateContext = async () => {
    setRefreshingContext(true);
    try {
      const response = await fetch("/api/candidate-context/refresh", {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setCandidateContext(data);
        window.dispatchEvent(new Event("candidate-context-updated"));
      } else {
        console.error("Failed to refresh candidate context");
        addToast({ title: "Failed to refresh candidate context", variant: "error" });
      }
    } catch (error) {
      console.error("Failed to refresh candidate context:", error);
      addToast({ title: "Failed to refresh candidate context", variant: "error" });
    } finally {
      setRefreshingContext(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setSaving(true);
    setSaveStatus("idle");
    try {
      const response = await fetch(`/api/profile/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        setSaveStatus("success");
        addToast({ title: "Profile saved successfully", variant: "success" });
        setTimeout(() => setSaveStatus("idle"), 3000);
        window.dispatchEvent(new Event("candidate-context-updated"));
      } else {
        console.error("Failed to save profile");
        setSaveStatus("error");
        addToast({ title: "Failed to save profile", variant: "error" });
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      setSaveStatus("error");
      addToast({ title: "Failed to save profile", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const runChecks = () => {
    setLoading(true);
    fetch("/api/doctor")
      .then((r) => r.json() as Promise<DoctorResult>)
      .then(setDoctorResult)
      .finally(() => setLoading(false));
  };

  const loadCalendarStatus = async () => {
    try {
      const response = await fetch("/api/oauth/google/status");
      if (response.ok) {
        const data = await response.json();
        setCalendarStatus(data);
        if (data.connected) {
          loadCalendars();
        }
      }
    } catch (error) {
      console.error("Failed to load candidate context:", error);
      addToast({ title: "Failed to load candidate context", variant: "error" });
    }
  };

  const loadCalendars = async () => {
    setLoadingCalendars(true);
    try {
      const response = await fetch("/api/calendars");
      if (response.ok) {
        const data = await response.json();
        setCalendars(data.calendars || []);
        setSelectedCalendarId(data.selectedId || "primary");
      }
    } catch (error) {
      console.error("Failed to load calendars:", error);
      addToast({ title: "Failed to load calendars", variant: "error" });
    }
  };

  const handleCalendarChange = async (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    try {
      await fetch("/api/settings/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId }),
      });
    } catch (error) {
      console.error("Failed to load calendar status:", error);
      addToast({ title: "Failed to load calendar status", variant: "error" });
    }
  };

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const response = await fetch("/api/oauth/google/authorize");
      const data = await response.json();
      
      if (data.url) {
        const popup = window.open(data.url, "google-auth", "width=500,height=600,menubar=no,toolbar=no");
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === "google-calendar-connected") {
            window.removeEventListener("message", handleMessage);
            loadCalendarStatus();
            setConnectingCalendar(false);
          }
        };
        window.addEventListener("message", handleMessage);
        
        // Fallback timeout in case popup closes without message
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", handleMessage);
            loadCalendarStatus();
            setConnectingCalendar(false);
          }
        }, 500);
      }
    } catch (error) {
      console.error("Failed to start OAuth flow:", error);
      addToast({ title: "Failed to connect Google Calendar", variant: "error" });
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!confirm("Disconnect Google Calendar? Existing calendar events will not be removed.")) {
      return;
    }
    
    setDisconnectingCalendar(true);
    try {
      const response = await fetch("/api/oauth/google/disconnect", { method: "DELETE" });
      if (response.ok) {
        setCalendarStatus({ configured: calendarStatus?.configured ?? false, connected: false });
      }
    } catch (error) {
      console.error("Failed to disconnect calendar:", error);
      addToast({ title: "Failed to disconnect calendar", variant: "error" });
    }
  };

  useEffect(() => {
    runChecks();
    loadProfile();
    loadCandidateContext();
    loadCalendarStatus();
  }, []);

  const statusIcon = (status: DoctorCheck["status"]) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: DoctorCheck["status"]) => {
    switch (status) {
      case "ok": return "bg-emerald-50 border-emerald-100";
      case "error": return "bg-red-50 border-red-100";
      case "warning": return "bg-amber-50 border-amber-100";
    }
  };

  return (
    <div className="flex gap-8 max-w-6xl mx-auto">
      <div className="w-64 shrink-0">
        <div className="sticky top-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground mb-6">Manage your profile and system configuration.</p>
          
          <nav className="space-y-1">
            <NavItem
              tab="profile"
              currentTab={activeTab}
              onClick={setActiveTab}
              icon={<User className="h-4 w-4" />}
              label="Profile"
              description="Personal information & resume"
            />
            <NavItem
              tab="context"
              currentTab={activeTab}
              onClick={setActiveTab}
              icon={<Sparkles className="h-4 w-4" />}
              label="User Context"
              description="AI-synthesized profile"
            />
            <NavItem
              tab="integrations"
              currentTab={activeTab}
              onClick={setActiveTab}
              icon={<Link2 className="h-4 w-4" />}
              label="Integrations"
              description="Calendar & services"
            />
            <NavItem
              tab="diagnostics"
              currentTab={activeTab}
              onClick={setActiveTab}
              icon={<Activity className="h-4 w-4" />}
              label="Diagnostics"
              description="System health checks"
            />
            <NavItem
              tab="data"
              currentTab={activeTab}
              onClick={setActiveTab}
              icon={<Database className="h-4 w-4" />}
              label="Data"
              description="Backup & restore"
            />
            <NavItem
              tab="about"
              currentTab={activeTab}
              onClick={setActiveTab}
              icon={<Info className="h-4 w-4" />}
              label="About"
              description="Application info"
            />
          </nav>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {activeTab === "profile" && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-blue-500" />
                Your Profile
              </CardTitle>
              <CardDescription>
                This information is used to personalize cover letters and applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Chris White"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="chris@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                      <Input
                        id="linkedin_url"
                        value={formData.linkedin_url}
                        onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="portfolio_url">Portfolio URL</Label>
                    <Input
                      id="portfolio_url"
                      value={formData.portfolio_url}
                      onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                      placeholder="https://yourportfolio.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="about_me">About Me</Label>
                    <Textarea
                      id="about_me"
                      value={formData.about_me}
                      onChange={(e) => setFormData({ ...formData, about_me: e.target.value })}
                      placeholder="Brief overview of your background and experience..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="why_looking">Why Looking for New Role</Label>
                    <Textarea
                      id="why_looking"
                      value={formData.why_looking}
                      onChange={(e) => setFormData({ ...formData, why_looking: e.target.value })}
                      placeholder="What you're looking for in your next opportunity..."
                      rows={3}
                    />
                  </div>

                  <div className="border-t pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Resume
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Upload your resume to auto-populate profile data
                          </p>
                        </div>
                        {profile?.resume_file_path && (
                          <Badge variant="outline" className="gap-1">
                            <FileText className="h-3 w-3" />
                            {profile.resume_file_path}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept=".txt,.pdf"
                          onChange={handleResumeUpload}
                          disabled={uploadingResume || !profile}
                          className="flex-1"
                        />
                        {uploadingResume && (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-4">
                    {saveStatus === "success" && (
                      <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium animate-in fade-in slide-in-from-right-4">
                        <CheckCircle className="h-4 w-4" />
                        Profile saved
                      </div>
                    )}
                    {saveStatus === "error" && (
                      <div className="flex items-center gap-1.5 text-sm text-red-600 font-medium animate-in fade-in slide-in-from-right-4">
                        <AlertCircle className="h-4 w-4" />
                        Failed to save
                      </div>
                    )}
                    <Button onClick={handleSaveProfile} disabled={saving || !profile}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Profile"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "context" && (
          <Card className="shadow-sm border-purple-200 bg-gradient-to-br from-white to-purple-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    User Context
                  </CardTitle>
                  <CardDescription>
                    AI-synthesized profile used for personalized cover letters, LinkedIn messages, and job matching
                  </CardDescription>
                </div>
                <Button
                  onClick={refreshCandidateContext}
                  disabled={refreshingContext}
                  variant="default"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {refreshingContext ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {candidateContext?.full_context ? 'Refreshing...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {candidateContext?.full_context ? 'Refresh Context' : 'Generate Context'}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {candidateContext ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className={`p-3 rounded-lg border ${candidateContext.resume_parsed_at ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-900">Resume</p>
                        {candidateContext.resume_parsed_at ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-slate-400" />}
                      </div>
                      <p className="text-slate-600">
                        {candidateContext.resume_parsed_at 
                          ? new Date(candidateContext.resume_parsed_at).toLocaleDateString()
                          : 'Not parsed'}
                      </p>
                    </div>

                    <div className={`p-3 rounded-lg border ${candidateContext.linkedin_scraped_at ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-900">LinkedIn</p>
                        {candidateContext.linkedin_scraped_at ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-slate-400" />}
                      </div>
                      <p className="text-slate-600">
                        {candidateContext.linkedin_scraped_at 
                          ? new Date(candidateContext.linkedin_scraped_at).toLocaleDateString()
                          : 'Not scraped'}
                      </p>
                    </div>

                    <div className={`p-3 rounded-lg border ${candidateContext.portfolio_scraped_at ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-900">Portfolio</p>
                        {candidateContext.portfolio_scraped_at ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-slate-400" />}
                      </div>
                      <p className="text-slate-600">
                        {candidateContext.portfolio_scraped_at 
                          ? new Date(candidateContext.portfolio_scraped_at).toLocaleDateString()
                          : 'Not scraped'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last updated: {new Date(candidateContext.updated_at).toLocaleString()}
                  </p>

                  <div className="space-y-4">
                    {candidateContext.executive_summary && (
                      <div className="p-4 rounded-lg border bg-white">
                        <p className="font-semibold text-slate-900 mb-2 text-sm">Executive Summary</p>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {candidateContext.executive_summary}
                      </p>
                    </div>
                  )}

                  {candidateContext.key_strengths && (
                    <div className="p-4 rounded-lg border bg-white">
                      <p className="font-semibold text-slate-900 mb-2 text-sm">Key Strengths</p>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {candidateContext.key_strengths}
                      </p>
                    </div>
                  )}

                  {candidateContext.leadership_narrative && (
                    <div className="p-4 rounded-lg border bg-white">
                      <p className="font-semibold text-slate-900 mb-2 text-sm">Leadership Narrative</p>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {candidateContext.leadership_narrative}
                      </p>
                    </div>
                  )}

                  {candidateContext.technical_expertise && (
                    <div className="p-4 rounded-lg border bg-white">
                      <p className="font-semibold text-slate-900 mb-2 text-sm">Technical Expertise</p>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {candidateContext.technical_expertise}
                      </p>
                    </div>
                  )}

                  {candidateContext.impact_highlights && (
                    <div className="p-4 rounded-lg border bg-white">
                      <p className="font-semibold text-slate-900 mb-2 text-sm">Impact Highlights</p>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {candidateContext.impact_highlights}
                      </p>
                    </div>
                  )}

                  {candidateContext.career_trajectory && (
                    <div className="p-4 rounded-lg border bg-white">
                      <p className="font-semibold text-slate-900 mb-2 text-sm">Career Trajectory</p>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {candidateContext.career_trajectory}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 rounded-lg border border-dashed border-purple-300 bg-purple-50/50 text-center">
                  <Sparkles className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-900 mb-2">No User Context Generated Yet</p>
                  <p className="text-xs text-slate-600 mb-1">
                    Click "Generate Context" to create your AI-synthesized profile.
                  </p>
                  <p className="text-xs text-slate-500">
                    This combines your resume, LinkedIn, and portfolio into a unified context used for all AI features.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "integrations" && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5 text-blue-500" />
                Integrations
              </CardTitle>
              <CardDescription>
                Connect external services to enhance your job search workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg border bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white border">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Google Calendar</h3>
                      <p className="text-sm text-slate-600">
                        Sync interviews to your calendar automatically
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {calendarStatus?.connected ? (
                      <>
                        <Badge variant="default" className="bg-green-600 gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Connected
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectCalendar}
                          disabled={disconnectingCalendar}
                        >
                          {disconnectingCalendar ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Unlink className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    ) : calendarStatus?.configured ? (
                      <Button
                        onClick={handleConnectCalendar}
                        disabled={connectingCalendar}
                        size="sm"
                      >
                        {connectingCalendar ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Not Configured
                      </Badge>
                    )}
                  </div>
                </div>
                {!calendarStatus?.configured && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-800">
                      To enable Google Calendar integration, add <code className="bg-amber-100 px-1 rounded">GOOGLE_CALENDAR_CLIENT_ID</code> and{" "}
                      <code className="bg-amber-100 px-1 rounded">GOOGLE_CALENDAR_CLIENT_SECRET</code> to your <code className="bg-amber-100 px-1 rounded">.env</code> file.
                    </p>
                  </div>
                )}
                {calendarStatus?.connected && calendars.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Label htmlFor="calendar-select" className="text-sm font-medium text-slate-700">
                      Sync interviews to:
                    </Label>
                    <select
                      id="calendar-select"
                      value={selectedCalendarId}
                      onChange={(e) => handleCalendarChange(e.target.value)}
                      disabled={loadingCalendars}
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {calendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.summary}{cal.primary ? " (Primary)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "diagnostics" && (
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-blue-500" />
                  System Diagnostics
                </CardTitle>
                <CardDescription>
                  Live status checks for external dependencies and database
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {doctorResult && (
                  <Badge variant={doctorResult.allOk ? "default" : "destructive"} className="px-3 py-1 text-sm font-medium">
                    {doctorResult.allOk ? "System Healthy" : "Attention Needed"}
                  </Badge>
                )}
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={runChecks} 
                  disabled={loading}
                  title="Rerun checks"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading && !doctorResult ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-pulse">
                  <Activity className="h-8 w-8 mb-3 opacity-50" />
                  <p>Running diagnostic checks...</p>
                </div>
              ) : doctorResult ? (
                <div className="grid gap-3">
                  {doctorResult.checks.map((check, i) => (
                    <div 
                      key={i} 
                      className={`flex items-start gap-4 p-4 rounded-lg border transition-all duration-200 ${getStatusColor(check.status)}`}
                    >
                      <div className="mt-0.5 shrink-0 bg-white rounded-full p-1 shadow-sm">
                        {statusIcon(check.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="p-1 rounded bg-white/50 border border-black/5 text-slate-500">
                            {getCheckIcon(check.name)}
                          </span>
                          <p className="font-semibold text-sm text-slate-900">{check.name}</p>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{check.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-3 text-red-500" />
                  <p>Failed to load diagnostic results.</p>
                  <Button variant="link" onClick={runChecks} className="mt-2">Try Again</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "data" && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-indigo-500" />
                Backup & Restore
              </CardTitle>
              <CardDescription>
                Download a backup of your database or restore from a previous backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg border bg-slate-50">
                <h3 className="font-semibold text-slate-900 mb-2">Download Backup</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Export your entire database including all roles, applications, research, and settings.
                </p>
                <a
                  href="/api/backup"
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Database className="h-4 w-4" />
                  Download Backup
                </a>
              </div>

              <div className="p-4 rounded-lg border bg-amber-50 border-amber-200">
                <h3 className="font-semibold text-slate-900 mb-2">Restore from Backup</h3>
                <p className="text-sm text-slate-600 mb-2">
                  Upload a previously downloaded backup file to restore your data.
                </p>
                <p className="text-xs text-amber-700 mb-4">
                  Warning: This will replace all current data. A backup of your current database will be created automatically.
                </p>
                <input
                  type="file"
                  accept=".sqlite"
                  id="restore-file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    if (!confirm("Are you sure you want to restore from this backup? This will replace all current data.")) {
                      e.target.value = "";
                      return;
                    }
                    
                    const formData = new FormData();
                    formData.append("backup", file);
                    
                    try {
                      const res = await fetch("/api/restore", {
                        method: "POST",
                        body: formData,
                      });
                      const data = await res.json();
                      
                      if (res.ok) {
                        addToast({ title: "Database restored successfully", description: "The page will now reload.", variant: "success" });
                        setTimeout(() => window.location.reload(), 1500);
                      } else {
                        addToast({ title: "Restore failed", description: data.error, variant: "error" });
                      }
                    } catch {
                      addToast({ title: "Restore failed", description: "Network error", variant: "error" });
                    }
                    
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor="restore-file"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  Choose Backup File
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "about" && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-slate-500" />
                About Application
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border text-sm text-slate-600 leading-relaxed">
                <p className="mb-2 font-medium text-slate-900">JobSpot v1.0.0</p>
                <p>
                  A personalized career copilot designed to help you manage your job search pipeline, 
                  generate tailored cover letters, and track your applications with intelligent insights.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded border bg-white">
                  <p className="font-semibold text-slate-900 mb-1">Tech Stack</p>
                  <p className="text-muted-foreground">Bun, Hono, React, Tailwind</p>
                </div>
                <div className="p-3 rounded border bg-white">
                  <p className="font-semibold text-slate-900 mb-1">AI Engine</p>
                  <p className="text-muted-foreground">Google Gemini 2.0 Flash</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
