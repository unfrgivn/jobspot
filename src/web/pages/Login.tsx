import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Briefcase } from "lucide-react";

export function Login() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/auth/google/authorize?redirect=${encodeURIComponent(window.location.origin)}`);
      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        console.error("Failed to get auth URL");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error initiating login:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background -z-10" />
      
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-xl w-fit mb-2">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your JobSpot command center
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full relative" 
            size="lg" 
            variant="outline" 
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span>Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </div>
            )}
          </Button>
          
          <div className="text-center text-xs text-muted-foreground mt-4">
            By signing in, you agree to access your personal job search data.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
