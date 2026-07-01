import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { CURRENT_HOME_TUTORIAL_VERSION, INSTALL_ID_KEY, computeStage } from './App';

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
    exitApp: vi.fn(),
  },
}));

vi.mock('@/lib/storage', () => ({
  getSettings: vi.fn(() => ({ theme: 'dark', weightUnit: 'kg' })),
  cleanupUuidCategories: vi.fn(),
  migrateCategoryIds: vi.fn(),
  reseedMissingExercises: vi.fn(),
  seedBuiltInPrograms: vi.fn(),
}));

vi.mock('@/lib/applyTheme', () => ({ applyTheme: vi.fn() }));
vi.mock('@/lib/autoBackup', () => ({ checkPendingBackup: vi.fn() }));
vi.mock('@/lib/billing', () => ({ initBilling: vi.fn() }));
vi.mock('@/lib/ttsVoice', () => ({ preloadAudioCues: vi.fn() }));
vi.mock('@/lib/workoutSession', () => ({ expireIfStale: vi.fn() }));

vi.mock('@/components/SplashScreen', () => ({
  default: ({ onFinish }: { onFinish: () => void }) => (
    <button type="button" onClick={onFinish}>Finish splash</button>
  ),
}));

vi.mock('@/components/OnboardingWizard', () => ({
  default: ({ onFinish }: { onFinish: () => void }) => (
    <section aria-label="welcome wizard">
      <button type="button" onClick={onFinish}>Finish welcome</button>
    </section>
  ),
}));

vi.mock('./pages/HomePage', () => ({
  default: ({ allowHomeTutorial, onHomeTutorialFinish }: { allowHomeTutorial?: boolean; onHomeTutorialFinish?: () => void }) => (
    <main>
      <h1>Home page</h1>
      {allowHomeTutorial && (
        <section aria-label="home tutorial">
          <button type="button" onClick={onHomeTutorialFinish}>Finish home tutorial</button>
        </section>
      )}
    </main>
  ),
}));

vi.mock('./pages/SettingsPage', () => ({
  default: ({ onResetTutorials }: { onResetTutorials?: () => void }) => (
    <main>
      <h1>Settings page</h1>
      <button type="button" onClick={onResetTutorials}>Reset tutorials</button>
    </main>
  ),
}));

vi.mock('@/components/BottomNav', () => ({ default: () => <nav>Bottom nav</nav> }));
vi.mock('@/components/RateAppDialog', () => ({ default: () => <div data-testid="rate-dialog" /> }));
vi.mock('@/components/GlobalRestTimer', () => ({ default: () => <div data-testid="rest-timer" /> }));
vi.mock('./pages/RoutinesPage', () => ({ default: () => <div>Routines</div> }));
vi.mock('./pages/RoutineDetailPage', () => ({ default: () => <div>Routine detail</div> }));
vi.mock('./pages/ProgramDetailPage', () => ({ default: () => <div>Program detail</div> }));
vi.mock('./pages/WorkoutLogPage', () => ({ default: () => <div>Workout log</div> }));
vi.mock('./pages/StatsPage', () => ({ default: () => <div>Stats</div> }));
vi.mock('./pages/BodyTrackerPage', () => ({ default: () => <div>Body</div> }));
vi.mock('./pages/NotFound', () => ({ default: () => <div>Not found</div> }));

function skipSplashWindow() {
  localStorage.setItem('splashLastShown', Date.now().toString());
}

describe('app onboarding sequencing', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '#/';
  });

  it('fresh install runs splash, welcome wizard, home tutorial, then normal app', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Finish splash' }));

    expect(await screen.findByLabelText('welcome wizard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish welcome' }));

    expect(localStorage.getItem('hasCompletedFirstLaunch')).toBe('true');
    expect(await screen.findByLabelText('home tutorial')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish home tutorial' }));

    await waitFor(() => expect(screen.queryByLabelText('home tutorial')).not.toBeInTheDocument());
    expect(localStorage.getItem('homeTutorialVersionSeen')).toBe(String(CURRENT_HOME_TUTORIAL_VERSION));
    expect(localStorage.getItem('hasSeenHomeTutorial')).toBe('true');
  });

  it('app-data-cleared first run shows the welcome wizard after the splash', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Finish splash' }));

    expect(await screen.findByLabelText('welcome wizard')).toBeInTheDocument();
    expect(computeStage()).toBe('welcome');
  });

  it('existing users skip welcome and see the new Home tutorial once', async () => {
    skipSplashWindow();
    localStorage.setItem('hasCompletedFirstLaunch', 'true');
    localStorage.setItem(INSTALL_ID_KEY, '1');

    render(<App />);

    expect(screen.queryByLabelText('welcome wizard')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('home tutorial')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish home tutorial' }));

    await waitFor(() => expect(screen.queryByLabelText('home tutorial')).not.toBeInTheDocument());
    expect(computeStage()).toBe('done');
  });

  it('reset tutorials from Settings routes back through welcome wizard then Home tutorial without splash', async () => {
    skipSplashWindow();
    localStorage.setItem('hasCompletedFirstLaunch', 'true');
    localStorage.setItem('homeTutorialVersionSeen', String(CURRENT_HOME_TUTORIAL_VERSION));
    localStorage.setItem(INSTALL_ID_KEY, '1');
    window.location.hash = '#/settings';

    render(<App />);

    expect(await screen.findByText('Settings page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset tutorials' }));

    expect(await screen.findByLabelText('welcome wizard')).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish welcome' }));

    expect(await screen.findByLabelText('home tutorial')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish home tutorial' }));

    await waitFor(() => expect(screen.queryByLabelText('home tutorial')).not.toBeInTheDocument());
    expect(computeStage()).toBe('done');
  });
});