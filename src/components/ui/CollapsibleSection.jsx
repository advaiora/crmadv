import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Primitiva di divulgazione progressiva: contenitore collassabile animato.
 *
 * Anima l'altezza tra valori in pixel misurati sul contenuto reale, con una
 * transizione CSS su `height`. Robusta e fluida in qualunque contesto (celle di
 * tabella, griglie a div). A fine apertura l'altezza torna a `auto` cosi' il
 * pannello si adatta se il contenuto cambia.
 *
 * Da chiuso il contenuto e' reso `inert` (niente elementi interattivi focusabili
 * sotto un pannello a altezza zero).
 *
 * Ottimizzazione prestazioni: mentre una qualsiasi sezione anima, si aggiunge la
 * classe `ui-collapse-animating` su <html>. L'app-shell la usa (in globals.css)
 * per sospendere temporaneamente i costosi `backdrop-filter` (blur della navbar),
 * che altrimenti verrebbero ri-rasterizzati ad ogni frame durante il cambio di
 * layout, rendendo l'animazione scattosa. Un contatore condiviso gestisce piu'
 * sezioni animate insieme; un timeout di sicurezza garantisce il ripristino.
 */

const ROOT_ANIMATING_CLASS = 'ui-collapse-animating';
let activeAnimationCount = 0;

const markAnimatingStart = () => {
  activeAnimationCount += 1;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add(ROOT_ANIMATING_CLASS);
  }
};

const markAnimatingEnd = () => {
  activeAnimationCount = Math.max(0, activeAnimationCount - 1);
  if (activeAnimationCount === 0 && typeof document !== 'undefined') {
    document.documentElement.classList.remove(ROOT_ANIMATING_CLASS);
  }
};

const CollapsibleSection = ({ open = false, id, className = '', children }) => {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(open ? 'auto' : '0px');
  const didMountRef = useRef(false);
  const isAnimatingRef = useRef(false);

  // Segnala inizio/fine animazione al contatore condiviso (idempotente per istanza).
  const startAnimating = useCallback(() => {
    if (!isAnimatingRef.current) {
      isAnimatingRef.current = true;
      markAnimatingStart();
    }
  }, []);

  const stopAnimating = useCallback(() => {
    if (isAnimatingRef.current) {
      isAnimatingRef.current = false;
      markAnimatingEnd();
    }
  }, []);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return undefined;
    }

    // Al primo mount lo stato iniziale ('auto' o '0px') e' gia' corretto:
    // niente animazione (eviterebbe un flash dei pannelli chiusi all'avvio).
    if (!didMountRef.current) {
      didMountRef.current = true;
      return undefined;
    }

    startAnimating();
    // Rete di sicurezza: se `transitionend` non scatta (altezza invariata,
    // motion ridotto, ecc.) ripristiniamo comunque lo stato animante.
    const safetyTimer = window.setTimeout(stopAnimating, 420);

    if (open) {
      // Da 0px (o auto) all'altezza del contenuto: anima l'apertura; a fine
      // transizione si passa ad 'auto' (vedi handleTransitionEnd).
      setHeight(`${inner.offsetHeight}px`);
      return () => window.clearTimeout(safetyTimer);
    }

    // Chiusura: da 'auto' si fissa l'altezza attuale, poi 0px poco dopo (un breve
    // setTimeout resta affidabile anche con la tab in background).
    setHeight(`${inner.offsetHeight}px`);
    const collapseTimer = window.setTimeout(() => setHeight('0px'), 20);
    return () => {
      window.clearTimeout(collapseTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [open, startAnimating, stopAnimating]);

  // Se il componente si smonta durante un'animazione, non lasciare il contatore
  // (e quindi la classe) appeso.
  useEffect(() => stopAnimating, [stopAnimating]);

  const handleTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'height') {
      return;
    }
    if (open) {
      setHeight('auto');
    }
    stopAnimating();
  };

  return (
    <div
      id={id}
      className="ui-collapsible"
      style={{ height }}
      inert={open ? undefined : true}
      onTransitionEnd={handleTransitionEnd}
    >
      <div ref={innerRef} className={`ui-collapsible__inner ${className}`.trim()}>
        {children}
      </div>
    </div>
  );
};

export default CollapsibleSection;
