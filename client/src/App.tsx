import React from "react";
// Global error boundary için ek
// Basit hata yakalama için try/catch ve fallback UI
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = React.useState<Error | null>(null);
  if (error) {
    return (
      <div style={{ color: 'red', padding: 16 }}>
        <h2>Bir hata oluştu:</h2>
        <pre>{error.message}</pre>
      </div>
    );
  }
  return (
    <React.Fragment>
      {React.Children.map(children, (child) => {
        try {
          return child;
        } catch (err: any) {
          setError(err);
          return null;
        }
      })}
    </React.Fragment>
  );
}
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./hooks/use-auth";
import SplashScreen from "./components/SplashScreen";

// Pages
import NotFound from "@/pages/not-found";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import PendingApproval from "./pages/auth/PendingApproval";
import CompleteProfile from "./pages/auth/CompleteProfile";
import Statuses from "./pages/Statuses";
import Adverts from "./pages/Adverts";
import Announcements from "./pages/Announcements";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Approvals from "./pages/admin/Approvals";
import NotificationSettings from "./pages/settings/NotificationSettings";
import { NotificationWatcher } from "./components/NotificationWatcher";
import Home from "./pages/Home";

// Auth Guard Component
function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!user.isApproved) {
    return <Redirect to="/pending-approval" />;
  }

  if (adminOnly && !user.isAdmin) {
    return <Redirect to="/" />;
  }

  return <Component />;
}


function Router() {
  const { user, isLoading } = useAuth();

  return (
    <Switch>
      {/* Login ve Register dışındaki tüm rotalar korumalı */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Ana Rota: Yükleniyorsa splash, giriş yapılmışsa Durumlar, yapılmamışsa Landing (Home) */}
      <Route path="/">
        {isLoading ? <SplashScreen /> : user ? <ProtectedRoute component={Statuses} /> : <Home />}
      </Route>

      {/* Pending Route */}
      <Route path="/pending-approval">
        {user ? <PendingApproval /> : <Redirect to="/login" />}
      </Route>

      {/* Complete Profile Route */}
      <Route path="/complete-profile">
        {user ? <CompleteProfile /> : <Redirect to="/login" />}
      </Route>

      {/* App Routes */}
      <Route path="/statuses" component={() => <Redirect to="/" />} />
      <Route path="/adverts" component={() => <ProtectedRoute component={Adverts} />} />
      <Route path="/announcements" component={() => <ProtectedRoute component={Announcements} />} />
      <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/settings/notifications" component={() => <ProtectedRoute component={NotificationSettings} />} />

      {/* Admin Route */}
      <Route path="/admin/approvals" component={() => <ProtectedRoute component={Approvals} adminOnly={true} />} />

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log("App render başladı");

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <NotificationWatcher />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
