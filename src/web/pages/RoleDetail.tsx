import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useToast } from "../components/ui/toast";
import { cn } from "../lib/utils";

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
import { 
  ArrowLeft,
  ArrowRight,
  Archive,
  Download, 
  Loader2, 
  RefreshCw, 
  FileText,
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Calendar,
  Clock,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  DollarSign,
  Sparkles,
  TrendingUp,
  Trash2,
  Pencil,
  Check,
  ExternalLink,
  ChevronRight,
  Target,
  FileCheck,
  Zap,
  LayoutDashboard,
  MessageSquare,
  Copy,
  Save,
  CalendarCheck,
  CalendarPlus,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

function formatCompensation(min: number, max: number): string {
  const formatNum = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${Math.floor(n / 1000)}K`;
    return `$${n}`;
  };
  return `${formatNum(min)} - ${formatNum(max)}`;
}

interface Role {
  id: string;
  company_id: string;
  company_name: string;
  title: string;
  level: string | null;
  location: string | null;
  compensation_range: string | null;
  compensation_min: number | null;
  compensation_max: number | null;
  job_url: string | null;
  jd_text: string | null;
  application_id: string | null;
  application_status: string | null;
  applied_at: string | null;
  linkedin_message: string | null;
  cover_letter: string | null;
}

interface Company {
  id: string;
  name: string;
  website: string | null;
  headquarters: string | null;
  logo_url: string | null;
  description: string | null;
  industry: string | null;
  funding_status: string | null;
  company_size: string | null;
  established_date: string | null;
  research_sources: string | null;
}

interface Artifact {
  id: string;
  kind: string;
  path: string;
  created_at: string;
}

interface RoleResearch {
  id: string;
  role_id: string;
  company_profile: string | null;
  fit_analysis: string | null;
  interview_questions: string | null;
  questions_to_ask: string | null;
  talking_points: string | null;
  generated_at: string;
  updated_at: string;
}

interface Interview {
  id: string;
  application_id: string;
  scheduled_at: string;
  interview_type: string | null;
  interviewer_name: string | null;
  interviewer_title: string | null;
  notes: string | null;
  outcome: string | null;
  rating: number | null;
  duration_minutes: number | null;
  location: string | null;
  video_link: string | null;
  google_calendar_event_id: string | null;
  prep_notes: string | null;
  questions_to_ask: string | null;
  research_notes: string | null;
  follow_up_note: string | null;
  transcript: string | null;
  analysis_notes: string | null;
  created_at: string;
  updated_at: string;
}

const interviewPrepSections = [
  {
    field: "prep_notes",
    label: "Prep Notes",
    placeholder: "Key points to highlight about your experience and the role.",
  },
  {
    field: "questions_to_ask",
    label: "Questions to Ask",
    placeholder: "Thoughtful questions to ask the interviewer.",
  },
  {
    field: "research_notes",
    label: "Research Notes",
    placeholder: "Company, interviewer, or product context to reference.",
  },
] as const;

type InterviewPrepField = (typeof interviewPrepSections)[number]["field"];

interface ApplicationQuestion {
  id: string;
  role_id: string;
  question: string;
  generated_answer: string | null;
  submitted_answer: string | null;
  created_at: string;
  updated_at: string;
}

export function RoleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [role, setRole] = useState<Role | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [research, setResearch] = useState<RoleResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingRole, setRefreshingRole] = useState(false);
  const [editingJd, setEditingJd] = useState(false);
  const [jdText, setJdText] = useState("");
  const [savingJd, setSavingJd] = useState(false);
  const [generatingResearch, setGeneratingResearch] = useState(false);
  const [questionsToAskGuidance, setQuestionsToAskGuidance] = useState("");
  const [regeneratingQuestionsToAsk, setRegeneratingQuestionsToAsk] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [coverLetterPreview, setCoverLetterPreview] = useState("");
  const [editingCoverLetter, setEditingCoverLetter] = useState(false);
  const [coverLetterEditText, setCoverLetterEditText] = useState("");
  const [savingCoverLetter, setSavingCoverLetter] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingTimestamp, setEditingTimestamp] = useState(false);
  const [timestampValue, setTimestampValue] = useState("");
  const [savingTimestamp, setSavingTimestamp] = useState(false);
  const [generatingLinkedIn, setGeneratingLinkedIn] = useState(false);
  const [linkedInPreview, setLinkedInPreview] = useState("");
  const [editingLinkedIn, setEditingLinkedIn] = useState(false);
  const [linkedInEditText, setLinkedInEditText] = useState("");
  const [savingLinkedIn, setSavingLinkedIn] = useState(false);
  const [researchingCompany, setResearchingCompany] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState<string | null>(null);
  const [generatingPrepId, setGeneratingPrepId] = useState<string | null>(null);
  const [prepGuidance, setPrepGuidance] = useState<Record<string, string>>({});
  const [prepOpen, setPrepOpen] = useState<Record<string, boolean>>({});
  const [prepDrafts, setPrepDrafts] = useState<Record<string, string>>({});
  const [prepEditing, setPrepEditing] = useState<Record<string, boolean>>({});
  const [savingPrepEdits, setSavingPrepEdits] = useState<Record<string, boolean>>({});
  const [followUpOpen, setFollowUpOpen] = useState<Record<string, boolean>>({});
  const [followUpGuidance, setFollowUpGuidance] = useState<Record<string, string>>({});
  const [followUpPreview, setFollowUpPreview] = useState<Record<string, string>>({});
  const [followUpEditText, setFollowUpEditText] = useState<Record<string, string>>({});
  const [editingFollowUp, setEditingFollowUp] = useState<Record<string, boolean>>({});
  const [savingFollowUp, setSavingFollowUp] = useState<Record<string, boolean>>({});
  const [generatingFollowUpId, setGeneratingFollowUpId] = useState<string | null>(null);
  const [coverLetterContext, setCoverLetterContext] = useState("");
  const [callReviewOpen, setCallReviewOpen] = useState<Record<string, boolean>>({});
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [analyses, setAnalyses] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [savingTranscript, setSavingTranscript] = useState<Record<string, boolean>>({});
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [interviewForm, setInterviewForm] = useState({
    scheduled_at: "",
    interview_type: "",
    interviewer_name: "",
    interviewer_title: "",
    notes: "",
    outcome: "pending",
    duration_minutes: "60",
    location: "",
    video_link: "",
    rating: ""
  });
  
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerOptions, setAnswerOptions] = useState<string[]>([]);
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
  const [editingOptionText, setEditingOptionText] = useState("");
  const [generatingAnswer, setGeneratingAnswer] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [savedQuestions, setSavedQuestions] = useState<ApplicationQuestion[]>([]);

  const loadRoleData = useCallback(async () => {
    if (!id) return;
    
    try {
      const [roleRes, artifactsRes, researchRes] = await Promise.all([
        fetch(`/api/roles/${id}`),
        fetch(`/api/roles/${id}/artifacts`),
        fetch(`/api/roles/${id}/research`).catch(() => null),
      ]);

      const roleData = await roleRes.json() as Role;
      setRole(roleData);
      setJdText(roleData.jd_text ?? "");

      if (roleData.company_id) {
        const companyRes = await fetch(`/api/companies/${roleData.company_id}`);
        const companyData = await companyRes.json() as Company;
        setCompany(companyData);
      }

      const artifactsData = await artifactsRes.json() as Artifact[];
      setArtifacts(artifactsData);

      if (researchRes?.ok) {
        const researchData = await researchRes.json() as RoleResearch;
        setResearch(researchData);
      }
    } catch (error) {
      console.error("Failed to load role data:", error);
      addToast({ title: "Failed to load role", description: "Please try refreshing the page", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRoleData();
  }, [loadRoleData]);

  const handleRefreshRole = async () => {
    if (!role || !id) return;
    
    setRefreshingRole(true);
    setGeneratingResearch(true);
    try {
      const response = await fetch(`/api/roles/${id}/refresh`, { method: "POST" });
      const result = await response.json();
      
      if (response.ok && result.updated) {
        await loadRoleData();
      }
    } catch (error) {
      console.error("Failed to refresh role:", error);
      addToast({ title: "Failed to refresh role", variant: "error" });
    } finally {
      setRefreshingRole(false);
      setGeneratingResearch(false);
    }
  };

  const regenerateQuestionsToAsk = async () => {
    if (!id) return;

    setRegeneratingQuestionsToAsk(true);
    try {
      const response = await fetch(`/api/roles/${id}/questions-to-ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidance: questionsToAskGuidance.trim() || undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        addToast({
          title: "Failed to regenerate questions",
          description: result.error ?? "Please try again",
          variant: "error",
        });
        return;
      }

      if (result.questions_to_ask) {
        setResearch((prev) => (prev ? { ...prev, questions_to_ask: result.questions_to_ask } : prev));
        if (!research) {
          await loadRoleData();
        }
      }
    } catch (error) {
      console.error("Failed to regenerate questions:", error);
      addToast({ title: "Failed to regenerate questions", variant: "error" });
    } finally {
      setRegeneratingQuestionsToAsk(false);
    }
  };

  const saveJd = async () => {
    setSavingJd(true);
    try {
      await fetch(`/api/roles/${id}/jd`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd_text: jdText }),
      });
      await loadRoleData();
      setEditingJd(false);
    } finally {
      setSavingJd(false);
    }
  };

  const generateCoverLetter = useCallback(async () => {
    if (!role || !id) return;
    setGenerating(true);
    setCoverLetterPreview("");

    try {
      const response = await fetch(`/api/stream/cover-letter/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalContext: coverLetterContext }),
      });

      if (!response.ok) {
        console.error("Cover letter generation failed:", response.status);
        addToast({ title: "Failed to generate cover letter", variant: "error" });
        setGenerating(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
          if (data === "") {
            fullText += "\n\n";
            continue;
          }
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
              }
              if (parsed.artifact) {
                setArtifacts((prev) => [...prev, parsed.artifact]);
              }
            } catch {
              fullText += data;
            }
          }
        }
        setCoverLetterPreview(fullText);
      }

      setGenerating(false);
      const updatedArtifacts = await fetch(`/api/roles/${id}/artifacts`).then((r) => r.json() as Promise<Artifact[]>);
      setArtifacts(updatedArtifacts);
    } catch (error) {
      console.error("Cover letter error:", error);
      addToast({ title: "Cover letter generation failed", variant: "error" });
      setGenerating(false);
    }
  }, [role, id, coverLetterContext, addToast]);

  const startEditingCoverLetter = () => {
    setEditingCoverLetter(true);
    setCoverLetterEditText(coverLetterPreview);
  };

  const saveCoverLetterEdit = () => {
    setCoverLetterPreview(coverLetterEditText);
    setEditingCoverLetter(false);
  };

  const acceptCoverLetter = async () => {
    if (!id || !coverLetterPreview) return;
    
    setSavingCoverLetter(true);
    try {
      const response = await fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_letter: coverLetterPreview }),
      });
      
      if (response.ok) {
        setCoverLetterPreview("");
        const updatedRole = await response.json();
        setRole(updatedRole);
      }
    } catch (error) {
      console.error("Failed to save cover letter:", error);
      addToast({ title: "Failed to save cover letter", variant: "error" });
    } finally {
      setSavingCoverLetter(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!id) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      if (response.ok) {
        navigate("/pipeline");
      } else {
        console.error("Failed to delete role");
        addToast({ title: "Failed to delete role", variant: "error" });
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error("Failed to delete role:", error);
      addToast({ title: "Failed to delete role", variant: "error" });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSaveTimestamp = async () => {
    if (!role?.application_id || !timestampValue) return;
    
    setSavingTimestamp(true);
    try {
      const utcTimestamp = new Date(timestampValue).toISOString().replace('T', ' ').slice(0, 19);
      
      const response = await fetch(`/api/applications/${role.application_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applied_at: utcTimestamp })
      });
      
      if (response.ok) {
        await loadRoleData();
        setEditingTimestamp(false);
      } else {
        console.error("Failed to update timestamp");
      }
    } catch (error) {
      console.error("Failed to update timestamp:", error);
    } finally {
      setSavingTimestamp(false);
    }
  };

  const openTimestampEditor = () => {
    if (role?.application_id) {
      const currentDate = new Date();
      const localISO = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setTimestampValue(localISO);
      setEditingTimestamp(true);
    }
  };

  const generateLinkedInMessage = async () => {
    if (!role || !id) return;
    
    setGeneratingLinkedIn(true);
    setLinkedInPreview("");
    try {
      const response = await fetch(`/api/roles/${id}/generate-linkedin-message`, {
        method: "POST",
      });
      
      if (response.ok) {
        const data = await response.json();
        const preview = JSON.stringify({ subject: data.subject, message: data.message });
        setLinkedInPreview(preview);
      } else {
        console.error("Failed to generate LinkedIn message");
      }
    } catch (error) {
      console.error("Failed to generate LinkedIn message:", error);
    } finally {
      setGeneratingLinkedIn(false);
    }
  };

  const startEditingLinkedIn = () => {
    if (!role) return;
    const content = linkedInPreview || role.linkedin_message || "";
    setEditingLinkedIn(true);
    try {
      const parsed = JSON.parse(content);
      setLinkedInEditText(parsed.message || content);
    } catch {
      setLinkedInEditText(content);
    }
  };

  const saveLinkedInEdit = () => {
    if (!role) return;
    try {
      const current = JSON.parse(linkedInPreview || role.linkedin_message || "{}");
      const updated = JSON.stringify({ ...current, message: linkedInEditText });
      setLinkedInPreview(updated);
    } catch {
      setLinkedInPreview(JSON.stringify({ subject: "", message: linkedInEditText }));
    }
    setEditingLinkedIn(false);
  };

  const acceptLinkedIn = async () => {
    if (!id || !role) return;
    const content = linkedInPreview || role.linkedin_message;
    if (!content) return;
    
    setSavingLinkedIn(true);
    try {
      const response = await fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_message: content }),
      });
      
      if (response.ok) {
        setRole({ ...role, linkedin_message: content });
        setLinkedInPreview("");
      }
    } catch (error) {
      console.error("Failed to save LinkedIn message:", error);
      addToast({ title: "Failed to save LinkedIn message", variant: "error" });
    } finally {
      setSavingLinkedIn(false);
    }
  };

  const loadSavedQuestions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/roles/${id}/questions`);
      if (res.ok) {
        const data = await res.json();
        setSavedQuestions(data);
      }
    } catch (error) {
      console.error("Failed to load questions:", error);
      addToast({ title: "Failed to load questions", variant: "error" });
    }
  }, [id]);

  const generateQuestionAnswer = async () => {
    if (!id || !currentQuestion.trim()) return;
    
    setGeneratingAnswer(true);
    setAnswerOptions([]);
    setEditingOptionIndex(null);
    try {
      const response = await fetch(`/api/roles/${id}/questions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: currentQuestion }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnswerOptions(data.answers || [data.answer].filter(Boolean));
      } else {
        console.error("Failed to generate answer");
        addToast({ title: "Failed to generate answer", variant: "error" });
      }
    } catch (error) {
      console.error("Failed to generate answer:", error);
      addToast({ title: "Failed to generate answer", variant: "error" });
    } finally {
      setGeneratingAnswer(false);
    }
  };

  const acceptAnswer = async (answer: string) => {
    if (!id || !currentQuestion.trim()) return;
    
    setSavingQuestion(true);
    try {
      const response = await fetch(`/api/roles/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          generated_answer: answer,
          submitted_answer: answer,
        }),
      });
      
      if (response.ok) {
        setCurrentQuestion("");
        setAnswerOptions([]);
        setEditingOptionIndex(null);
        setEditingOptionText("");
        await loadSavedQuestions();
      }
    } catch (error) {
      console.error("Failed to save question:", error);
      addToast({ title: "Failed to save question", variant: "error" });
    } finally {
      setSavingQuestion(false);
    }
  };

  const startEditingOption = (index: number) => {
    setEditingOptionIndex(index);
    setEditingOptionText(answerOptions[index] ?? "");
  };

  const saveEditedOption = () => {
    if (editingOptionIndex === null) return;
    const updated = [...answerOptions];
    updated[editingOptionIndex] = editingOptionText;
    setAnswerOptions(updated);
    setEditingOptionIndex(null);
    setEditingOptionText("");
  };

  const cancelEditingOption = () => {
    setEditingOptionIndex(null);
    setEditingOptionText("");
  };

  const clearQuestionForm = () => {
    setCurrentQuestion("");
    setAnswerOptions([]);
    setEditingOptionIndex(null);
    setEditingOptionText("");
  };

  const deleteQuestionById = async (questionId: string) => {
    try {
      await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
      await loadSavedQuestions();
    } catch (error) {
      console.error("Failed to delete question:", error);
      addToast({ title: "Failed to delete question", variant: "error" });
    }
  };

  const researchCompany = async () => {
    if (!company?.id) return;
    
    setResearchingCompany(true);
    try {
      const response = await fetch(`/api/companies/${company.id}/research`, {
        method: "POST",
      });
      
      if (response.ok) {
        const data = await response.json();
        setCompany(data.company);
      }
    } catch (error) {
      console.error("Failed to research company:", error);
      addToast({ title: "Failed to research company", variant: "error" });
    } finally {
      setResearchingCompany(false);
    }
  };

  const loadInterviews = useCallback(async () => {
    if (!role?.application_id) return;
    
    setLoadingInterviews(true);
    try {
      const response = await fetch(`/api/applications/${role.application_id}/interviews`);
      if (response.ok) {
        const data = await response.json();
        setInterviews(data);
      }
    } catch (error) {
      console.error("Failed to load interviews:", error);
      addToast({ title: "Failed to load interviews", variant: "error" });
    } finally {
      setLoadingInterviews(false);
    }
  }, [role?.application_id]);

  useEffect(() => {
    if (role?.application_id) {
      loadInterviews();
    }
  }, [role?.application_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id) {
      loadSavedQuestions();
    }
  }, [id, loadSavedQuestions]);

  useEffect(() => {
    const checkCalendarStatus = async () => {
      try {
        const response = await fetch("/api/oauth/google/status");
        const data = await response.json();
        setCalendarConnected(data.connected);
      } catch {
        setCalendarConnected(false);
      }
    };
    checkCalendarStatus();
  }, []);

  const syncToCalendar = async (interviewId: string) => {
    setSyncingCalendar(interviewId);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/sync-calendar`, {
        method: "POST",
      });
      if (response.ok) {
        await loadInterviews();
      }
    } catch (error) {
      console.error("Failed to sync to calendar:", error);
      addToast({ title: "Failed to sync to calendar", variant: "error" });
    } finally {
      setSyncingCalendar(null);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      const response = await fetch("/api/oauth/google/authorize");
      const data = await response.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Failed to start OAuth:", error);
      addToast({ title: "Failed to connect Google Calendar", variant: "error" });
    }
  };

  const openInterviewDialog = (interview?: Interview) => {
    if (interview) {
      setEditingInterview(interview);
      const scheduledDate = parseUTCDate(interview.scheduled_at);
      const localISO = new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setInterviewForm({
        scheduled_at: localISO,
        interview_type: interview.interview_type || "",
        interviewer_name: interview.interviewer_name || "",
        interviewer_title: interview.interviewer_title || "",
        notes: interview.notes || "",
        outcome: interview.outcome || "pending",
        duration_minutes: String(interview.duration_minutes || 60),
        location: interview.location || "",
        video_link: interview.video_link || "",
        rating: interview.rating ? String(interview.rating) : ""
      });

    } else {
      setEditingInterview(null);
      const currentDate = new Date();
      const localISO = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setInterviewForm({
        scheduled_at: localISO,
        interview_type: "",
        interviewer_name: "",
        interviewer_title: "",
        notes: "",
        outcome: "pending",
        duration_minutes: "60",
        location: "",
        video_link: "",
        rating: ""
      });
    }
    setShowInterviewDialog(true);
  };

  const saveInterview = async () => {
    if (!role?.application_id) return;
    
    const utcTimestamp = new Date(interviewForm.scheduled_at).toISOString().replace('T', ' ').slice(0, 19);
    const parsedRating = Number(interviewForm.rating);
    const ratingValue = Number.isFinite(parsedRating) && parsedRating >= 1 && parsedRating <= 10
      ? parsedRating
      : null;
    
    try {
      if (editingInterview) {
        const response = await fetch(`/api/interviews/${editingInterview.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduled_at: utcTimestamp,
            interview_type: interviewForm.interview_type || null,
            interviewer_name: interviewForm.interviewer_name || null,
            interviewer_title: interviewForm.interviewer_title || null,
            notes: interviewForm.notes || null,
            outcome: interviewForm.outcome || null,
            rating: ratingValue,
            duration_minutes: parseInt(interviewForm.duration_minutes) || 60,
            location: interviewForm.location || null,
            video_link: interviewForm.video_link || null,
          })
        });
        
        if (response.ok) {
          await loadInterviews();
          setShowInterviewDialog(false);
        }
      } else {
        const response = await fetch(`/api/applications/${role.application_id}/interviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            application_id: role.application_id,
            scheduled_at: utcTimestamp,
            interview_type: interviewForm.interview_type || null,
            interviewer_name: interviewForm.interviewer_name || null,
            interviewer_title: interviewForm.interviewer_title || null,
            notes: interviewForm.notes || null,
            outcome: interviewForm.outcome || null,
            rating: ratingValue,
            duration_minutes: parseInt(interviewForm.duration_minutes) || 60,
            location: interviewForm.location || null,
            video_link: interviewForm.video_link || null,
          })
        });
        
        if (response.ok) {
          await loadInterviews();
          setShowInterviewDialog(false);
        }
      }
    } catch (error) {
      console.error("Failed to save interview:", error);
      addToast({ title: "Failed to save interview", variant: "error" });
    }
  };

  const deleteInterview = async (interviewId: string) => {
    if (!confirm("Are you sure you want to delete this interview?")) return;
    
    try {
      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        await loadInterviews();
      }
    } catch (error) {
      console.error("Failed to delete interview:", error);
      addToast({ title: "Failed to delete interview", variant: "error" });
    }
  };

  const updateInterviewPrep = async (
    interviewId: string,
    field: InterviewPrepField,
    value: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) {
        addToast({ title: "Failed to update interview prep", variant: "error" });
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to update interview prep:", error);
      addToast({ title: "Failed to update interview prep", variant: "error" });
      return false;
    }
  };

  const prepFieldKey = (interviewId: string, field: InterviewPrepField) => `${interviewId}:${field}`;

  const formatPrepMarkdown = (value: string): string => {
    const normalized = value.replace(/\r\n/g, "\n").trim();
    if (!normalized) return "";
    const bulletized = normalized.replace(/•\s+/g, "\n- ");
    const lines = bulletized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.startsWith("-") || line.startsWith("*") ? line : `- ${line}`));
    return lines.join("\n");
  };

  const startPrepEdit = (interviewId: string, field: InterviewPrepField, value: string | null) => {
    const key = prepFieldKey(interviewId, field);
    setPrepDrafts((prev) => ({ ...prev, [key]: value ?? "" }));
    setPrepEditing((prev) => ({ ...prev, [key]: true }));
  };

  const updatePrepDraft = (interviewId: string, field: InterviewPrepField, value: string) => {
    const key = prepFieldKey(interviewId, field);
    setPrepDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const savePrepEdit = async (interviewId: string, field: InterviewPrepField) => {
    const key = prepFieldKey(interviewId, field);
    const value = prepDrafts[key] ?? "";
    setSavingPrepEdits((prev) => ({ ...prev, [key]: true }));
    const success = await updateInterviewPrep(interviewId, field, value);
    if (success) {
      setInterviews((prev) =>
        prev.map((interview) => (interview.id === interviewId ? { ...interview, [field]: value } : interview))
      );
      setPrepEditing((prev) => ({ ...prev, [key]: false }));
    }
    setSavingPrepEdits((prev) => ({ ...prev, [key]: false }));
  };

  const generateInterviewPrep = async (interviewId: string) => {
    setPrepOpen((prev) => ({ ...prev, [interviewId]: true }));
    setGeneratingPrepId(interviewId);
    try {
      const guidance = prepGuidance[interviewId]?.trim();
      const response = await fetch(`/api/interviews/${interviewId}/generate-prep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance: guidance || undefined }),
      });
      if (response.ok) {
        const data = await response.json();
        await Promise.all([
          data.prep_notes && updateInterviewPrep(interviewId, "prep_notes", data.prep_notes),
          data.questions_to_ask && updateInterviewPrep(interviewId, "questions_to_ask", data.questions_to_ask),
          data.research_notes && updateInterviewPrep(interviewId, "research_notes", data.research_notes),
        ]);
        await loadInterviews();
      }
    } catch (error) {
      console.error("Failed to generate interview prep:", error);
      addToast({ title: "Failed to generate interview prep", variant: "error" });
    } finally {
      setGeneratingPrepId(null);
    }
  };

  const startEditingFollowUp = (interviewId: string, value: string) => {
    setEditingFollowUp((prev) => ({ ...prev, [interviewId]: true }));
    setFollowUpEditText((prev) => ({ ...prev, [interviewId]: value }));
  };

  const updateFollowUpDraft = (interviewId: string, value: string) => {
    setFollowUpEditText((prev) => ({ ...prev, [interviewId]: value }));
  };

  const saveFollowUpEdit = (interviewId: string) => {
    const value = followUpEditText[interviewId] ?? "";
    setFollowUpPreview((prev) => ({ ...prev, [interviewId]: value }));
    setEditingFollowUp((prev) => ({ ...prev, [interviewId]: false }));
  };

  const acceptFollowUp = async (interviewId: string) => {
    const note = followUpPreview[interviewId];
    if (!note) return;

    setSavingFollowUp((prev) => ({ ...prev, [interviewId]: true }));
    try {
      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_note: note }),
      });
      if (!response.ok) {
        addToast({ title: "Failed to save follow-up", variant: "error" });
        return;
      }
      const updated = (await response.json()) as Interview;
      setInterviews((prev) => prev.map((interview) => (interview.id === interviewId ? updated : interview)));
      setFollowUpPreview((prev) => {
        const next = { ...prev };
        delete next[interviewId];
        return next;
      });
      setEditingFollowUp((prev) => ({ ...prev, [interviewId]: false }));
    } catch (error) {
      console.error("Failed to save follow-up:", error);
      addToast({ title: "Failed to save follow-up", variant: "error" });
    } finally {
      setSavingFollowUp((prev) => ({ ...prev, [interviewId]: false }));
    }
  };

  const generateFollowUp = async (interviewId: string) => {
    setFollowUpOpen((prev) => ({ ...prev, [interviewId]: true }));
    setGeneratingFollowUpId(interviewId);
    try {
      const guidance = followUpGuidance[interviewId]?.trim();
      const response = await fetch(`/api/interviews/${interviewId}/generate-follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance: guidance || undefined }),
      });
      if (!response.ok) {
        addToast({ title: "Failed to generate follow-up", variant: "error" });
        return;
      }
      const data = (await response.json()) as { follow_up_note?: string };
      if (data.follow_up_note) {
        setFollowUpPreview((prev) => ({ ...prev, [interviewId]: data.follow_up_note ?? "" }));
        setEditingFollowUp((prev) => ({ ...prev, [interviewId]: false }));
      }
    } catch (error) {
      console.error("Failed to generate follow-up:", error);
      addToast({ title: "Failed to generate follow-up", variant: "error" });
    } finally {
      setGeneratingFollowUpId(null);
    }
  };

  const saveTranscript = async (interviewId: string, transcriptValue: string) => {
    setSavingTranscript((prev) => ({ ...prev, [interviewId]: true }));
    try {
      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptValue.trim() || null }),
      });
      if (!response.ok) {
        addToast({ title: "Failed to save transcript", variant: "error" });
        return;
      }
      const updated = (await response.json()) as Interview;
      setInterviews((prev) => prev.map((interview) => (interview.id === interviewId ? updated : interview)));
    } catch (error) {
      console.error("Failed to save transcript:", error);
      addToast({ title: "Failed to save transcript", variant: "error" });
    } finally {
      setSavingTranscript((prev) => ({ ...prev, [interviewId]: false }));
    }
  };

  const analyzeTranscript = async (interviewId: string, transcriptValue: string) => {
    if (!transcriptValue.trim()) {
      addToast({ title: "Add a transcript to analyze", variant: "error" });
      return;
    }

    setCallReviewOpen((prev) => ({ ...prev, [interviewId]: true }));
    setAnalyzing((prev) => ({ ...prev, [interviewId]: true }));
    try {
      const response = await fetch(`/api/interviews/${interviewId}/analyze-transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        addToast({
          title: "Failed to analyze transcript",
          description: data.error ?? "Please try again",
          variant: "error",
        });
        return;
      }
      const analysis = data.analysis_notes ?? "";
      setAnalyses((prev) => ({ ...prev, [interviewId]: analysis }));
      setInterviews((prev) =>
        prev.map((interview) => (interview.id === interviewId ? { ...interview, analysis_notes: analysis } : interview))
      );
    } catch (error) {
      console.error("Failed to analyze transcript:", error);
      addToast({ title: "Failed to analyze transcript", variant: "error" });
    } finally {
      setAnalyzing((prev) => ({ ...prev, [interviewId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/20">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted shadow-inner">
          <Briefcase className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Role not found</h1>
          <p className="text-muted-foreground mt-2">The role you're looking for doesn't exist or has been removed.</p>
        </div>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/pipeline">Back to Pipeline</Link>
        </Button>
      </div>
    );
  }

  let fitData: any = null;
  if (research?.fit_analysis) {
    try {
      fitData = JSON.parse(research.fit_analysis);
    } catch (e) {
      console.error("Failed to parse fit analysis JSON", e);
    }
  }

  const pipelineStages = ["wishlist", "applied", "interviewing", "offer", "rejected", "accepted"];
  const activeStages = ["wishlist", "applied", "interviewing", "offer"];
  const currentStageIndex = role.application_status 
    ? activeStages.indexOf(role.application_status) 
    : 0;
  const nextStage = currentStageIndex >= 0 && currentStageIndex < activeStages.length - 1 
    ? activeStages[currentStageIndex + 1] 
    : null;
  const isArchived = role.application_status === "rejected" || role.application_status === "accepted";

  const stageColors: Record<string, string> = {
    applied: "bg-blue-600 hover:bg-blue-700 text-white",
    interviewing: "bg-purple-600 hover:bg-purple-700 text-white",
    offer: "bg-green-600 hover:bg-green-700 text-white",
  };

  const advanceStage = async (newStatus: string) => {
    if (!id) return;
    try {
      let applicationId = role.application_id;
      
      if (!applicationId) {
        const createResponse = await fetch(`/api/roles/${id}/applications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (createResponse.ok) {
          const newApp = await createResponse.json();
          setRole({ ...role, application_id: newApp.id, application_status: newStatus });
        }
        return;
      }
      
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        setRole({ ...role, application_status: newStatus });
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      addToast({ title: "Failed to update status", variant: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/5 pb-20">
      <div className="bg-background border-b shadow-sm sticky top-0 z-30">
        <div className="container max-w-7xl mx-auto py-6 px-4 md:px-6">
          <div className="flex flex-col gap-6">
            <Link 
              to="/pipeline" 
              className="group flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors w-fit"
            >
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Pipeline
            </Link>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm p-3 flex items-center justify-center group transition-all hover:shadow-md hover:border-primary/20">
                  {company?.logo_url ? (
                    <img 
                      src={company.logo_url} 
                      alt={`${role.company_name} logo`}
                      className="h-full w-full object-contain transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-muted-foreground/30" />
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{role.title}</h1>
                    {role.application_status && (
                      <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-bold px-2 py-0.5 border-primary/20 bg-primary/5 text-primary">
                        {role.application_status}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-xl font-medium text-muted-foreground flex items-center gap-2">
                    {role.company_name}
                    {company?.website && (
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground/50 hover:text-primary transition-colors p-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 mt-3 text-sm font-medium text-muted-foreground">
                    {role.location && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-transparent hover:border-border transition-colors">
                        <MapPin className="h-3.5 w-3.5" />
                        {role.location}
                      </div>
                    )}
                    {(role.compensation_min && role.compensation_max) ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-transparent hover:border-border transition-colors">
                        {formatCompensation(role.compensation_min, role.compensation_max)}
                      </div>
                    ) : role.compensation_range ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-transparent hover:border-border transition-colors">
                        {role.compensation_range}
                      </div>
                    ) : null}
                    {company?.headquarters && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-transparent hover:border-border transition-colors">
                        <Globe className="h-3.5 w-3.5" />
                        HQ: {company.headquarters}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2">
                  {!isArchived && nextStage && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => advanceStage(nextStage)}
                      className={cn("h-9", stageColors[nextStage] || "")}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Move to {nextStage.charAt(0).toUpperCase() + nextStage.slice(1)}
                    </Button>
                  )}
                  {!isArchived && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => advanceStage("rejected")}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:border-destructive"
                      title="Archive"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  {role.job_url && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRefreshRole}
                      disabled={refreshingRole}
                      className="h-9 w-9"
                      title="Sync Data"
                    >
                      <RefreshCw className={cn("h-4 w-4", refreshingRole && "animate-spin")} />
                    </Button>
                  )}
                </div>

                {fitData && fitData.confidence_score && (
                  <div className="flex items-stretch overflow-hidden rounded-lg border bg-background shadow-sm">
                    <div className="flex flex-col items-center justify-center px-4 py-2 bg-gradient-to-b from-primary/5 to-transparent">
                      <span className="text-2xl font-bold text-primary tabular-nums tracking-tight">
                        {fitData.confidence_score.overall * 10}%
                      </span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Match
                      </span>
                    </div>
                    <div className="w-px bg-border" />
                    <div className="flex flex-col justify-center gap-1 px-4 py-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">Enjoyment</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {fitData.confidence_score.enjoyment * 10}%
                        </span>
                      </div>
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ width: `${fitData.confidence_score.enjoyment * 10}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between gap-3 text-xs mt-1">
                        <span className="text-muted-foreground">Qualifications</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {fitData.confidence_score.qualifications * 10}%
                        </span>
                      </div>
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full" 
                          style={{ width: `${fitData.confidence_score.qualifications * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto py-8 px-4 md:px-6">
        <Tabs defaultValue="overview" className="w-full space-y-8">
          <TabsList className="w-full h-14 p-1.5 bg-gradient-to-b from-muted/60 to-muted/40 backdrop-blur-sm border-2 border-border/50 rounded-2xl shadow-lg grid grid-cols-6">
            <TabsTrigger 
              value="overview"
              className="rounded-xl font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/30 transition-all hover:bg-background/50"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="fit_analysis"
              className="rounded-xl font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/30 transition-all hover:bg-background/50"
            >
              Analysis
            </TabsTrigger>
            <TabsTrigger 
              value="application"
              className="rounded-xl font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/30 transition-all hover:bg-background/50"
            >
              Application
            </TabsTrigger>
            <TabsTrigger 
              value="interview_prep"
              className="rounded-xl font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/30 transition-all hover:bg-background/50"
            >
              Preparation
            </TabsTrigger>
            <TabsTrigger 
              value="interviews"
              className="rounded-xl font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/30 transition-all hover:bg-background/50"
            >
              Interviews
            </TabsTrigger>
            <TabsTrigger 
              value="activity"
              className="rounded-xl font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/30 transition-all hover:bg-background/50"
            >
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-none shadow-sm ring-1 ring-border/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-xl font-semibold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Job Description
                      </CardTitle>
                      <CardDescription>
                        Key responsibilities and requirements
                      </CardDescription>
                    </div>
                    {!editingJd && role.jd_text && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingJd(true)} className="h-8">
                        Edit
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-6">
                    {editingJd ? (
                      <div className="space-y-4">
                        <Textarea
                          value={jdText}
                          onChange={(e) => setJdText(e.target.value)}
                          placeholder="Paste the job description here..."
                          className="min-h-[400px] font-mono text-sm leading-relaxed p-4 bg-muted/30"
                        />
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            onClick={() => {
                              setJdText(role.jd_text ?? "");
                              setEditingJd(false);
                            }}
                            disabled={savingJd}
                          >
                            Cancel
                          </Button>
                          <Button onClick={saveJd} disabled={savingJd}>
                            {savingJd ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    ) : role.jd_text ? (
                      <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary hover:prose-a:underline">
                        <ReactMarkdown>{role.jd_text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 px-4 bg-muted/10 rounded-lg border-2 border-dashed">
                        <div className="bg-muted/50 p-4 rounded-full mb-4">
                          <FileText className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No Job Description</h3>
                        <p className="text-muted-foreground mb-6 text-center max-w-sm">
                          Add the job description to unlock AI analysis, cover letter generation, and interview prep.
                        </p>
                        <Button onClick={() => setEditingJd(true)}>
                          Add Job Description
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-none shadow-sm ring-1 ring-border/50 h-fit">
                  <CardHeader>
                    <CardTitle className="text-lg">Role Essentials</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 divide-y">
                    {company?.website && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-muted-foreground">Website</span>
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
                        >
                          {company.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} 
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {role.job_url && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-muted-foreground">Original Posting</span>
                        <a
                          href={role.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
                        >
                          View Job Post <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-muted-foreground">Level</span>
                      <span className="text-sm font-medium">{role.level || "Not specified"}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-muted-foreground">Location</span>
                      <span className="text-sm font-medium text-right max-w-[60%]">{role.location || "Remote / Not specified"}</span>
                    </div>
                    {role.applied_at && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-muted-foreground">Applied On</span>
                        <span className="text-sm font-medium">{parseUTCDate(role.applied_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border/50 h-fit">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg">About {company?.name || "Company"}</CardTitle>
                    {company && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={researchCompany}
                        disabled={researchingCompany}
                        className="h-8"
                      >
                        {researchingCompany ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        {researchingCompany ? "Researching..." : "Research"}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(company?.industry || company?.funding_status || company?.company_size || company?.established_date) && (
                      <div className="grid grid-cols-2 gap-3">
                        {company?.industry && (() => {
                          try {
                            const ind = JSON.parse(company.industry);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">Industry</span>
                                <span className="text-sm font-medium">{ind.primary}</span>
                              </div>
                            );
                          } catch { return null; }
                        })()}
                        {company?.company_size && (() => {
                          try {
                            const size = JSON.parse(company.company_size);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">Company Size</span>
                                <span className="text-sm font-medium">{size.employees_estimate}</span>
                              </div>
                            );
                          } catch { return null; }
                        })()}
                        {company?.funding_status && (() => {
                          try {
                            const funding = JSON.parse(company.funding_status);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">Funding</span>
                                <span className="text-sm font-medium">
                                  {funding.type}{funding.last_round ? ` (${funding.last_round})` : ""}
                                </span>
                              </div>
                            );
                          } catch { return null; }
                        })()}
                        {company?.established_date && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">Founded</span>
                            <span className="text-sm font-medium">{company.established_date}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {company?.description ? (
                      <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed line-clamp-[10]">
                        <ReactMarkdown>{company.description}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-8 px-4">
                        <p className="text-sm text-muted-foreground italic">No company description available.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fit_analysis" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            {!research && !generatingResearch && (
               <div className="flex flex-col items-center justify-center py-24 px-4 bg-muted/10 rounded-xl border border-dashed">
                 <div className="bg-primary/10 p-4 rounded-full mb-4">
                   <Sparkles className="h-10 w-10 text-primary" />
                 </div>
                 <h3 className="text-xl font-bold mb-2">Unlock AI Analysis</h3>
                 <p className="text-muted-foreground mb-6 text-center max-w-md">
                   Get a comprehensive fit analysis, identifying your strengths, gaps, and growth opportunities for this specific role.
                 </p>
                 <Button onClick={handleRefreshRole} size="lg" className="shadow-md">
                   Generate Analysis
                 </Button>
               </div>
            )}

            {generatingResearch && (
              <div className="flex flex-col items-center justify-center py-24 px-4 bg-muted/10 rounded-xl border">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-6" />
                <h3 className="text-xl font-semibold mb-2">Analyzing Role Fit...</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Our AI is reviewing the job description against your profile to identify matches and opportunities.
                </p>
              </div>
            )}

            {fitData && (
              <>
                {fitData.overall_fit_summary && (
                  <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <Sparkles className="h-5 w-5" /> Executive Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base leading-relaxed text-foreground/90 font-medium max-w-4xl">
                        {fitData.overall_fit_summary}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-6">
                     <Card className="h-full border-none shadow-sm ring-1 ring-border/50">
                       <CardHeader className="bg-gradient-to-r from-green-50 to-transparent border-b border-green-100 dark:from-green-950/20 dark:border-green-900/50">
                         <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                           <Target className="h-5 w-5" />
                           Why This Is a Great Match
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-8 pt-6">
                         <div>
                           <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Why you'd enjoy this role</h4>
                           <ul className="grid gap-3">
                             {fitData.enjoyment_fit?.why_the_candidate_would_enjoy_this_role?.map((item: string, i: number) => (
                               <li key={i} className="flex gap-3 text-sm leading-relaxed">
                                 <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]" />
                                 <span>{item}</span>
                               </li>
                             ))}
                           </ul>
                         </div>

                         <div className="w-full h-px bg-border/50" />

                         <div>
                           <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Company Environment</h4>
                           <ul className="grid gap-3">
                             {fitData.enjoyment_fit?.why_the_company_environment_is_a_good_match?.map((item: string, i: number) => (
                               <li key={i} className="flex gap-3 text-sm leading-relaxed">
                                 <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]" />
                                 <span>{item}</span>
                               </li>
                             ))}
                           </ul>
                         </div>

                         <div className="w-full h-px bg-border/50" />

                         <div>
                           <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Career Growth</h4>
                           <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                             {fitData.growth_and_trajectory?.how_this_role_supports_career_goals}
                           </p>
                           {fitData.growth_and_trajectory?.skills_or_experiences_the_candidate_would_gain?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {fitData.growth_and_trajectory.skills_or_experiences_the_candidate_would_gain.map((skill: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="bg-muted/50 hover:bg-muted transition-colors font-normal">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                           )}
                         </div>
                       </CardContent>
                     </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="h-full border-none shadow-sm ring-1 ring-border/50">
                      <CardHeader className="border-b">
                        <CardTitle className="flex items-center gap-2">
                          <Briefcase className="h-5 w-5 text-primary" />
                          Qualifications Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 pt-6">
                        {fitData.qualification_fit?.strong_matches?.length > 0 && (
                          <div className="rounded-xl bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/20 p-5">
                            <h4 className="font-bold text-sm text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" /> Strong Matches
                            </h4>
                            <ul className="space-y-2">
                              {fitData.qualification_fit.strong_matches.map((item: string, i: number) => (
                                <li key={i} className="text-sm text-green-800/80 dark:text-green-300/80 pl-6 relative">
                                  <span className="absolute left-1.5 top-2 h-1 w-1 bg-green-500 rounded-full" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {fitData.qualification_fit?.partial_matches?.length > 0 && (
                          <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 p-5">
                            <h4 className="font-bold text-sm text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" /> Partial Matches
                            </h4>
                            <ul className="space-y-2">
                              {fitData.qualification_fit.partial_matches.map((item: string, i: number) => (
                                <li key={i} className="text-sm text-amber-800/80 dark:text-amber-300/80 pl-6 relative">
                                  <span className="absolute left-1.5 top-2 h-1 w-1 bg-amber-500 rounded-full" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {fitData.qualification_fit?.gaps_or_risks?.length > 0 && (
                          <div className="rounded-xl bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20 p-5">
                            <h4 className="font-bold text-sm text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                              <XCircle className="h-4 w-4" /> Gaps & Risks
                            </h4>
                            <ul className="space-y-2">
                              {fitData.qualification_fit.gaps_or_risks.map((item: string, i: number) => (
                                <li key={i} className="text-sm text-red-800/80 dark:text-red-300/80 pl-6 relative">
                                  <span className="absolute left-1.5 top-2 h-1 w-1 bg-red-500 rounded-full" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {fitData.recommendations?.length > 0 && (
                  <Card className="border-none shadow-sm ring-1 ring-border/50 bg-muted/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Strategic Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid gap-4 md:grid-cols-2">
                        {fitData.recommendations.map((item: string, i: number) => (
                          <li key={i} className="flex gap-4 p-4 bg-background rounded-lg border shadow-sm items-start">
                             <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                               {i + 1}
                             </div>
                             <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
            
            {research && !fitData && (
              <Card className="border-none shadow-sm ring-1 ring-border/50">
                 <CardContent className="pt-6">
                   <div className="prose prose-sm max-w-none dark:prose-invert">
                     <ReactMarkdown>{research.fit_analysis || ""}</ReactMarkdown>
                   </div>
                 </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="interview_prep" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <div className="space-y-8">
                 <section className="space-y-4">
                   <div className="flex items-center gap-2">
                      <div className="h-8 w-1 bg-primary rounded-full" />
                      <h3 className="text-lg font-bold tracking-tight">Company Intel</h3>
                   </div>
                   <Card className="border-none shadow-sm ring-1 ring-border/50">
                     <CardContent className="pt-6">
                        {research?.company_profile ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed whitespace-pre-wrap">
                            <ReactMarkdown>{research.company_profile}</ReactMarkdown>
                          </div>
                        ) : (
                         <div className="text-center py-8">
                           <p className="text-sm text-muted-foreground italic">Research not available yet.</p>
                         </div>
                       )}
                     </CardContent>
                   </Card>
                 </section>

                 <section className="space-y-4">
                   <div className="flex items-center gap-2">
                      <div className="h-8 w-1 bg-blue-500 rounded-full" />
                      <h3 className="text-lg font-bold tracking-tight">Strategic Talking Points</h3>
                   </div>
                   <Card className="border-none shadow-sm ring-1 ring-border/50">
                     <CardContent className="pt-6">
                        {research?.talking_points ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed whitespace-pre-wrap">
                            <ReactMarkdown>{research.talking_points}</ReactMarkdown>
                          </div>
                        ) : (
                         <div className="text-center py-8">
                           <p className="text-sm text-muted-foreground italic">Generate research to see talking points.</p>
                         </div>
                       )}
                     </CardContent>
                   </Card>
                 </section>

                 <section className="space-y-4">
                   <div className="flex items-center gap-2">
                      <div className="h-8 w-1 bg-amber-500 rounded-full" />
                      <h3 className="text-lg font-bold tracking-tight">Expected Questions</h3>
                   </div>
                   <Card className="border-none shadow-sm ring-1 ring-border/50">
                     <CardContent className="pt-6">
                        {research?.interview_questions ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed whitespace-pre-wrap">
                            <ReactMarkdown>{research.interview_questions}</ReactMarkdown>
                          </div>
                        ) : (
                         <div className="text-center py-8">
                           <p className="text-sm text-muted-foreground italic">Generate research to see interview questions.</p>
                         </div>
                       )}
                     </CardContent>
                 </Card>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-1 bg-emerald-500 rounded-full" />
                        <h3 className="text-lg font-bold tracking-tight">Questions to Ask</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Regenerate questions"
                        onClick={regenerateQuestionsToAsk}
                        disabled={regeneratingQuestionsToAsk}
                      >
                        <RefreshCw className={regeneratingQuestionsToAsk ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                      </Button>
                    </div>
                    <Card className="border-none shadow-sm ring-1 ring-border/50">
                      <CardContent className="pt-6">
                        {research?.questions_to_ask ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed whitespace-pre-wrap">
                            <ReactMarkdown>{research.questions_to_ask}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground italic">
                              Generate research to see questions to ask the interviewer.
                            </p>
                          </div>
                        )}
                        <div className="mt-6 space-y-2 border-t border-border/50 pt-4">
                          <Label
                            htmlFor="questions-to-ask-guidance"
                            className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 pl-1 select-none"
                          >
                            Refine Results
                          </Label>
                          <Textarea
                            id="questions-to-ask-guidance"
                            value={questionsToAskGuidance}
                            onChange={(event) => setQuestionsToAskGuidance(event.target.value)}
                            placeholder="E.g., focus on team culture, engineering velocity, or recent funding."
                            className="min-h-[2.5rem] resize-none"
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </section>
            </div>
          </TabsContent>

          <TabsContent value="application" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <Card className="border-none shadow-sm ring-1 ring-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileCheck className="h-5 w-5 text-primary" /> 
                      Cover Letter
                    </CardTitle>
                    <CardDescription>AI-generated cover letter for this role</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      {coverLetterPreview && (
                        <div className="p-4 border rounded-lg bg-muted/20">
                          {editingCoverLetter ? (
                            <div className="space-y-2">
                              <Textarea
                                value={coverLetterEditText}
                                onChange={(e) => setCoverLetterEditText(e.target.value)}
                                className="min-h-[300px] resize-none font-mono text-sm"
                                autoFocus
                              />
                              <div className="flex justify-end">
                                <Button
                                  onClick={saveCoverLetterEdit}
                                  size="icon"
                                  variant="ghost"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-end gap-1 mb-2">
                                <Button
                                  onClick={startEditingCoverLetter}
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={acceptCoverLetter}
                                  disabled={savingCoverLetter}
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                >
                                  {savingCoverLetter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </Button>
                              </div>
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown>{coverLetterPreview}</ReactMarkdown>
                                {generating && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {!coverLetterPreview && !generating && !role?.cover_letter ? (
                        <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                          No cover letter generated yet
                        </div>
                      ) : null}
                      {!coverLetterPreview && !generating && role?.cover_letter && (
                        <div className="p-4 border rounded-lg bg-muted/20">
                          <div className="flex justify-end gap-1 mb-2">
                            <span className="text-xs text-muted-foreground mr-auto flex items-center gap-1">
                              <Check className="h-3 w-3" /> Saved
                            </span>
                          </div>
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{role.cover_letter}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {!role?.cover_letter && (
                      <div className="pt-4 border-t space-y-3">
                        <div>
                          <Label htmlFor="cover-letter-context" className="text-sm font-medium">
                            Additional Context (optional)
                          </Label>
                          <Textarea
                            id="cover-letter-context"
                            placeholder="Add specific points to emphasize, achievements to highlight, or tone preferences..."
                            value={coverLetterContext}
                            onChange={(e) => setCoverLetterContext(e.target.value)}
                            className="mt-1.5 min-h-[80px] text-sm"
                          />
                        </div>
                        <Button
                          onClick={generateCoverLetter}
                          disabled={generating || !role.jd_text}
                          className="w-full shadow-sm"
                          variant={coverLetterPreview ? "outline" : "default"}
                        >
                          {generating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Drafting...
                            </>
                          ) : (
                            <>
                              <Zap className="mr-2 h-4 w-4" />
                              {coverLetterPreview ? "Regenerate Cover Letter" : "Generate Cover Letter"}
                          </>
                        )}
                      </Button>
                    </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="h-5 w-5 text-blue-500" /> 
                      LinkedIn Outreach
                    </CardTitle>
                    <CardDescription>AI-crafted message for hiring manager</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const content = linkedInPreview || role.linkedin_message;
                      if (!content && !generatingLinkedIn) {
                        return (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Generate a personalized LinkedIn message that highlights your best match for this role.
                            </p>
                            <Button
                              onClick={generateLinkedInMessage}
                              disabled={generatingLinkedIn || !role.jd_text}
                              className="w-full"
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              Generate Message
                            </Button>
                          </div>
                        );
                      }

                      if (generatingLinkedIn) {
                        return (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Crafting message...</span>
                          </div>
                        );
                      }

                      let subject = "";
                      let message = content || "";
                      try {
                        const parsed = JSON.parse(content || "{}");
                        subject = parsed.subject || "";
                        message = parsed.message || content || "";
                      } catch {
                        message = content || "";
                      }

                      const isPreview = !!linkedInPreview;
                      const isSaved = !!role.linkedin_message && !linkedInPreview;

                      return (
                        <div className="space-y-3">
                          <div className="p-4 border rounded-lg bg-muted/20">
                            {editingLinkedIn ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={linkedInEditText}
                                  onChange={(e) => setLinkedInEditText(e.target.value)}
                                  className="min-h-[200px] resize-none font-mono text-sm"
                                  autoFocus
                                />
                                <div className="flex justify-end">
                                  <Button onClick={saveLinkedInEdit} size="icon" variant="ghost">
                                    <Save className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex justify-end gap-1 mb-2">
                                  {isSaved && (
                                    <span className="text-xs text-muted-foreground mr-auto flex items-center gap-1">
                                      <Check className="h-3 w-3" /> Saved
                                    </span>
                                  )}
                                  {isPreview && (
                                    <>
                                      <Button onClick={startEditingLinkedIn} size="icon" variant="ghost" className="h-8 w-8">
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button onClick={acceptLinkedIn} disabled={savingLinkedIn} size="icon" variant="ghost" className="h-8 w-8">
                                        {savingLinkedIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                      </Button>
                                    </>
                                  )}
                                </div>
                                {subject && (
                                  <div className="mb-3">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</label>
                                    <p className="text-sm font-medium mt-1">{subject}</p>
                                  </div>
                                )}
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</label>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap mt-1">{message}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          {isPreview && (
                            <Button
                              onClick={generateLinkedInMessage}
                              disabled={generatingLinkedIn}
                              variant="ghost"
                              size="sm"
                              className="w-full"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Regenerate
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="border-none shadow-sm ring-1 ring-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5 text-purple-500" /> 
                      Application Questions
                    </CardTitle>
                    <CardDescription>Generate and save answers to application questions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Paste an application question here, e.g. 'Why do you want to join our company?'"
                          value={currentQuestion}
                          onChange={(e) => setCurrentQuestion(e.target.value)}
                          className="min-h-[80px] resize-none"
                        />
                      </div>
                      <Button
                        onClick={generateQuestionAnswer}
                        disabled={generatingAnswer || !currentQuestion.trim()}
                        className="w-full"
                      >
                        {generatingAnswer ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Answer...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Answer
                          </>
                        )}
                      </Button>
                    </div>

                    {answerOptions.length > 0 && (
                      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Question</label>
                          <p className="text-sm">{currentQuestion}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Choose an Answer</label>
                          <div className="space-y-2">
                            {answerOptions.map((option, index) => (
                              <div key={index}>
                                {editingOptionIndex === index ? (
                                  <div className="p-3 rounded-lg border bg-background">
                                    <div className="flex items-start gap-2">
                                      <Textarea
                                        value={editingOptionText}
                                        onChange={(e) => setEditingOptionText(e.target.value)}
                                        className="min-h-[80px] resize-none flex-1"
                                        autoFocus
                                      />
                                      <Button
                                        onClick={saveEditedOption}
                                        size="icon"
                                        variant="ghost"
                                        className="shrink-0"
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors">
                                    <div className="flex items-start gap-2">
                                      <p className="text-sm leading-relaxed flex-1">{option}</p>
                                      <div className="flex gap-1 shrink-0">
                                        <Button
                                          onClick={() => startEditingOption(index)}
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          onClick={() => acceptAnswer(option)}
                                          disabled={savingQuestion}
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                        >
                                          {savingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {savedQuestions.length > 0 && (
                      <div className="space-y-3 pt-4 border-t">
                        <h4 className="text-sm font-medium">Saved Questions</h4>
                        {savedQuestions.map((q) => (
                          <div key={q.id} className="p-3 bg-muted/20 rounded-lg border space-y-2">
                            <p className="text-sm font-medium">{q.question}</p>
                            {q.submitted_answer ? (
                              <p className="text-sm text-muted-foreground">{q.submitted_answer}</p>
                            ) : q.generated_answer ? (
                              <p className="text-sm text-muted-foreground italic">{q.generated_answer}</p>
                            ) : null}
                            <Button
                              onClick={() => deleteQuestionById(q.id)}
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interviews" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <Card className="border-none shadow-sm ring-1 ring-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Interview Schedule
                    </CardTitle>
                    <CardDescription>Track your interview pipeline</CardDescription>
                  </div>
                  <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => openInterviewDialog()} size="sm">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Interview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{editingInterview ? 'Edit Interview' : 'Schedule New Interview'}</DialogTitle>
                        <DialogDescription>
                          {editingInterview ? 'Update interview details and notes' : 'Add a new interview to your schedule'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="scheduled_at">Date & Time</Label>
                            <Input
                              id="scheduled_at"
                              type="datetime-local"
                              value={interviewForm.scheduled_at}
                              onChange={(e) => setInterviewForm({ ...interviewForm, scheduled_at: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                            <select
                              id="duration_minutes"
                              value={interviewForm.duration_minutes}
                              onChange={(e) => setInterviewForm({ ...interviewForm, duration_minutes: e.target.value })}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="30">30 min</option>
                              <option value="45">45 min</option>
                              <option value="60">1 hour</option>
                              <option value="90">1.5 hours</option>
                              <option value="120">2 hours</option>
                              <option value="180">3 hours</option>
                              <option value="240">4 hours</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="interview_type">Interview Type</Label>
                            <select
                              id="interview_type"
                              value={interviewForm.interview_type}
                              onChange={(e) => setInterviewForm({ ...interviewForm, interview_type: e.target.value })}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Select type...</option>
                              <option value="phone_screen">Phone Screen</option>
                              <option value="technical">Technical</option>
                              <option value="behavioral">Behavioral</option>
                              <option value="panel">Panel</option>
                              <option value="onsite">On-site</option>
                              <option value="final">Final Round</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                              id="location"
                              value={interviewForm.location}
                              onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
                              placeholder="Office address or 'Remote'"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="video_link">Video/Meeting Link</Label>
                          <Input
                            id="video_link"
                            value={interviewForm.video_link}
                            onChange={(e) => setInterviewForm({ ...interviewForm, video_link: e.target.value })}
                            placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="interviewer_name">Interviewer Name</Label>
                            <Input
                              id="interviewer_name"
                              value={interviewForm.interviewer_name}
                              onChange={(e) => setInterviewForm({ ...interviewForm, interviewer_name: e.target.value })}
                              placeholder="Jane Smith"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="interviewer_title">Interviewer Title</Label>
                            <Input
                              id="interviewer_title"
                              value={interviewForm.interviewer_title}
                              onChange={(e) => setInterviewForm({ ...interviewForm, interviewer_title: e.target.value })}
                              placeholder="Engineering Manager"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="outcome">Outcome</Label>
                            <select
                              id="outcome"
                              value={interviewForm.outcome}
                              onChange={(e) => setInterviewForm({ ...interviewForm, outcome: e.target.value })}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="pending">Pending</option>
                              <option value="passed">Passed</option>
                              <option value="rejected">Rejected</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rating">Rating</Label>
                            <Input
                              id="rating"
                              type="number"
                              min="1"
                              max="10"
                              value={interviewForm.rating}
                              onChange={(e) => setInterviewForm({ ...interviewForm, rating: e.target.value })}
                              placeholder="1-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={interviewForm.notes}
                            onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                            placeholder="Key topics discussed, impressions, follow-up items..."
                            rows={6}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowInterviewDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveInterview}>
                          {editingInterview ? 'Update Interview' : 'Schedule Interview'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInterviews ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : interviews.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No interviews scheduled yet</p>
                    <Button onClick={() => openInterviewDialog()} variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Your First Interview
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {interviews.map((interview) => {
                      const scheduledDate = parseUTCDate(interview.scheduled_at);
                      const isPast = scheduledDate < new Date();
                      const followUpDraft = followUpPreview[interview.id];
                      const hasFollowUpDraft = followUpDraft !== undefined;
                      const followUpSaved = interview.follow_up_note;
                      const isEditingFollowUp = editingFollowUp[interview.id] ?? false;
                      const followUpEditValue = followUpEditText[interview.id] ?? followUpDraft ?? "";
                      const isSavingFollowUp = savingFollowUp[interview.id] ?? false;
                      const transcriptValue = transcripts[interview.id] ?? interview.transcript ?? "";
                      const analysisValue = analyses[interview.id] ?? interview.analysis_notes ?? "";
                      const isAnalyzing = analyzing[interview.id] ?? false;
                      const isSavingTranscript = savingTranscript[interview.id] ?? false;
                      
                      return (
                        <Card key={interview.id} className="border shadow-sm">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-start gap-4">
                                <div className={cn(
                                  "h-12 w-12 rounded-lg flex items-center justify-center shrink-0",
                                  interview.outcome === "passed" ? "bg-green-100 text-green-700" :
                                  interview.outcome === "rejected" ? "bg-red-100 text-red-700" :
                                  interview.outcome === "cancelled" ? "bg-gray-100 text-gray-700" :
                                  isPast ? "bg-amber-100 text-amber-700" :
                                  "bg-blue-100 text-blue-700"
                                )}>
                                  {interview.outcome === "passed" ? <CheckCircle2 className="h-6 w-6" /> :
                                   interview.outcome === "rejected" ? <XCircle className="h-6 w-6" /> :
                                   <Calendar className="h-6 w-6" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-lg">
                                      {interview.interview_type ? interview.interview_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Interview'}
                                    </h3>
                                    <Badge variant={
                                      interview.outcome === "passed" ? "default" :
                                      interview.outcome === "rejected" ? "destructive" :
                                      interview.outcome === "cancelled" ? "secondary" :
                                      "outline"
                                    }>
                                      {interview.outcome || 'pending'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      {scheduledDate.toLocaleString()}
                                    </div>
                                    {interview.interviewer_name && (
                                      <div className="flex items-center gap-1">
                                        <Briefcase className="h-4 w-4" />
                                        {interview.interviewer_name}
                                        {interview.interviewer_title && ` • ${interview.interviewer_title}`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {calendarConnected && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => syncToCalendar(interview.id)}
                                    disabled={syncingCalendar === interview.id}
                                    title={interview.google_calendar_event_id ? "Update calendar event" : "Add to Google Calendar"}
                                  >
                                    {syncingCalendar === interview.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : interview.google_calendar_event_id ? (
                                      <CalendarCheck className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <CalendarPlus className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openInterviewDialog(interview)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteInterview(interview.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {interview.notes && (
                              <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                                <p className="text-sm font-semibold mb-2">Notes:</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{interview.notes}</p>
                              </div>
                            )}
                            
                            <div className="mt-4 border-t pt-4 space-y-6">
                              <div>
                                <details
                                  className="group"
                                  open={prepOpen[interview.id] ?? false}
                                  onToggle={(event) => {
                                    const details = event.currentTarget;
                                    if (!details) return;
                                    setPrepOpen((prev) => ({
                                      ...prev,
                                      [interview.id]: details.open,
                                    }));
                                  }}
                                >
                                  <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                                    <Target className="h-4 w-4 text-purple-500" />
                                    Interview Prep
                                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                                  </summary>
                                  <div className="mt-4 space-y-6">
                                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                      <div>
                                        <Label
                                          htmlFor={`prep-guidance-${interview.id}`}
                                          className="text-sm font-medium"
                                        >
                                          Prep Guidance (optional)
                                        </Label>
                                        <Textarea
                                          id={`prep-guidance-${interview.id}`}
                                          placeholder="Add specific focus areas, topics to emphasize, or tone preferences..."
                                          value={prepGuidance[interview.id] ?? ""}
                                          onChange={(event) =>
                                            setPrepGuidance((prev) => ({
                                              ...prev,
                                              [interview.id]: event.target.value,
                                            }))
                                          }
                                          className="mt-1.5 min-h-[80px] text-sm"
                                        />
                                      </div>
                                      <Button
                                        onClick={() => generateInterviewPrep(interview.id)}
                                        disabled={generatingPrepId === interview.id}
                                        className="w-full shadow-sm"
                                        variant={
                                          interview.prep_notes || interview.questions_to_ask || interview.research_notes
                                            ? "outline"
                                            : "default"
                                        }
                                      >
                                        {generatingPrepId === interview.id ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating prep suggestions...
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            {interview.prep_notes || interview.questions_to_ask || interview.research_notes
                                              ? "Regenerate Prep Suggestions"
                                              : "Generate AI Prep Suggestions"}
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                    <div className="space-y-5">
                                      {interviewPrepSections.map((section) => {
                                        const fieldKey = prepFieldKey(interview.id, section.field);
                                        const value = interview[section.field];
                                        const formattedValue = value ? formatPrepMarkdown(value) : "";
                                        const isEditing = prepEditing[fieldKey];
                                        const draftValue = prepDrafts[fieldKey] ?? value ?? "";
                                        const isSaving = savingPrepEdits[fieldKey];

                                        return (
                                          <div key={`${interview.id}-${section.field}`} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label className="text-xs font-medium text-slate-600">{section.label}</Label>
                                              {isEditing ? (
                                                <Button
                                                  onClick={() => savePrepEdit(interview.id, section.field)}
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-8 w-8"
                                                  disabled={isSaving}
                                                >
                                                  {isSaving ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                  ) : (
                                                    <Save className="h-4 w-4" />
                                                  )}
                                                </Button>
                                              ) : (
                                                <Button
                                                  onClick={() => startPrepEdit(interview.id, section.field, value)}
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-8 w-8"
                                                >
                                                  <Pencil className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                            {isEditing ? (
                                              <Textarea
                                                value={draftValue}
                                                onChange={(event) =>
                                                  updatePrepDraft(interview.id, section.field, event.target.value)
                                                }
                                                className="min-h-[140px] resize-none font-mono text-sm"
                                              />
                                            ) : value ? (
                                              <div className="p-4 border rounded-lg bg-muted/20">
                                                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                                                  <ReactMarkdown>{formattedValue}</ReactMarkdown>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="text-sm text-muted-foreground bg-muted/10 border border-dashed rounded-lg p-4">
                                                {section.placeholder}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </details>
                              </div>
                              <div>
                                <details
                                  className="group"
                                  open={followUpOpen[interview.id] ?? false}
                                  onToggle={(event) => {
                                    const details = event.currentTarget;
                                    if (!details) return;
                                    setFollowUpOpen((prev) => ({
                                      ...prev,
                                      [interview.id]: details.open,
                                    }));
                                  }}
                                >
                                  <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                                    <MessageSquare className="h-4 w-4 text-blue-500" />
                                    Follow-Up
                                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                                  </summary>
                                  <div className="mt-4 space-y-4">
                                    {hasFollowUpDraft ? (
                                      <div className="p-4 border rounded-lg bg-muted/20">
                                        <div className="flex items-center justify-between mb-2">
                                          <Label className="text-xs font-medium text-slate-600">Draft</Label>
                                          {isEditingFollowUp ? (
                                            <Button
                                              onClick={() => saveFollowUpEdit(interview.id)}
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8"
                                            >
                                              <Save className="h-4 w-4" />
                                            </Button>
                                          ) : (
                                            <div className="flex gap-1">
                                              <Button
                                                onClick={() => startEditingFollowUp(interview.id, followUpDraft ?? "")}
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                onClick={() => acceptFollowUp(interview.id)}
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-emerald-600"
                                                disabled={isSavingFollowUp}
                                              >
                                                {isSavingFollowUp ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Check className="h-4 w-4" />
                                                )}
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                        {isEditingFollowUp ? (
                                          <Textarea
                                            value={followUpEditValue}
                                            onChange={(event) => updateFollowUpDraft(interview.id, event.target.value)}
                                            className="min-h-[160px] resize-none font-mono text-sm"
                                          />
                                        ) : (
                                          <div className="text-sm whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-200">
                                            {followUpDraft ?? ""}
                                          </div>
                                        )}
                                      </div>
                                    ) : followUpSaved ? (
                                      <div className="p-4 border rounded-lg bg-muted/20">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 mb-2">
                                          <CheckCircle2 className="h-4 w-4" />
                                          Accepted
                                        </div>
                                        <div className="text-sm whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-200">
                                          {followUpSaved}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground bg-muted/10 border border-dashed rounded-lg p-4">
                                        Generate a thank-you note to send after this interview.
                                      </div>
                                    )}
                                    {!followUpSaved && (
                                      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                        <div>
                                          <Label
                                            htmlFor={`follow-up-guidance-${interview.id}`}
                                            className="text-sm font-medium"
                                          >
                                            Follow-Up Guidance (optional)
                                          </Label>
                                          <Textarea
                                            id={`follow-up-guidance-${interview.id}`}
                                            placeholder="Mention specific topics, moments, or next steps to include..."
                                            value={followUpGuidance[interview.id] ?? ""}
                                            onChange={(event) =>
                                              setFollowUpGuidance((prev) => ({
                                                ...prev,
                                                [interview.id]: event.target.value,
                                              }))
                                            }
                                            className="mt-1.5 min-h-[80px] text-sm"
                                          />
                                        </div>
                                        <Button
                                          onClick={() => generateFollowUp(interview.id)}
                                          disabled={generatingFollowUpId === interview.id}
                                          className="w-full shadow-sm"
                                        >
                                          {generatingFollowUpId === interview.id ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              Drafting follow-up...
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="mr-2 h-4 w-4" />
                                              Generate Thank You Note
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              </div>
                              <div>
                                <details
                                  className="group"
                                  open={callReviewOpen[interview.id] ?? false}
                                  onToggle={(event) => {
                                    const details = event.currentTarget;
                                    if (!details) return;
                                    setCallReviewOpen((prev) => ({
                                      ...prev,
                                      [interview.id]: details.open,
                                    }));
                                  }}
                                >
                                  <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                                    <FileCheck className="h-4 w-4 text-orange-500" />
                                    Call Review
                                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                                  </summary>
                                  <div className="mt-4 space-y-6">
                                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                      <div className="space-y-2">
                                        <Label className="text-xs font-medium text-slate-600">Actions</Label>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            className="w-full"
                                            onClick={() => analyzeTranscript(interview.id, transcriptValue)}
                                            disabled={!transcriptValue.trim() || isAnalyzing}
                                          >
                                            {isAnalyzing ? (
                                              <>
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Analyzing
                                              </>
                                            ) : (
                                              <>
                                                <Sparkles className="mr-2 h-3 w-3" /> Analyze Transcript
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Paste a transcript below to analyze it.
                                        </p>
                                      </div>

                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-xs font-medium text-slate-600">Transcript</Label>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={() => saveTranscript(interview.id, transcriptValue)}
                                            disabled={isSavingTranscript}
                                          >
                                            {isSavingTranscript ? (
                                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                            ) : (
                                              <Save className="mr-1 h-3 w-3" />
                                            )}
                                            Save
                                          </Button>
                                        </div>
                                        <Textarea
                                          placeholder="Paste transcript to analyze..."
                                          className="min-h-[200px] font-mono text-sm resize-y"
                                          value={transcriptValue}
                                          onChange={(event) =>
                                            setTranscripts((prev) => ({
                                              ...prev,
                                              [interview.id]: event.target.value,
                                            }))
                                          }
                                        />
                                      </div>

                                      {analysisValue && (
                                        <div className="space-y-2 pt-4 border-t">
                                          <div className="flex items-center justify-between">
                                            <Label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                                              <Sparkles className="h-3 w-3 text-primary" /> AI Analysis
                                            </Label>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 text-xs"
                                              onClick={() => analyzeTranscript(interview.id, transcriptValue)}
                                              disabled={isAnalyzing}
                                            >
                                              {isAnalyzing ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <RefreshCw className="h-3 w-3 mr-1" />
                                              )}
                                              Regenerate
                                            </Button>
                                          </div>
                                          <div className="p-3 bg-background rounded border text-sm prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap [&_p]:m-0">
                                            <ReactMarkdown>{analysisValue}</ReactMarkdown>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </details>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            <Card className="border-none shadow-sm ring-1 ring-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                  Application Status
                </CardTitle>
                <CardDescription>Pipeline progression and timeline</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="relative flex justify-between mb-16 mt-10 px-4 md:px-10">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -z-10 -translate-y-1/2 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-primary/30 transition-all duration-1000 ease-out" 
                         style={{ width: `${(currentStageIndex / (pipelineStages.length - 1)) * 100}%` }}
                       />
                    </div>
                    
                    {pipelineStages.map((stage, index) => {
                      const isActive = role.application_status === stage;
                      const isPast = index < currentStageIndex;
                      const isFuture = index > currentStageIndex;
                      
                      return (
                        <div key={stage} className="relative flex flex-col items-center group">
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10",
                            isActive ? "bg-primary border-primary text-primary-foreground shadow-lg scale-110" : 
                            isPast ? "bg-background border-primary text-primary shadow-sm" : 
                            "bg-background border-muted text-muted-foreground/30"
                          )}>
                            {isPast ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-xs font-bold">{index + 1}</span>}
                          </div>
                          <span className={cn(
                            "absolute -bottom-8 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap",
                            isActive ? "text-primary" : 
                            isPast ? "text-foreground/70" : 
                            "text-muted-foreground/40"
                          )}>
                            {stage}
                          </span>
                        </div>
                      );
                    })}
                 </div>

                  <div className="grid gap-6 md:grid-cols-2 mt-8">
                    <div className="p-6 rounded-xl border bg-gradient-to-br from-background to-muted/20 shadow-sm flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                         <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Application Date</span>
                          {role.application_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={openTimestampEditor}
                              className="h-6 px-2 text-xs"
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                        <p className="text-xl font-semibold mt-1">
                          {role.applied_at ? parseUTCDate(role.applied_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Not applied yet'}
                        </p>
                      </div>
                    </div>

                    <div className="p-6 rounded-xl border bg-gradient-to-br from-background to-muted/20 shadow-sm flex items-start gap-4">
                       <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Clock className="h-5 w-5 text-blue-500" />
                       </div>
                       <div>
                         <span className="text-sm font-medium text-muted-foreground">Last Analysis Update</span>
                         <p className="text-xl font-semibold mt-1">
                           {research?.updated_at ? parseUTCDate(research.updated_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Never'}
                         </p>
                       </div>
                   </div>
                  </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>Permanent actions that cannot be undone</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-background">
                  <div>
                    <h4 className="font-semibold text-sm">Delete this role</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Permanently remove this role and all associated data
                    </p>
                  </div>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setShowDeleteConfirm(true)}
                     className="text-destructive hover:bg-destructive hover:text-white border-destructive/20"
                   >
                     <Trash2 className="h-4 w-4 mr-2" />
                     Delete Role
                   </Button>
                 </div>
               </CardContent>
              </Card>
            </TabsContent>
           </Tabs>
        </div>

      <Dialog open={editingTimestamp} onOpenChange={setEditingTimestamp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Application Timestamp</DialogTitle>
            <DialogDescription>
              Update the date and time when you moved this role to its current stage. This helps track accurate metrics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="timestamp">Date & Time</Label>
              <Input
                id="timestamp"
                type="datetime-local"
                value={timestampValue}
                onChange={(e) => setTimestampValue(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Current: {role?.applied_at ? parseUTCDate(role.applied_at).toLocaleString() : 'Not set'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTimestamp(false)} disabled={savingTimestamp}>
              Cancel
            </Button>
            <Button onClick={handleSaveTimestamp} disabled={savingTimestamp || !timestampValue}>
              {savingTimestamp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This will permanently remove all associated applications, interviews, and tasks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteRole}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
