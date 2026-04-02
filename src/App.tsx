import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import HomePage from "./pages/HomePage";
import RoutinesPage from "./pages/RoutinesPage";
import RoutineDetailPage from "./pages/RoutineDetailPage";
import WorkoutLogPage from "./pages/WorkoutLogPage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { getSettings, migrateCategoryIds } from "@/lib/storage";
import { checkPendingBackup } from "@/lib/autoBackup";
import { App as CapApp } from '@capacitor/app';
import SplashScreen from "@/components/SplashScreen";

const queryClient = new QueryClient();

function ThemeInit() {
  useEffect(() => {
    const settings = getSettings();
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (settings.theme === 'dark') root.classList.add('dark');
    else if (settings.theme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
    }
    checkPendingBackup();

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkPendingBackup();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);
  return null;
}

function AndroidBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBackButton = CapApp.addListener('backButton', () => {
      const isHome = location.pathname === '/' || location.pathname === '/home';
      if (isHome) {
        CapApp.exitApp();
      } else {
        navigate('/');
      }
    });

    return () => {
      handleBackButton.then(listener => listener.remove());
    };
  }, [location.pathname, navigate]);

  return null;
}

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    const lastShown = localStorage.getItem('splashLastShown');
    const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
    return !lastShown || (Date.now() - parseInt(lastShown)) > FORTY_FIVE_MINUTES;
  });

  const handleFinish = () => {
    localStorage.setItem('splashLastShown', Date.now().toString());
    setShowSplash(false);
  };

  if (showSplash) return <SplashScreen onFinish={handleFinish} />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeInit />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AndroidBackHandler />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/routines" element={<RoutinesPage />} />
            <Route path="/routine/:id" element={<RoutineDetailPage />} />
            <Route path="/workout/:date" element={<WorkoutLogPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
