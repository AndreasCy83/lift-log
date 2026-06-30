import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import HomePage from "./pages/HomePage";
import RoutinesPage from "./pages/RoutinesPage";
import RoutineDetailPage from "./pages/RoutineDetailPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import WorkoutLogPage from "./pages/WorkoutLogPage";
import StatsPage from "./pages/StatsPage";
import BodyTrackerPage from "./pages/BodyTrackerPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { useCallback, useEffect, useState } from "react";
import { getSettings, migrateCategoryIds, cleanupUuidCategories, reseedMissingExercises, seedBuiltInPrograms } from "@/lib/storage";
import { applyTheme } from "@/lib/applyTheme";
import { checkPendingBackup } from "@/lib/autoBackup";
import { initBilling } from "@/lib/billing";
import { preloadAudioCues } from "@/lib/ttsVoice";
import { expireIfStale } from "@/lib/workoutSession";
import { App as CapApp } from '@capacitor/app';
import SplashScreen from "@/components/SplashScreen";
import OnboardingWizard from "@/components/OnboardingWizard";
import RateAppDialog from "@/components/RateAppDialog";
import GlobalRestTimer from "@/components/GlobalRestTimer";

const queryClient = new QueryClient();

// Bump to replay the Home tutorial once for all users after a meaningful Home update.
export const CURRENT_HOME_TUTORIAL_VERSION = 2;

export type OnboardingStage = 'welcome' | 'homeTutorial' | 'done';

export function computeStage(): OnboardingStage {
  if (localStorage.getItem('hasCompletedFirstLaunch') !== 'true') {
    return 'welcome';
  }
  const legacy = localStorage.getItem('hasSeenHomeTutorial') === 'true';
  const rawSeen = localStorage.getItem('homeTutorialVersionSeen');
  const seen = rawSeen != null ? parseInt(rawSeen, 10) : (legacy ? 1 : 0);
  if (!Number.isFinite(seen) || seen < CURRENT_HOME_TUTORIAL_VERSION) {
    return 'homeTutorial';
  }
  return 'done';
}

function resetTutorialStorage() {
  localStorage.removeItem('hasSeenExerciseTutorial');
  localStorage.removeItem('hasSeenBodyTutorial');
  localStorage.removeItem('hasSeenHomeTutorial');
  localStorage.removeItem('homeTutorialVersionSeen');
  localStorage.removeItem('hasCompletedFirstLaunch');
}

function ThemeInit() {
  useEffect(() => {
    cleanupUuidCategories();
    migrateCategoryIds();
    reseedMissingExercises();
    seedBuiltInPrograms();

    const settings = getSettings();
    applyTheme(settings.theme);
    checkPendingBackup();
    preloadAudioCues();
    initBilling();
    expireIfStale();

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkPendingBackup();
        expireIfStale();
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

interface AppRoutesProps {
  stage: OnboardingStage;
  showSplash: boolean;
  allowHomeTutorial: boolean;
  onWizardFinish: () => void;
  onHomeTutorialFinish: () => void;
  onResetTutorials: () => void;
}

function AppRoutes({ stage, showSplash, allowHomeTutorial, onWizardFinish, onHomeTutorialFinish, onResetTutorials }: AppRoutesProps) {
  const onboardingActive = stage === 'welcome' || stage === 'homeTutorial';

  return (
    <>
      <AndroidBackHandler />
      {stage === 'done' && <RateAppDialog />}
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              allowHomeTutorial={allowHomeTutorial}
              onHomeTutorialFinish={onHomeTutorialFinish}
            />
          }
        />
        {onboardingActive ? (
          <Route path="*" element={<Navigate to="/" replace />} />
        ) : (
          <>
            <Route path="/routines" element={<RoutinesPage />} />
            <Route path="/routine/:id" element={<RoutineDetailPage />} />
            <Route path="/program/:id" element={<ProgramDetailPage />} />
            <Route path="/workout/:date" element={<WorkoutLogPage />} />
            <Route path="/body" element={<BodyTrackerPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage onResetTutorials={onResetTutorials} />} />
            <Route path="*" element={<NotFound />} />
          </>
        )}
      </Routes>
      {stage === 'welcome' && <OnboardingWizard onFinish={onWizardFinish} />}
      <GlobalRestTimer />
      <BottomNav />
    </>
  );
}

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    const lastShown = localStorage.getItem('splashLastShown');
    const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
    return !lastShown || (Date.now() - parseInt(lastShown)) > FORTY_FIVE_MINUTES;
  });

  // Single source of truth for the onboarding flow. HomePage no longer
  // decides this from storage/timers/DOM; it only reacts to the prop below.
  const [stage, setStage] = useState<OnboardingStage>(() => computeStage());

  const handleSplashFinish = useCallback(() => {
    localStorage.setItem('splashLastShown', Date.now().toString());
    // Re-evaluate after startup migrations had a chance to run during splash.
    const recomputed = computeStage();
    setStage(recomputed);
    setShowSplash(false);
  }, []);

  const handleWizardFinish = useCallback(() => {
    localStorage.setItem('hasCompletedFirstLaunch', 'true');
    const recomputed = computeStage();
    setStage(recomputed);
  }, []);

  const handleHomeTutorialFinish = useCallback(() => {
    localStorage.setItem('homeTutorialVersionSeen', String(CURRENT_HOME_TUTORIAL_VERSION));
    localStorage.setItem('hasSeenHomeTutorial', 'true');
    setStage('done');
  }, []);

  const handleResetTutorials = useCallback(() => {
    resetTutorialStorage();
    setShowSplash(false);
    setStage('welcome');
  }, []);

  const allowHomeTutorial = stage === 'homeTutorial';

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeInit />
        <Toaster />
        <Sonner />
        <HashRouter>
          <AppRoutes
            stage={stage}
            allowHomeTutorial={allowHomeTutorial}
            onWizardFinish={handleWizardFinish}
            onHomeTutorialFinish={handleHomeTutorialFinish}
            onResetTutorials={handleResetTutorials}
          />
        </HashRouter>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
