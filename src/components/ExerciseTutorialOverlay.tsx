import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface TutorialStep {
  selector: string;
  title: string;
  text: string;
}

interface Props {
  steps: TutorialStep[];
  onFinish: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

export default function ExerciseTutorialOverlay({ steps, onFinish }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  const step = steps[stepIdx];

  // Locate target element & compute rect; retry briefly if not yet mounted
  useLayoutEffect(() => {
    if (!step) return;
    let attempts = 0;
    let raf = 0;

    const measure = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // wait a tick for scroll
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect({
            top: r.top - PADDING,
            left: r.left - PADDING,
            width: r.width + PADDING * 2,
            height: r.height + PADDING * 2,
          });
          setMissing(false);
        }, 250);
      } else if (attempts < 20) {
        attempts++;
        raf = window.setTimeout(measure, 100);
      } else {
        setMissing(true);
      }
    };
    measure();
    return () => window.clearTimeout(raf);
  }, [step, stepIdx]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!step) return;
    const update = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step]);

  if (!step) return null;

  const handleNext = () => {
    if (stepIdx >= steps.length - 1) onFinish();
    else setStepIdx(stepIdx + 1);
  };

  const handleBack = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  };

  // Tooltip placement: prefer below the highlight; fall back to above if too low.
  const vh = window.innerHeight;
  const TOOLTIP_H = 180;
  const placeBelow = !rect || rect.top + rect.height + TOOLTIP_H + 16 < vh;
  const tooltipStyle: React.CSSProperties = rect
    ? placeBelow
      ? { top: rect.top + rect.height + 12, left: 16, right: 16 }
      : { top: Math.max(16, rect.top - TOOLTIP_H - 12), left: 16, right: 16 }
    : { top: '50%', left: 16, right: 16, transform: 'translateY(-50%)' };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dim backdrop with cutout */}
      {rect && !missing ? (
        <svg className="absolute inset-0 h-full w-full pointer-events-auto">
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="8"
                ry="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="hsl(var(--background))"
            opacity="0.78"
            mask="url(#tutorial-mask)"
          />
          {/* Highlight border */}
          <rect
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx="8"
            ry="8"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            className="animate-pulse"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-background/80" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-4"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Step {stepIdx + 1} of {steps.length}
          </div>
          <button
            onClick={onFinish}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Skip tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="font-display text-base font-semibold mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-3">{step.text}</p>
        {missing && (
          <p className="text-xs text-destructive mb-2">
            Couldn't locate this element — tap Next to continue.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onFinish}>
            Skip Tutorial
          </Button>
          <div className="flex gap-2">
            {stepIdx > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {stepIdx >= steps.length - 1 ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
