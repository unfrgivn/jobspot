import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
