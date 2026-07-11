import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Route-level code splitting: each page (and whatever it pulls in — e.g. Landing's
// Three.js scene) ships as its own chunk instead of all bundling into main.js.
// Login/Signup stay eager since they're the most common first paint after Landing.
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";

const Landing = lazy(() => import("@/pages/Landing"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Activation = lazy(() => import("@/pages/Activation"));
const Admin = lazy(() => import("@/pages/Admin"));

// Legal.js has named exports, not a default — React.lazy needs a default,
// so map each one. All three still share a single "Legal" chunk.
const Privacy = lazy(() => import("@/pages/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("@/pages/Legal").then((m) => ({ default: m.Terms })));
const Disclaimer = lazy(() => import("@/pages/Legal").then((m) => ({ default: m.Disclaimer })));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-ayana-primary" />
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <LanguageProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/activation" element={<ProtectedRoute><Activation /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </LanguageProvider>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;