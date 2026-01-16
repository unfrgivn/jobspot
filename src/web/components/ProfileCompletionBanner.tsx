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
          fetch("/api/profile"),
          fetch("/api/candidate-context")
        ]);

        let profileIncomplete = false;
        let contextIncomplete = false;

        if (profileRes.ok) {
          const profile = await profileRes.json() as UserProfile;
          if (!profile || !profile.resume_text || profile.resume_text.trim() === "") {
            profileIncomplete = true;
          }
        } else {
          profileIncomplete = true;
        }

        if (contextRes.ok) {
          const context = await contextRes.json() as CandidateContext;
          if (!context || !context.full_context || context.full_context.trim() === "") {
            contextIncomplete = true;
          }
        } else {
          contextIncomplete = true;
        }

        if (profileIncomplete || contextIncomplete) {
          setVisible(true);
        }
      } catch (error) {
        console.error("Failed to check profile completion", error);
      } finally {
        setLoading(false);
      }
    };

    checkCompletion();
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
                Complete your profile and candidate context to get the best AI results.
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
