import React, { useEffect, useRef, useState } from 'react';

/**
 * Primitiva di divulgazione progressiva: contenitore collassabile animato.
 *
 * Animazione basata su TRANSFORM (compositore/GPU), non su `height`: lo spazio
 * viene riservato/rilasciato in un colpo (un solo reflow) e il contenuto scorre
 * dentro/fuori con `translateY`. Cosi' l'animazione non tocca il layout della
 * pagina ad ogni frame -> niente paint ripetuto ne' re-raster dei backdrop-filter
 * (blur navbar), quindi resta fluida anche su questo template pesante.
 * Compromesso: i vicini "saltano" alla posizione finale (i transform non spostano
 * il layout), invece di crescere gradualmente.
 *
 * Da chiuso il contenuto e' reso `inert`.
 *
 * Props: open, id, className, children (invariati).
 */

const INNER_OPEN = { transform: 'translateY(0)' };

const CollapsibleSection = ({ open = false, id, className = '', children }) => {
  const innerRef = useRef(null);
  const rafRef = useRef(0);
  const [height, setHeight] = useState(open ? 'auto' : '0px');
  const [innerStyle, setInnerStyle] = useState(() =>
    open ? INNER_OPEN : { transform: 'translateY(-100%)', transition: 'none' },
  );
  const didMountRef = useRef(false);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return undefined;
    }

    // Al primo mount lo stato iniziale e' gia' corretto: niente animazione.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return undefined;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (open) {
      // Riserva lo spazio (un reflow) e mette il contenuto sopra.
      setHeight(`${inner.scrollHeight}px`);
      if (prefersReducedMotion) {
        setInnerStyle(INNER_OPEN);
        setHeight('auto');
        return undefined;
      }
      setInnerStyle({ transform: 'translateY(-100%)', transition: 'none' });
      // Al frame dopo: fa scorrere il contenuto in posizione (transizione dal CSS).
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = window.requestAnimationFrame(() => setInnerStyle(INNER_OPEN));
      });
    } else {
      // Chiusura: fissa l'altezza e fa scorrere il contenuto fuori (verso l'alto).
      setHeight(`${inner.scrollHeight}px`);
      if (prefersReducedMotion) {
        setInnerStyle({ transform: 'translateY(-100%)', transition: 'none' });
        setHeight('0px');
        return undefined;
      }
      setInnerStyle({ transform: 'translateY(-100%)' });
    }

    // Rete di sicurezza: se `transitionend` non scatta (tab in background, ecc.)
    // fissa comunque lo stato finale dell'altezza.
    const safetyTimer = window.setTimeout(() => setHeight(open ? 'auto' : '0px'), 360);
    return () => {
      window.cancelAnimationFrame(rafRef.current);
      window.clearTimeout(safetyTimer);
    };
  }, [open]);

  const handleTransitionEnd = (event) => {
    if (event.target !== innerRef.current || event.propertyName !== 'transform') {
      return;
    }
    // Aperto: altezza 'auto' (si adatta al contenuto). Chiuso: 0 (rilascia lo spazio).
    setHeight(open ? 'auto' : '0px');
  };

  return (
    <div id={id} className="ui-collapsible" style={{ height }} inert={open ? undefined : true}>
      <div
        ref={innerRef}
        className={`ui-collapsible__inner ${className}`.trim()}
        style={innerStyle}
        onTransitionEnd={handleTransitionEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default CollapsibleSection;
