import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Shield, Sun, Moon, Monitor, Cloud, Check, Languages, AlertTriangle, Candy, Zap, Contrast } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getSettings, saveSettings, getProfile, saveProfile, generateId,
} from '@/lib/storage';
import { addBodyEntry } from '@/lib/bodyTrackerStorage';
import { getBackupSettings, saveBackupSettings } from '@/lib/autoBackup';
import { toStorageKg } from '@/lib/units';
import { format } from 'date-fns';
import { LANGUAGES, type SupportedLang } from '@/i18n/languages';
import { setLanguage } from '@/i18n';
import { applyTheme as applyThemeMode } from '@/lib/applyTheme';
import type { ThemeMode } from '@/lib/storage';

const TOTAL_STEPS = 6;

export default function OnboardingWizard() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);

  const [language, setLanguageState] = useState<SupportedLang>('en');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [name, setName] = useState('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [, setProfileSkipped] = useState(false);
  const [autoBackup, setAutoBackup] = useState(false);

  // Force English as default on wizard mount so step 1 displays in English.
  useEffect(() => {
    setLanguage('en');
  }, []);

  const applyTheme = (t: ThemeMode) => {
    applyThemeMode(t);
  };

  const persistStep = (current: number, skipped = false) => {
    const settings = getSettings();
    if (current === 1) {
      saveSettings({ ...settings, language });
      setLanguage(language);
    } else if (current === 2) {
      saveSettings({ ...settings, weightUnit });
    } else if (current === 3 && !skipped) {
      saveSettings({ ...settings, theme });
      applyTheme(theme);
    } else if (current === 4 && !skipped) {
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
    } else if (current === 4 && skipped) {
      setProfileSkipped(true);
    } else if (current === 5 && !skipped) {
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
    window.dispatchEvent(new Event('fitlog:wizard-complete'));
  };

  const canSkip = step === 3 || step === 4 || step === 5;

  return (
    <Dialog open onOpenChange={() => { /* prevent closing */ }}>
      <DialogContent
        className="max-w-md p-0 gap-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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
            {t('onboarding.stepLabel', { current: step, total: TOTAL_STEPS })}
          </p>
        </div>

        <div className="px-6 py-5 min-h-[340px]">
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">{t('onboarding.s1.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.s1.subtitle')}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-2">
                  <Languages className="h-4 w-4" /> {t('onboarding.s1.language')}
                </label>
                <Select
                  value={language}
                  onValueChange={(v) => {
                    setLanguageState(v as SupportedLang);
                    setLanguage(v as SupportedLang);
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
                <p className="text-[10px] text-muted-foreground">{t('onboarding.s1.recommended')}</p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-foreground">
                  {t('onboarding.s1.betaWarning')}
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">{t('onboarding.s2.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.s2.subtitle')}</p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
                <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-foreground">
                  <span className="font-semibold">{t('onboarding.s2.privacyBold')}</span>{' '}
                  {t('onboarding.s2.privacy')}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">{t('onboarding.s2.weightUnit')}</label>
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
                <p className="text-[10px] text-muted-foreground">{t('onboarding.s2.required')}</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">{t('onboarding.s3.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.s3.subtitle')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                { v: 'light', icon: Sun, labelKey: 'onboarding.s3.light', fallback: 'Light' },
                  { v: 'dark', icon: Moon, labelKey: 'onboarding.s3.dark', fallback: 'Dark' },
                  { v: 'system', icon: Monitor, labelKey: 'onboarding.s3.system', fallback: 'System' },
                  { v: 'cotton-candy', icon: Candy, labelKey: 'onboarding.s3.cottonCandy', fallback: 'Cotton Candy' },
                  { v: 'neo-blue', icon: Zap, labelKey: 'onboarding.s3.neoBlue', fallback: 'Neo Blue' },
                  { v: 'monochrome', icon: Contrast, labelKey: 'onboarding.s3.monochrome', fallback: 'Monochrome' },
                ] as const).map(({ v, icon: Icon, labelKey, fallback }) => (
                  <button
                    key={v}
                    onClick={() => setTheme(v)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg py-3 px-1 text-[11px] font-medium transition-colors ${
                      theme === v
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="leading-tight text-center">{t(labelKey, { defaultValue: fallback })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">{t('onboarding.s4.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.s4.subtitle')}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">{t('onboarding.s4.name')}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('onboarding.s4.namePh')} className="bg-secondary border-0" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground">{t('onboarding.s4.height')}</label>
                    <Input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" className="bg-secondary border-0" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground">{t('onboarding.s4.weight', { unit: weightUnit })}</label>
                    <Input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={weightUnit === 'kg' ? '70' : '154'} className="bg-secondary border-0" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{t('onboarding.s4.hint')}</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h2 className="font-display text-xl font-bold">{t('onboarding.s5.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.s5.subtitle')}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-start gap-3">
                <Cloud className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{t('onboarding.s5.enable')}</span>
                    <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t('onboarding.s5.hint')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5 flex flex-col items-center justify-center min-h-[280px]">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold">{t('onboarding.s6.title')}</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {t('onboarding.s6.subtitle')}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-6 py-4">
          {step > 1 && step < TOTAL_STEPS && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              {t('onboarding.back')}
            </Button>
          )}
          <div className="flex-1" />
          {canSkip && (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              {t('onboarding.skip')}
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} className="bg-primary text-primary-foreground">
              {t('onboarding.next')}
            </Button>
          ) : (
            <Button onClick={handleFinish} className="bg-primary text-primary-foreground">
              {t('onboarding.finish')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
