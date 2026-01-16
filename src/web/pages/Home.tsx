import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Terminal, ArrowRight, Shield, GitBranch, Cpu } from "lucide-react";

export function Home() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          navigate("/dashboard");
        }
      } catch (error) {
        console.debug("Not authenticated or offline");
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      <nav className="fixed top-0 w-full border-b border-border/40 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-lg font-bold tracking-tighter">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            JobSpot
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/login")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-secondary text-xs font-medium text-secondary-foreground mb-8 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            v1.0 Now Available
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Command your career <br className="hidden md:block" />
            like a <span className="text-primary font-mono">pipeline</span>.
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop juggling spreadsheets and lost PDFs. Treat your job search like a software engineering problem.
            Track, automate, and optimize with AI.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base gap-2" onClick={() => navigate("/login")}>
              Launch Terminal <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={() => window.open('https://github.com/your-username/JobSpot', '_blank')}>
              View on GitHub
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/20 border-y border-border/50">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<GitBranch className="h-6 w-6 text-blue-500" />}
              title="Pipeline Tracking"
              description="Kanban-style management for roles. Move applications from Applied to Offer with drag-and-drop ease."
            />
            <FeatureCard 
              icon={<Cpu className="h-6 w-6 text-purple-500" />}
              title="AI Intelligence"
              description="Generate hyper-tailored cover letters and prep for interviews using Gemini 2.0 analysis."
            />
            <FeatureCard 
              icon={<Shield className="h-6 w-6 text-green-500" />}
              title="Local First"
              description="Your data stays yours. Runs on local Postgres or Supabase with full data sovereignty."
            />
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="relative rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/5">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
              <div className="text-xs text-white/30 font-mono ml-2">jobspot — -zsh — 80x24</div>
            </div>
            <div className="p-6 font-mono text-sm leading-relaxed text-gray-300">
              <div className="flex gap-3">
                <span className="text-green-400">➜</span>
                <span className="text-blue-400">~</span>
                <span>bun run src/index.ts init</span>
              </div>
              <div className="text-gray-500 mt-1 mb-4">Initialized new workspace in /Users/dev/jobspot</div>
              
              <div className="flex gap-3">
                <span className="text-green-400">➜</span>
                <span className="text-blue-400">~</span>
                <span>bun run src/index.ts add --company "Acme Corp" --role "Senior Eng"</span>
              </div>
              <div className="text-gray-500 mt-1 mb-4">
                <span className="text-green-400">✓</span> Added role: Senior Eng @ Acme Corp (ID: 142)
              </div>

              <div className="flex gap-3">
                <span className="text-green-400">➜</span>
                <span className="text-blue-400">~</span>
                <span>bun run src/index.ts apply 142</span>
              </div>
              <div className="mt-1">
                <span className="text-blue-400">ℹ</span> Analyzing job description...<br/>
                <span className="text-blue-400">ℹ</span> Generating cover letter with Gemini 2.0...<br/>
                <span className="text-green-400">✓</span> Application ready: ./output/acme-corp-cover-letter.pdf
              </div>
              
              <div className="flex gap-3 mt-4">
                <span className="text-green-400">➜</span>
                <span className="text-blue-400">~</span>
                <span className="animate-pulse">_</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border/40 text-center text-sm text-muted-foreground">
        <div className="container mx-auto px-6">
          <p>© {new Date().getFullYear()} JobSpot. Open source and built for developers.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div className="mb-4 bg-primary/5 w-12 h-12 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
