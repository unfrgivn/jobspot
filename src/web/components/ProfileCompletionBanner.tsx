import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

interface UserProfile {
  id: string;
  resume_text: string | null;
}

interface CandidateContext {
  full_context?: string | null;
}

export function ProfileCompletionBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCompletion = async () => {
      try {
        const [profileRes, contextRes] = await Promise.all([
          fetch("/api/profile", {
            credentials: "include",
            headers: { Accept: "application/json" },
          }),
          fetch("/api/candidate-context", {
            credentials: "include",
            headers: { Accept: "application/json" },
          }),
        ]);

        const safeJson = async <T,>(response: Response): Promise<T | null> => {
          const contentType = response.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            return null;
          }

          try {
            return (await response.json()) as T;
          } catch {
            return null;
          }
        };

        let profileIncomplete = true;
        let contextIncomplete = true;

        if (profileRes.ok) {
          const profile = await safeJson<UserProfile>(profileRes);
          if (profile?.resume_text?.trim()) {
            profileIncomplete = false;
          }
        }

        if (contextRes.ok) {
          const context = await safeJson<CandidateContext>(contextRes);
          if (context?.full_context?.trim()) {
            contextIncomplete = false;
          }
        }

        setVisible(profileIncomplete || contextIncomplete);
      } catch (error) {
        console.error("Failed to check profile completion", error);
      } finally {
        setLoading(false);
      }
    };

    checkCompletion();

    const handleUpdate = () => checkCompletion();
    window.addEventListener("candidate-context-updated", handleUpdate);
    
    return () => {
      window.removeEventListener("candidate-context-updated", handleUpdate);
    };
  }, []);

  if (loading || !visible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="container mx-auto" style={{ maxWidth: "1600px" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900">
                Your profile is incomplete
              </p>
              <p className="text-xs text-amber-700 hidden sm:block">
                Complete your profile and update user context to get the best AI results.
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="group flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900 transition-colors whitespace-nowrap"
          >
            Go to Settings
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
