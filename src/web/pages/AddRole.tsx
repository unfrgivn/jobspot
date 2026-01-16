import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Loader2, Link as LinkIcon, FileText, ArrowLeft, Building2, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useToast } from "../components/ui/toast";

export function AddRole() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingRoleId, setExistingRoleId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setExistingRoleId(null);

    try {
      const body =
        mode === "url" ? { url } : { company, title, jd_text: jdText || undefined };

      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json() as { roleId?: string; error?: string; existingRoleId?: string };
      
      if (!response.ok) {
        if (response.status === 409 && data.existingRoleId) {
          setExistingRoleId(data.existingRoleId);
          setError("This role is already in your pipeline.");
        } else {
          setError(data.error ?? "Failed to add role");
        }
        return;
      }

      navigate(`/roles/${data.roleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add New Opportunity</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Track a new role to start organizing your research and prep.
        </p>
      </div>

      <Card className="border shadow-lg">
        <CardHeader className="pb-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "url" | "manual")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="url" className="gap-2">
                <LinkIcon className="h-4 w-4" />
                From URL
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <FileText className="h-4 w-4" />
                Manual Entry
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="url" className="mt-0">
              <CardDescription className="text-center pt-2">
                Paste a LinkedIn, Indeed, or company career page URL. 
                <br />We'll extract the details for you.
              </CardDescription>
            </TabsContent>
            
            <TabsContent value="manual" className="mt-0">
              <CardDescription className="text-center pt-2">
                Enter the role details yourself. 
                <br />You can paste the JD text later.
              </CardDescription>
            </TabsContent>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "url" ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                    placeholder="https://company.com/careers/job-posting"
                    required
                    className="pl-9 h-11"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground ml-1">
                  Supports most major job boards and company sites.
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="company" className="text-sm font-medium">
                      Company
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="company"
                        value={company}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompany(e.target.value)}
                        placeholder="Acme Corp"
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium">
                      Role Title
                    </label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                      placeholder="Senior Engineer"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="jd" className="text-sm font-medium flex justify-between">
                    <span>Job Description</span>
                    <span className="text-xs text-muted-foreground font-normal">Optional but recommended</span>
                  </label>
                  <Textarea
                    id="jd"
                    value={jdText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJdText(e.target.value)}
                    placeholder="Paste the full job description here..."
                    className="min-h-[150px] font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
                {existingRoleId && (
                  <Button variant="link" size="sm" className="self-start h-auto p-0 text-red-700 underline" asChild>
                    <Link to={`/roles/${existingRoleId}`}>
                      Go to existing role &rarr;
                    </Link>
                  </Button>
                )}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 text-base shadow-sm">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "url" ? "Analyzing Job Post..." : "Creating Role..."}
                </>
              ) : (
                mode === "url" ? "Import Role" : "Add Role"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
