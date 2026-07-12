import { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Palette, ChevronDown, AlertTriangle, Check, Trash2 } from 'lucide-react';
import {
  BASE_PRESETS,
  getBasePreset,
  type CustomTheme,
  type CustomThemeColors,
  createCustomThemeId,
  saveCustomTheme,
  deleteCustomTheme,
  contrastRatio,
  buildCssVars,
} from '@/lib/customThemes';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after Save & Apply with the saved theme id. */
  onApply: (themeId: string) => void;
  /** If provided, edit this theme instead of creating new. */
  existing?: CustomTheme | null;
  /** Simplified onboarding version hides advanced by default and removes delete. */
  simplified?: boolean;
}

interface FieldSpec {
  key: keyof CustomThemeColors;
  label: string;
  advanced?: boolean;
}

const FIELDS: FieldSpec[] = [
  { key: 'background', label: 'App background' },
  { key: 'card', label: 'Card / surface' },
  { key: 'primary', label: 'Primary accent' },
  { key: 'secondary', label: 'Secondary accent' },
  { key: 'foreground', label: 'Primary text' },
  { key: 'mutedForeground', label: 'Muted text' },
  { key: 'border', label: 'Border', advanced: true },
  { key: 'success', label: 'Success', advanced: true },
  { key: 'warning', label: 'Warning', advanced: true },
  { key: 'destructive', label: 'Error / record', advanced: true },
];

