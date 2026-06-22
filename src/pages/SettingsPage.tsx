import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sun, Moon, Monitor, Dumbbell, FileUp, ChevronRight, Weight, MessageSquare, Sparkles, Languages, Candy, Zap, Contrast } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { getSettings, saveSettings, getProfile, saveProfile, generateId, resetExerciseDefaults, type AppSettings } from '@/lib/storage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExerciseLibrary from '@/components/ExerciseLibrary';
import CsvExportButtons from '@/components/CsvExportButtons';
import AutoBackupSection from '@/components/AutoBackupSection';
import PrivacyPolicyModal from '@/components/PrivacyPolicyModal';
import ChangelogDialog from '@/components/ChangelogDialog';
import { handlePurchase } from '@/lib/billing';
import { importCsvData } from '@/lib/csvImport';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types/fitness';
import { type WeightUnitSetting, toDisplayWeight, toStorageKg, weightUnitLabel } from '@/lib/units';
import { LANGUAGES, type SupportedLang } from '@/i18n/languages';
import { setLanguage } from '@/i18n';
import { applyTheme } from '@/lib/applyTheme';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
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
    applyTheme(settings.theme);
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

  const themeIcons = { system: Monitor, light: Sun, dark: Moon, 'cotton-candy': Candy, 'neo-blue': Zap, monochrome: Contrast } as const;
  const themeLabels: Record<keyof typeof themeIcons, string> = {
    system: 'settings.themeSystem',
    light: 'settings.themeLight',
    dark: 'settings.themeDark',
    'cotton-candy': 'settings.themeCottonCandy',
    'neo-blue': 'settings.themeNeoBlue',
    monochrome: 'settings.themeMonochrome',
  };
  const themeFallback: Record<keyof typeof themeIcons, string> = {
    system: 'System', light: 'Light', dark: 'Dark', 'cotton-candy': 'Cotton Candy', 'neo-blue': 'Neo Blue', monochrome: 'Monochrome',
  };

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
          <h1 className="font-display text-lg font-bold">{t('settings.title')}</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-4">
        {/* Profile */}
        <div className="gym-card space-y-3">
          <h3 className="font-display text-sm font-semibold">{t('settings.profile')}</h3>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">{t('settings.name')}</label>
            <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="bg-secondary border-0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">{t('settings.height')}</label>
              <Input type="number" value={profile.heightCm} onChange={e => setProfile({ ...profile, heightCm: parseInt(e.target.value) || 0 })} className="bg-secondary border-0" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">{t('settings.weight')} ({weightUnitLabel(settings.weightUnit)})</label>
              <Input
                type="number"
                value={toDisplayWeight(profile.currentWeightKg, settings.weightUnit) ?? ''}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setProfile({ ...profile, currentWeightKg: toStorageKg(isNaN(v) ? 0 : v, settings.weightUnit) ?? 0 });
                }}
                className="bg-secondary border-0"
              />
            </div>
          </div>
          <Button onClick={handleSaveProfile} size="sm" className="bg-primary text-primary-foreground">{t('settings.saveProfile')}</Button>
        </div>

        {/* Support the Creator (compact) */}
        <div className="gym-card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">{t('settings.supportCreator')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePurchase('espresso_tip')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-1.5 hover:bg-secondary/80 transition-colors"
            >
              <span className="text-base leading-none">☕</span>
              <span className="text-[11px] font-medium">Espresso</span>
              <span className="text-[11px] font-bold text-primary">from €2.99</span>
            </button>
            <button
              onClick={() => handlePurchase('protein_shake_tip')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-1.5 hover:bg-secondary/80 transition-colors"
            >
              <span className="text-base leading-none">🥤</span>
              <span className="text-[11px] font-medium">Shake</span>
              <span className="text-[11px] font-bold text-primary">from €5.99</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Final local price is shown by Google Play at checkout and may include VAT/taxes depending on your country.
          </p>
        </div>

        {/* Rate the App */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">{t('settings.rateApp')}</h3>
          <button
            onClick={() => window.open('https://play.google.com/store/apps/details?id=com.andreascy83.liftlog', '_blank')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-1.5 hover:bg-secondary/80 transition-colors"
          >
            <span className="text-base leading-none">⭐</span>
            <span className="text-[11px] font-medium">{t('settings.rateOnPlay')}</span>
          </button>
        </div>

        {/* Language */}
        <div className="gym-card">
          <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
            <Languages className="h-4 w-4" /> {t('settings.language')}
          </h3>
          <Select
            value={i18n.language}
            onValueChange={(v) => {
              setLanguage(v as SupportedLang);
              setSettings({ ...settings, language: v as SupportedLang });
            }}
          >
            <SelectTrigger className="bg-secondary border-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="font-medium">{l.nativeName}</span>
                  <span className="text-muted-foreground text-xs ml-2">({l.englishName})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-2">{t('settings.languageHint')}</p>
          <p className="text-[10px] text-amber-500 mt-1">⚠ {t('settings.languageBeta')}</p>
        </div>

        {/* Weight Unit */}
        <div className="gym-card">
          <h3 className="font-display text-sm font-semibold mb-3">{t('settings.weightUnit')}</h3>
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
          <p className="text-[10px] text-muted-foreground mt-2">{t('settings.weightUnitHint')}</p>
        </div>

        {/* Theme */}
        <div className="gym-card">
          <h3 className="font-display text-sm font-semibold mb-3">{t('settings.theme')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['system', 'light', 'dark', 'cotton-candy', 'neo-blue', 'monochrome'] as const).map(th => {
              const Icon = themeIcons[th];
              const label = t(themeLabels[th], { defaultValue: themeFallback[th] });
              return (
                <button
                  key={th}
                  onClick={() => setSettings({ ...settings, theme: th })}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 text-[11px] font-medium transition-colors
                    ${settings.theme === th ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="leading-tight text-center">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Keep screen on */}
        <div className="gym-card flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">{t('settings.keepScreenOn')}</h3>
            <p className="text-xs text-muted-foreground">{t('settings.keepScreenOnHint')}</p>
          </div>
          <Switch checked={settings.keepScreenOn} onCheckedChange={v => setSettings({ ...settings, keepScreenOn: v })} />
        </div>

        {/* Auto-start rest timer */}
        <div className="gym-card flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">{t('settings.autoRest')}</h3>
            <p className="text-xs text-muted-foreground">{t('settings.autoRestHint')}</p>
          </div>
          <Switch checked={settings.autoStartRestTimer} onCheckedChange={v => setSettings({ ...settings, autoStartRestTimer: v })} />
        </div>

        {/* Exercise Library */}
        <div className="gym-card">
          <Button onClick={() => setShowExerciseLibrary(true)} variant="outline" size="sm" className="w-full gap-2">
            <Dumbbell className="h-4 w-4" /> {t('settings.viewExercises')}
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
          <h3 className="font-display text-sm font-semibold">{t('settings.data')}</h3>
          <Button onClick={handleImport} variant="outline" size="sm" className="w-full">{t('settings.importBackup')}</Button>
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
            {t('settings.importCsv')}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">{t('settings.importCsvHint')}</p>
        </div>

        {/* Tutorial */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">{t('settings.tutorial')}</h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              localStorage.removeItem('hasSeenExerciseTutorial');
              localStorage.removeItem('hasSeenBodyTutorial');
              toast({ title: 'Tutorials reset', description: 'Open an exercise or the Body tab to replay the tutorials.' });
            }}
          >
            {t('settings.resetTutorials')}
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold text-destructive">{t('settings.dangerZone')}</h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setConfirmAction('reset')}
          >
            {t('settings.resetExercises')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => { setDeleteConfirmText(''); setConfirmAction('delete'); }}
          >
            {t('settings.deleteAllData')}
          </Button>
        </div>

        {/* About */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">{t('settings.about')}</h3>
          <button
            onClick={() => setShowChangelog(true)}
            className="flex w-full items-center justify-between rounded-lg py-2 text-sm text-foreground hover:bg-secondary px-1 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('settings.whatsNew')}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Legal */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">{t('settings.legal')}</h3>
          <button
            onClick={() => setShowPrivacyPolicy(true)}
            className="flex w-full items-center justify-between rounded-lg py-2 text-sm text-foreground hover:bg-secondary px-1 transition-colors"
          >
            <span>{t('settings.privacyPolicy')}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <ChangelogDialog open={showChangelog} onOpenChange={setShowChangelog} />


        {/* Feedback */}
        <div className="gym-card space-y-2">
          <h3 className="font-display text-sm font-semibold">{t('settings.feedback')}</h3>
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
            <span>{t('settings.sendFeedback')}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <p className="text-[10px] text-muted-foreground text-center">{t('settings.feedbackHint')}</p>
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={(o) => { if (!o) { setConfirmAction(null); setDeleteConfirmText(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === 'delete' ? t('settings.deleteAllTitle') : t('settings.resetExercisesTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {confirmAction === 'delete' ? (
                    <>
                      <p>{t('settings.deleteAllDescription')}</p>
                      <div>
                        <p className="mb-1.5 font-medium text-foreground">{t('settings.typeDeleteToConfirm', { word: 'DELETE' })}</p>
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
                    <p>{t('settings.resetExercisesDescription')}</p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
                {confirmAction === 'delete' ? t('settings.deleteAllData') : t('common.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}
