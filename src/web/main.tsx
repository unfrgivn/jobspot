import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ui/toast";
import { AuthGuard } from "./components/AuthGuard";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import "./index.css";

const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Pipeline = lazy(() => import("./pages/Pipeline").then(m => ({ default: m.Pipeline })));
const RoleDetail = lazy(() => import("./pages/RoleDetail").then(m => ({ default: m.RoleDetail })));
const AddRole = lazy(() => import("./pages/AddRole").then(m => ({ default: m.AddRole })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const Tasks = lazy(() => import("./pages/Tasks").then(m => ({ default: m.Tasks })));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12 h-screen">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading application...</p>
      </div>
    </div>
  );
}

import { AuthProvider } from "./lib/auth-context";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route element={
                  <AuthGuard>
                    <Layout />
                  </AuthGuard>
                }>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/pipeline" element={<Pipeline />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/roles/new" element={<AddRole />} />
                  <Route path="/roles/:id" element={<RoleDetail />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