export default function CustomThemeCreator({ open, onClose, onApply, existing, simplified }: Props) {
  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState<string>('dark');
  const [isDark, setIsDark] = useState(true);
  const [colors, setColors] = useState<CustomThemeColors>(BASE_PRESETS[0].colors);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setBaseId(existing.baseThemeId);
      setIsDark(existing.isDark);
      setColors(existing.colors);
    } else {
      const preset = getBasePreset('dark');
      setName('');
      setBaseId(preset.id);
      setIsDark(preset.isDark);
      setColors(preset.colors);
    }
    setAdvancedOpen(false);
  }, [open, existing]);

  const onPickBase = (id: string) => {
    const p = getBasePreset(id);
    setBaseId(p.id);
    setIsDark(p.isDark);
    setColors(p.colors);
  };

  const setColor = (key: keyof CustomThemeColors, v: string) => {
    setColors(c => ({ ...c, [key]: v }));
  };

  // ---- contrast checks ----
  const checks = useMemo(() => {
    const c = colors;
    return [
      { label: 'Text on background', ratio: contrastRatio(c.foreground, c.background) },
      { label: 'Text on card', ratio: contrastRatio(c.foreground, c.card) },
      { label: 'Muted on background', ratio: contrastRatio(c.mutedForeground, c.background) },
    ];
  }, [colors]);

  const minRatio = Math.min(...checks.map(x => x.ratio));
  const critical = minRatio < 2.5; // very unreadable
  const warn = minRatio < 4.5;     // below WCAG AA for normal text

  const canSave = name.trim().length > 0 && !critical;

  // ---- live preview inline styles ----
  const previewStyle = useMemo(() => {
    const vars = buildCssVars({
      id: 'preview', name: 'preview', baseThemeId: baseId, isDark, colors,
      createdAt: '', updatedAt: '',
    });
    // convert CSS var map into a style object
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) s[k] = v;
    return s as React.CSSProperties;
  }, [colors, baseId, isDark]);

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const theme: CustomTheme = existing
      ? { ...existing, name: name.trim(), baseThemeId: baseId, isDark, colors, updatedAt: now }
      : {
          id: createCustomThemeId(),
          name: name.trim(),
          baseThemeId: baseId,
          isDark,
          colors,
          createdAt: now,
          updatedAt: now,
        };
    saveCustomTheme(theme);
    onApply(theme.id);
    onClose();
  };

  const handleDelete = () => {
    if (!existing) return;
    deleteCustomTheme(existing.id);
    onClose();
  };

  const shownFields = FIELDS.filter(f => !f.advanced || advancedOpen);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0">
          <Palette className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold flex-1">
            {existing ? 'Edit Custom Theme' : 'Create Custom Theme'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Theme name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My theme"
              className="bg-secondary border-0 h-9"
              maxLength={30}
            />
          </div>

          {/* Base theme */}
          {!existing && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Start from</label>
              <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
                {BASE_PRESETS.map(p => {
                  const active = baseId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPickBase(p.id)}
                      className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary text-secondary-foreground border-transparent'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-border/50"
                        style={{ background: p.colors.primary }}
                      />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live preview */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Live preview</label>
            <div
              className="rounded-xl p-3 space-y-2.5 border"
              style={{
                ...previewStyle,
                background: `hsl(${previewStyle['--background' as any]})`,
                borderColor: `hsl(${previewStyle['--border' as any]})`,
              }}
            >
              {/* card */}
              <div
                className="rounded-lg p-2.5"
                style={{ background: `hsl(${previewStyle['--card' as any]})`, color: `hsl(${previewStyle['--foreground' as any]})` }}
              >
                <div className="text-[11px] font-semibold">Bench Press</div>
                <div className="text-[10px]" style={{ color: `hsl(${previewStyle['--muted-foreground' as any]})` }}>
                  3 × 8 · 80 kg · Last: 2d
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                    style={{ background: `hsl(${previewStyle['--primary' as any]})`, color: `hsl(${previewStyle['--primary-foreground' as any]})` }}
                  >
                    +5 kg
                  </span>
                  <span
                    className="text-[10px] rounded-full px-2 py-0.5"
                    style={{ background: `hsl(${previewStyle['--secondary' as any]})`, color: `hsl(${previewStyle['--foreground' as any]})` }}
                  >
                    Chest
                  </span>
                </div>
              </div>
              {/* toggle row */}
              <div
                className="flex items-center justify-between rounded-lg px-2.5 py-2"
                style={{ background: `hsl(${previewStyle['--card' as any]})`, color: `hsl(${previewStyle['--foreground' as any]})` }}
              >
                <span className="text-[11px]">Auto rest timer</span>
                <span
                  className="relative inline-block h-4 w-7 rounded-full"
                  style={{ background: `hsl(${previewStyle['--primary' as any]})` }}
                >
                  <span
                    className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full"
                    style={{ background: `hsl(${previewStyle['--primary-foreground' as any]})` }}
                  />
                </span>
              </div>
            </div>
          </div>

          {/* Color fields */}
          <div className="space-y-2">
            {shownFields.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="flex-1 text-xs">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colors[f.key]}
                    onChange={e => setColor(f.key, e.target.value)}
                    className="h-8 w-8 rounded-md border border-border/60 bg-transparent p-0 cursor-pointer"
                    aria-label={f.label}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground w-16 text-right uppercase">
                    {colors[f.key]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Advanced toggle */}
          {!simplified && (
            <button
              type="button"
              onClick={() => setAdvancedOpen(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              {advancedOpen ? 'Hide advanced' : 'More options'}
            </button>
          )}

          {/* Contrast warnings */}
          {(warn || critical) && (
            <div
              className={`rounded-lg border p-2.5 flex gap-2 text-[11px] leading-relaxed ${
                critical
                  ? 'border-destructive/50 bg-destructive/10 text-destructive'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-500'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                {critical
                  ? 'Contrast is critically low. Adjust the text or background before saving.'
                  : 'Contrast is below the recommended level. Text may be hard to read.'}
                <div className="mt-1 space-y-0.5">
                  {checks.map(c => (
                    <div key={c.label} className="flex justify-between gap-2">
                      <span>{c.label}</span>
                      <span className="font-mono">{c.ratio.toFixed(2)}:1</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border/60 shrink-0">
          {existing && !simplified && (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
            className="bg-primary text-primary-foreground gap-1.5"
          >
            <Check className="h-3.5 w-3.5" /> {existing ? 'Save' : 'Save & apply'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
