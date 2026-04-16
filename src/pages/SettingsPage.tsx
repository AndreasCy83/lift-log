import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Monitor, Dumbbell, FileUp, ChevronRight, Weight, MessageSquare } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { getSettings, saveSettings, getProfile, saveProfile, generateId, resetExerciseDefaults, type AppSettings } from '@/lib/storage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import ExerciseLibrary from '@/components/ExerciseLibrary';
import CsvExportButtons from '@/components/CsvExportButtons';
import AutoBackupSection from '@/components/AutoBackupSection';
import PrivacyPolicyModal from '@/components/PrivacyPolicyModal';
import { importCsvData } from '@/lib/csvImport';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types/fitness';
import type { WeightUnitSetting } from '@/lib/units';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'reset' | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [profile, setProfile] = useState<UserProfile>(() =>
    getProfile() ?? {
      id: generateId(), name: '', heightCm: 175, currentWeightKg: 70,
      goalWeightKg: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }
  );

  useEffect(() => {
    // Apply theme
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (settings.theme === 'dark') root.classList.add('dark');
    else if (settings.theme === 'light') root.classList.remove('dark');
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
    }
    saveSettings(settings);
  }, [settings]);

  const handleSaveProfile = () => {
    const updated = { ...profile, updatedAt: new Date().toISOString() };
    saveProfile(updated);
    setProfile(updated);
  };

  const handleExport = () => {
    const data = {
      weightStorageUnit: 'kg',
      profile, settings,
      workouts: JSON.parse(localStorage.getItem('gym-workouts') ?? '[]'),
      workoutExercises: JSON.parse(localStorage.getItem('gym-workout-exercises') ?? '[]'),
      workoutSets: JSON.parse(localStorage.getItem('gym-workout-sets') ?? '[]'),
      routines: JSON.parse(localStorage.getItem('gym-routines') ?? '[]'),
      routineExercises: JSON.parse(localStorage.getItem('gym-routine-exercises') ?? '[]'),
      exercises: JSON.parse(localStorage.getItem('gym-exercises') ?? '[]'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitlog-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          // Handle unit conversion if backup was stored in lbs
          if (data.weightStorageUnit === 'lbs' && data.workoutSets) {
            const LBS_TO_KG = 1 / 2.20462;
            data.workoutSets = data.workoutSets.map((s: any) => ({
              ...s,
              weightKg: s.weightKg != null ? Math.round(s.weightKg * LBS_TO_KG * 100) / 100 : s.weightKg,
            }));
          }
          if (data.workouts) localStorage.setItem('gym-workouts', JSON.stringify(data.workouts));
          if (data.workoutExercises) localStorage.setItem('gym-workout-exercises', JSON.stringify(data.workoutExercises));
          if (data.workoutSets) localStorage.setItem('gym-workout-sets', JSON.stringify(data.workoutSets));
          if (data.routines) localStorage.setItem('gym-routines', JSON.stringify(data.routines));
          if (data.routineExercises) localStorage.setItem('gym-routine-exercises', JSON.stringify(data.routineExercises));
          if (data.exercises) localStorage.setItem('gym-exercises', JSON.stringify(data.exercises));
          // Body tracker data
          const bodyEntries = data.bodyEntries ?? data.bodyMeasurements ?? [];
          if (bodyEntries.length > 0) localStorage.setItem('body-tracker-entries', JSON.stringify(bodyEntries));
          if (data.bodyGoals) localStorage.setItem('body-tracker-goals', JSON.stringify(data.bodyGoals));
          if (data.profile) saveProfile(data.profile);
          if (data.settings) saveSettings(data.settings);
          window.location.reload();
        } catch { alert('Invalid backup file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const themeIcons = { system: Monitor, light: Sun, dark: Moon };

  if (showExerciseLibrary) {
    return <ExerciseLibrary onClose={() => setShowExerciseLibrary(false)} />;
  }

  if (showPrivacyPolicy) {
    return <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />;
  }

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold">Settings</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-4">
        {/* Profile */}
        <div className="gym-card space-y-3">
          <h3 className="font-display text-sm font-semibold">Profile</h3>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Name</label>
            <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="bg-secondary border-0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Height (cm)</label>
              <Input type="number" value={profile.heightCm} onChange={e => setProfile({ ...profile, heightCm: parseInt(e.target.value) || 0 })} className="bg-secondary border-0" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Weight (kg)</label>
              <Input type="number" value={profile.currentWeightKg} onChange={e => setProfile({ ...profile, currentWeightKg: parseFloat(e.target.value) || 0 })} className="bg-secondary border-0" />
            </div>
          </div>
          <Button onClick={handleSaveProfile} size="sm" className="bg-primary text-primary-foreground">Save Profile</Button>
        </div>

        {/* Weight Unit */}
        <div className="gym-card">
          <h3 className="font-display text-sm font-semibold mb-3">Weight Unit</h3>
          <div className="flex gap-2">
            {(['kg', 'lbs'] as const).map(u => (
              <button
                key={u}
                onClick={() => setSettings({ ...settings, weightUnit: u })}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-colors uppercase
                  ${settings.weightUnit === u ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">All data is stored internally in kg. This setting only affects display and input.</p>
        </div>

        {/* Theme */}
        <div className="gym-card">
          <h3 className="font-display text-sm font-semibold mb-3">Theme</h3>
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as const).map(t => {
              const Icon = themeIcons[t];
              return (
                <button
                  key={t}
                  onClick={() => setSettings({ ...settings, theme: t })}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-colors capitalize
                    ${settings.theme === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                >
                  <Icon className="h-4 w-4" /> {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Keep screen on */}
        <div className="gym-card flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Keep Screen On</h3>
            <p className="text-xs text-muted-foreground">During workouts</p>
          </div>
          <Switch checked={settings.keepScreenOn} onCheckedChange={v => setSettings({ ...settings, keepScreenOn: v })} />
        </div>

        {/* Rest timer default */}
        <div className="gym-card">
          <h3 className="text-sm font-medium mb-2">Default Rest (seconds)</h3>
          <Input type="number" value={settings.defaultRestSeconds} onChange={e => setSettings({ ...settings, defaultRestSeconds: parseInt(e.target.value) || 60 })} className="bg-secondary border-0 w-24" />
        </div>

        {/* Exercise Library */}
        <div className="gym-card">
          <Button onClick={() => setShowExerciseLibrary(true)} variant="outline" size="sm" className="w-full gap-2">
            <Dumbbell className="h-4 w-4" /> View Exercises
          </Button>
        </div>

        {/* CSV Export */}
        <div className="gym-card">
          <CsvExportButtons />
        </div>

        {/* Auto Backup */}
        <AutoBackupSection />

        {/* Data */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">Data</h3>
          <Button onClick={handleImport} variant="outline" size="sm" className="w-full">Import Backup</Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const result = importCsvData(reader.result as string);
                    toast({ title: `✅ Imported ${result.workoutCount} workouts and ${result.setCount} sets` });
                  } catch {
                    toast({ title: 'Import failed — invalid CSV file', variant: 'destructive' });
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
          >
            <FileUp className="h-4 w-4" />
            Import CSV
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">Supports FitNotes and other CSV formats</p>
        </div>

        {/* Danger Zone */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold text-destructive">Danger Zone</h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setConfirmAction('reset')}
          >
            Reset Exercises to Defaults
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => { setDeleteConfirmText(''); setConfirmAction('delete'); }}
          >
            Delete All Data
          </Button>
        </div>

        {/* Legal */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">Legal</h3>
          <button
            onClick={() => setShowPrivacyPolicy(true)}
            className="flex w-full items-center justify-between rounded-lg py-2 text-sm text-foreground hover:bg-secondary px-1 transition-colors"
          >
            <span>Privacy Policy</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Feedback */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">Feedback</h3>
          <button
            onClick={() => {
              const mailto = 'mailto:fitlogx@gmail.com?subject=Fit%20Log%20X%20-%20Feedback';
              if (Capacitor.isNativePlatform()) {
                window.open(mailto, '_system');
              } else {
                window.location.href = mailto;
              }
            }}
            className="flex w-full items-center justify-between rounded-lg py-2 text-sm text-foreground hover:bg-secondary px-1 transition-colors"
          >
            <span>Send Feedback</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <p className="text-[10px] text-muted-foreground text-center">Share your thoughts, comments and suggestions.</p>
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={(o) => { if (!o) { setConfirmAction(null); setDeleteConfirmText(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === 'delete' ? 'Delete All Data?' : 'Reset Exercises to Defaults?'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {confirmAction === 'delete' ? (
                    <>
                      <p>This will permanently delete all your workouts, routines, body measurements, goals, profile data, and personal settings from this device. This action cannot be undone.</p>
                      <div>
                        <p className="mb-1.5 font-medium text-foreground">Type <span className="font-mono text-destructive">DELETE</span> to confirm:</p>
                        <Input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="DELETE"
                          className="font-mono"
                          autoComplete="off"
                        />
                      </div>
                    </>
                  ) : (
                    <p>This will replace your exercise library with the default exercises. Custom exercises will be removed. This action cannot be undone.</p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={confirmAction === 'delete' && deleteConfirmText !== 'DELETE'}
                onClick={() => {
                  if (confirmAction === 'delete') {
                    // Workouts
                    localStorage.removeItem('gym-workouts');
                    localStorage.removeItem('gym-workout-exercises');
                    localStorage.removeItem('gym-workout-sets');
                    // Routines
                    localStorage.removeItem('gym-routines');
                    localStorage.removeItem('gym-routine-exercises');
                    // Body tracker
                    localStorage.removeItem('body-tracker-entries');
                    localStorage.removeItem('body-tracker-goals');
                    // Legacy body data
                    localStorage.removeItem('gym-bmi-history');
                    localStorage.removeItem('gym-weight-history');
                    // Profile
                    localStorage.removeItem('gym-profile');
                    // Settings
                    localStorage.removeItem('gym-settings');
                    // Exercise goals
                    localStorage.removeItem('gym-exercise-goals');
                    // Backup metadata
                    localStorage.removeItem('fitlog-last-backup');
                    localStorage.removeItem('fitlog-auto-backup');
                    toast({ title: 'All user data deleted', description: 'The app has been reset to a clean state.' });
                  } else {
                    resetExerciseDefaults();
                    toast({ title: 'Exercises reset', description: 'Exercise library restored to defaults.' });
                  }
                  setConfirmAction(null);
                  setDeleteConfirmText('');
                  window.location.reload();
                }}
              >
                {confirmAction === 'delete' ? 'Delete All Data' : 'Yes, Reset'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
