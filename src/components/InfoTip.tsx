import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const VIEWPORT_MARGIN = 12;

interface Position {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
  arrowLeft: number;
}

/**
 * ⓘ button revealing a short definition on hover / keyboard focus.
 * The bubble is portaled to <body> with fixed positioning so parents with
 * overflow: hidden (cards, panels, scrolling tables) never clip it, and it
 * flips / shifts to stay inside the viewport.
 */
export function InfoTip({ children, label = '指標說明' }: { children: ReactNode; label?: string }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;

    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fitsBelow = t.bottom + GAP + b.height <= vh - VIEWPORT_MARGIN;
    const fitsAbove = t.top - GAP - b.height >= VIEWPORT_MARGIN;
    const placement = fitsBelow || !fitsAbove ? 'bottom' : 'top';

    const centerX = t.left + t.width / 2;
    const maxLeft = Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - b.width);
    const left = Math.min(Math.max(centerX - b.width / 2, VIEWPORT_MARGIN), maxLeft);
    const top =
      placement === 'bottom'
        ? Math.min(t.bottom + GAP, Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - b.height))
        : t.top - GAP - b.height;

    setPosition({
      top,
      left,
      placement,
      arrowLeft: Math.min(Math.max(centerX - left, 12), b.width - 12),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return (
    <span className="info-tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={triggerRef}
        type="button"
        className="info-tip__trigger"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        onClick={(e) => {
          // Touch devices have no hover: tap toggles. Keep row clicks from firing.
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {open
        ? createPortal(
            <span
              ref={bubbleRef}
              role="tooltip"
              id={id}
              className={`info-tip__bubble info-tip__bubble--${position?.placement ?? 'bottom'}`}
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                // Measure first, then reveal at the computed position (no flash at 0,0).
                visibility: position ? 'visible' : 'hidden',
                ['--arrow-left' as string]: `${position?.arrowLeft ?? 0}px`,
              }}
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
