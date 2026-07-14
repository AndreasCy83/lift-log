import { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Palette,
  ChevronDown,
  Check,
  Trash2,
  Sparkles,
  Info,
} from 'lucide-react';
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
  setAccent,
  CURATED_ACCENTS,
} from '@/lib/customThemes';

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (themeId: string) => void;
  existing?: CustomTheme | null;
  /** Onboarding version: fully hides advanced editing. */
  simplified?: boolean;
}

interface AdvancedField {
  key: keyof CustomThemeColors;
  label: string;
}

const BASIC_FIELDS: AdvancedField[] = [
  { key: 'background', label: 'App background' },
  { key: 'card', label: 'Card surface' },
  { key: 'foreground', label: 'Primary text' },
  { key: 'mutedForeground', label: 'Muted text' },
  { key: 'secondary', label: 'Secondary accent' },
];

const MORE_FIELDS: AdvancedField[] = [
  { key: 'border', label: 'Border' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'destructive', label: 'Error / record' },
];

export default function CustomThemeCreator({ open, onClose, onApply, existing, simplified }: Props) {
  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState<string>('dark');
  const [isDark, setIsDark] = useState(true);
  const [colors, setColors] = useState<CustomThemeColors>(BASE_PRESETS[0].colors);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setBaseId(existing.baseThemeId);
      setIsDark(existing.isDark);
      setColors(existing.colors);
    } else {
      const p = getBasePreset('dark');
      setName('');
      setBaseId(p.id);
      setIsDark(p.isDark);
      setColors(p.colors);
    }
    setAdvancedOpen(false);
    setMoreOpen(false);
    setCustomPickerOpen(false);
  }, [open, existing]);

  const onPickBase = (id: string) => {
    const p = getBasePreset(id);
    setBaseId(p.id);
    setIsDark(p.isDark);
    setColors(p.colors);
  };

  const onAccent = (hex: string) =>
    setColors(c => setAccent(c, hex, isDark));

  const setColor = (key: keyof CustomThemeColors, v: string) =>
    setColors(c => ({ ...c, [key]: v }));

  // Advisory-only: never blocks saving. The preview is the source of truth.
  const textOnBg = useMemo(() => contrastRatio(colors.foreground, colors.background), [colors]);
  const textOnCard = useMemo(() => contrastRatio(colors.foreground, colors.card), [colors]);
  const minText = Math.min(textOnBg, textOnCard);

  // Soft hint only — purely informational, does not affect save.
  const mildNote = minText < 2.2;

  const canSave = name.trim().length > 0;

  const previewStyle = useMemo(() => {
    const vars = buildCssVars({
      id: 'preview', name: 'preview', baseThemeId: baseId, isDark, colors,
      createdAt: '', updatedAt: '',
    });
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) s[k] = v;
    return s as React.CSSProperties;
  }, [colors, baseId, isDark]);

  const cssv = (k: string) => `hsl(${(previewStyle as any)[k]})`;

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

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0">
          <Palette className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold flex-1">
            {existing ? 'Edit Custom Theme' : 'Create Custom Theme'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
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

          {/* Base style */}
          {!existing && (
            <section className="space-y-2">
              <SectionTitle step="1" title="Choose your base style" />
              <div className="grid grid-cols-2 gap-1.5">
                {BASE_PRESETS.map(p => {
                  const active = baseId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPickBase(p.id)}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium border transition-colors text-left ${
                        active
                          ? 'bg-primary/15 text-foreground border-primary/60'
                          : 'bg-secondary text-secondary-foreground border-transparent'
                      }`}
                    >
                      <span className="flex -space-x-1">
                        <span className="h-3.5 w-3.5 rounded-full border border-border/50" style={{ background: p.colors.background }} />
                        <span className="h-3.5 w-3.5 rounded-full border border-border/50" style={{ background: p.colors.primary }} />
                      </span>
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Accent */}
          <section className="space-y-2">
            <SectionTitle step={existing ? '1' : '2'} title="Pick your accent" />
            <div className="grid grid-cols-6 gap-2">
              {CURATED_ACCENTS.map(a => {
                const active = colors.primary.toLowerCase() === a.hex.toLowerCase();
                return (
                  <button
                    key={a.hex}
                    onClick={() => onAccent(a.hex)}
                    title={a.label}
                    className={`aspect-square rounded-full border-2 transition-transform ${
                      active ? 'border-foreground scale-110' : 'border-border/40'
                    }`}
                    style={{ background: a.hex }}
                    aria-label={a.label}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCustomPickerOpen(v => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              {customPickerOpen ? 'Hide custom color' : 'Or choose a custom color'}
            </button>
            {customPickerOpen && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={colors.primary}
                  onChange={e => onAccent(e.target.value)}
                  className="h-9 w-12 rounded-md border border-border/60 bg-transparent p-0 cursor-pointer"
                  aria-label="Custom accent"
                />
                <span className="text-[11px] font-mono text-muted-foreground uppercase">
                  {colors.primary}
                </span>
              </div>
            )}
          </section>

          {/* Preview */}
          <section className="space-y-2">
            <SectionTitle step={existing ? '2' : '3'} title="Preview your theme" />
            <div
              className="rounded-xl p-3 border"
              style={{
                ...previewStyle,
                background: cssv('--background'),
                borderColor: cssv('--border'),
              }}
            >
              <div className="rounded-lg p-3" style={{ background: cssv('--card'), color: cssv('--foreground') }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">Bench Press</div>
                    <div className="text-[10px]" style={{ color: cssv('--muted-foreground') }}>
                      3 × 8 · 80 kg · Last: 2d
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-semibold rounded-full px-2 py-1"
                    style={{ background: cssv('--primary'), color: cssv('--primary-foreground') }}
                  >
                    +5 kg
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className="text-[10px] rounded-full px-2 py-0.5"
                    style={{ background: cssv('--secondary'), color: cssv('--foreground') }}
                  >
                    Chest
                  </span>
                  <span
                    className="relative inline-block h-4 w-7 rounded-full"
                    style={{ background: cssv('--primary') }}
                  >
                    <span
                      className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full"
                      style={{ background: cssv('--primary-foreground') }}
                    />
                  </span>
                </div>
              </div>
            </div>

            {mildNote && (
              <p className="text-[10.5px] text-muted-foreground pl-0.5">
                This theme is bold and may reduce readability in some places. Preview carefully before applying.
              </p>
            )}
          </section>

          {/* Fine-tune (advanced) */}
          {!simplified && (
            <section className="space-y-2 pt-1 border-t border-border/40">
              <button
                type="button"
                onClick={() => setAdvancedOpen(v => !v)}
                className="w-full flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground py-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">Fine-tune colors (optional)</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>

              {advancedOpen && (
                <div className="space-y-2 pt-1">
                  {BASIC_FIELDS.map(f => (
                    <ColorRow
                      key={f.key}
                      label={f.label}
                      value={colors[f.key]}
                      onChange={v => setColor(f.key, v)}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => setMoreOpen(v => !v)}
                    className="w-full flex items-center gap-2 text-[10.5px] text-muted-foreground hover:text-foreground pt-1"
                  >
                    <span className="flex-1 text-left">More options</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {moreOpen && (
                    <div className="space-y-2">
                      {MORE_FIELDS.map(f => (
                        <ColorRow
                          key={f.key}
                          label={f.label}
                          value={colors[f.key]}
                          onChange={v => setColor(f.key, v)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
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

function SectionTitle({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center">
        {step}
      </span>
      <span className="text-[11px] font-semibold text-foreground">{title}</span>
      {hint && <span className="text-[10px] text-muted-foreground">· {hint}</span>}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex-1 text-xs">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-8 w-8 rounded-md border border-border/60 bg-transparent p-0 cursor-pointer"
          aria-label={label}
        />
        <span className="text-[10px] font-mono text-muted-foreground w-16 text-right uppercase">
          {value}
        </span>
      </div>
    </div>
  );
}
