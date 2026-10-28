//echd-frontend/src/components/ui/auto-fit.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Affiche un montant sur UNE seule ligne, toujours : la taille de police est réduite pas à pas
 * jusqu'à ce que le texte tienne dans son conteneur (plancher de lisibilité `minSize`).
 * Se réajuste tout seul si la largeur du conteneur change (rotation, barre latérale, langue).
 */
export function AutoFit({
  children,
  maxSize,
  minSize = 14,
  className,
}: {
  children: React.ReactNode;
  /** Taille idéale en px quand le texte tient sans réduction */
  maxSize: number;
  /** Taille minimale en px : jamais en dessous */
  minSize?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(maxSize);

  useIsoLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      const width = box.clientWidth;
      if (width === 0) return;
      let s = maxSize;
      text.style.fontSize = `${s}px`;
      while (text.scrollWidth > width && s > minSize) {
        s -= 1;
        text.style.fontSize = `${s}px`;
      }
      setSize(s);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [children, maxSize, minSize]);

  return (
    <div ref={boxRef} className="min-w-0 max-w-full overflow-hidden">
      <span ref={textRef} style={{ fontSize: size }} className={cn('inline-block whitespace-nowrap leading-tight', className)}>
        {children}
      </span>
    </div>
  );
}
