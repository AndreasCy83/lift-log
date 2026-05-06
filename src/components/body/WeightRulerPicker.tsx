import { useState, useRef, useEffect, useCallback } from 'react';

interface WeightRulerPickerProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  color?: string;
}

const TICK_WIDTH = 12;
const MAJOR_EVERY = 10; // every 10 minor ticks = 1 kg

export default function WeightRulerPicker({
  value,
  onChange,
  min = 30,
  max = 200,
  step = 0.1,
  unit = 'kg',
  label,
  color = 'hsl(var(--primary))',
}: WeightRulerPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const [displayValue, setDisplayValue] = useState(value);
  const [containerWidth, setContainerWidth] = useState(0);
  const totalTicks = Math.round((max - min) / step);

  const valueToScroll = useCallback((v: number) => {
    return ((v - min) / step) * TICK_WIDTH;
  }, [min, step]);

  const scrollToValue = useCallback((scrollLeft: number) => {
    const tickIndex = Math.round(scrollLeft / TICK_WIDTH);
    const clamped = Math.max(0, Math.min(totalTicks, tickIndex));
    return Math.round((min + clamped * step) * 10) / 10;
  }, [min, step, totalTicks]);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // initial scroll once we know container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el || containerWidth === 0) return;
    el.scrollLeft = valueToScroll(value);
  }, [containerWidth]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const v = scrollToValue(el.scrollLeft);
    setDisplayValue(v);
  }, [scrollToValue]);

  const commitValue = useCallback(() => {
    onChange(displayValue);
  }, [displayValue, onChange]);

  // Mouse / touch handlers for momentum-like dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startScroll.current = containerRef.current?.scrollLeft ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const dx = startX.current - e.clientX;
    containerRef.current.scrollLeft = startScroll.current + dx;
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    const el = containerRef.current;
    if (!el) return;
    const v = scrollToValue(el.scrollLeft);
    setDisplayValue(v);
    onChange(v);
    el.scrollLeft = valueToScroll(v);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>}
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-4xl font-bold font-display" style={{ color }}>{displayValue.toFixed(1)}</span>
        <span className="text-lg text-muted-foreground">{unit}</span>
      </div>
      <div className="relative w-full max-w-[320px]">
        {/* center indicator */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-full z-10 pointer-events-none" style={{ backgroundColor: color }} />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 z-10 pointer-events-none" style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${color}` }} />

        <div
          ref={containerRef}
          className="overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'pan-x' }}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="flex items-end pt-3"
            style={{ width: totalTicks * TICK_WIDTH + (containerRef.current?.clientWidth ?? 300), paddingLeft: '50%', paddingRight: '50%' }}
          >
            {Array.from({ length: totalTicks + 1 }, (_, i) => {
              const isMajor = i % MAJOR_EVERY === 0;
              const isMid = i % 5 === 0 && !isMajor;
              const tickValue = Math.round((min + i * step) * 10) / 10;
              return (
                <div key={i} className="flex flex-col items-center flex-shrink-0" style={{ width: TICK_WIDTH }}>
                  <div
                    className="rounded-full"
                    style={{
                      width: isMajor ? 2 : 1,
                      height: isMajor ? 32 : isMid ? 22 : 14,
                      backgroundColor: isMajor ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.4)',
                    }}
                  />
                  {isMajor && (
                    <span className="text-[10px] text-muted-foreground mt-1 select-none">{tickValue}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
