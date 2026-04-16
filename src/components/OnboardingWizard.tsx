import { useState } from 'react';

import { Shield, Sun, Moon, Monitor, Cloud, Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  getSettings, saveSettings, getProfile, saveProfile, generateId,
} from '@/lib/storage';
import { addBodyEntry } from '@/lib/bodyTrackerStorage';
import { getBackupSettings, saveBackupSettings } from '@/lib/autoBackup';
import { toStorageKg } from '@/lib/units';
import { format } from 'date-fns';

const TOTAL_STEPS = 5;

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);

  // Step 1: weight unit (required)
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  // Step 2: theme
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('dark');

  // Step 3: profile
  const [name, setName] = useState('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [profileSkipped, setProfileSkipped] = useState(false);

  // Step 4: auto-backup
  const [autoBackup, setAutoBackup] = useState(false);

  const applyTheme = (t: 'system' | 'light' | 'dark') => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (t === 'dark') root.classList.add('dark');
    else if (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
  };

  const persistStep = (current: number, skipped = false) => {
    const settings = getSettings();
    if (current === 1) {
      saveSettings({ ...settings, weightUnit });
    } else if (current === 2 && !skipped) {
      saveSettings({ ...settings, theme });
      applyTheme(theme);
    } else if (current === 3 && !skipped) {
      const heightNum = parseFloat(heightCm);
      const weightNum = parseFloat(weight);
      const weightKg = !isNaN(weightNum) ? toStorageKg(weightNum, weightUnit) ?? weightNum : NaN;

      const existing = getProfile();
      const now = new Date().toISOString();
      const profile = {
        id: existing?.id ?? generateId(),
        name: name || existing?.name || '',
        heightCm: !isNaN(heightNum) && heightNum > 0 ? heightNum : (existing?.heightCm ?? 175),
        currentWeightKg: !isNaN(weightKg) && weightKg > 0 ? weightKg : (existing?.currentWeightKg ?? 70),
        goalWeightKg: existing?.goalWeightKg ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      saveProfile(profile);

      // Create initial BodyEntry if user provided weight
      if (!isNaN(weightKg) && weightKg > 0) {
        const now = new Date();
        addBodyEntry({
          date: format(now, 'yyyy-MM-dd'),
          time: format(now, 'HH:mm'),
          weightKg,
          bodyFatPercent: null,
          muscleMassPercent: null,
          note: 'Initial entry from onboarding',
        });
      }
      setProfileSkipped(false);
    } else if (current === 3 && skipped) {
      setProfileSkipped(true);
    } else if (current === 4 && !skipped) {
      const bs = getBackupSettings();
      saveBackupSettings({ ...bs, enabled: autoBackup });
    }
  };

  const handleNext = () => {
    persistStep(step, false);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleSkip = () => {
    persistStep(step, true);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleFinish = () => {
    localStorage.setItem('hasCompletedFirstLaunch', 'true');
    window.location.assign('/');
  };

  const canSkip = step === 2 || step === 3 || step === 4;

  return (
    <Dialog open onOpenChange={() => { /* prevent closing */ }}>
      <DialogContent
        className="max-w-md p-0 gap-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress dots */}
        <div className="flex flex-col items-center gap-2 px-6 pt-6">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 === step ? 'w-6 bg-primary' : i + 1 < step ? 'w-1.5 bg-primary/60' : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>

        <div className="px-6 py-5 min-h-[340px]">
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">Welcome to Fit Log X</h2>
                <p className="text-sm text-muted-foreground">Let's set things up your way.</p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
                <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-foreground">
                  <span className="font-semibold">Your data is 100% yours.</span> All data is saved
                  securely and locally on your device. It is never shared or made publicly available.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Preferred weight unit</label>
                <div className="flex gap-2">
                  {(['kg', 'lbs'] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setWeightUnit(u)}
                      className={`flex-1 rounded-lg py-3 text-sm font-semibold uppercase transition-colors ${
                        weightUnit === u
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Required so the app functions properly.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">Pick your look</h2>
                <p className="text-sm text-muted-foreground">Choose the theme you prefer.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'light', icon: Sun, label: 'Light' },
                  { v: 'dark', icon: Moon, label: 'Dark' },
                  { v: 'system', icon: Monitor, label: 'System' },
                ] as const).map(({ v, icon: Icon, label }) => (
                  <button
                    key={v}
                    onClick={() => setTheme(v)}
                    className={`flex flex-col items-center gap-2 rounded-lg py-4 text-xs font-medium transition-colors ${
                      theme === v
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">Tell us about you</h2>
                <p className="text-sm text-muted-foreground">Used for BMI and body tracking.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-secondary border-0" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground">Height (cm)</label>
                    <Input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" className="bg-secondary border-0" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground">Weight ({weightUnit})</label>
                    <Input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={weightUnit === 'kg' ? '70' : '154'} className="bg-secondary border-0" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Entering your weight creates your first body tracking entry.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">Auto-Backup</h2>
                <p className="text-sm text-muted-foreground">Keep your data safe automatically.</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-start gap-3">
                <Cloud className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Enable Auto-Backup</span>
                    <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Automatically saves a backup file to your device when data changes. You can also enable Google Drive backup later from Settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5 flex flex-col items-center justify-center min-h-[280px]">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold">You're all set!</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Time to log your first workout. You can change any of these later in Settings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-2 border-t border-border px-6 py-4">
          {step > 1 && step < TOTAL_STEPS && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {canSkip && (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Skip
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} className="bg-primary text-primary-foreground">
              Next
            </Button>
          ) : (
            <Button onClick={handleFinish} className="bg-primary text-primary-foreground">
              Finish
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
