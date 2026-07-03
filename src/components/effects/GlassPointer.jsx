import { useEffect } from 'react';

/**
 * GlassPointer — riflesso "vetro" che segue il cursore.
 *
 * Traccia il puntatore e imposta su OGNI superficie vetro le variabili CSS
 * lette dai gradienti:
 *   --gx / --gy      posizione del cursore relativa all'elemento (in %,
 *                    anche fuori dal range 0–100 quando il mouse è altrove)
 *   --glass-glow     intensità del riflesso (1 = cursore dentro l'elemento,
 *                    poi sfuma con la distanza fino a 0 oltre GLOW_RADIUS)
 *
 * A differenza della prima versione (accendeva solo l'elemento sotto al
 * mouse, con passaggio netto tra un blocco e l'altro), qui l'effetto è un
 * CAMPO DI LUCE continuo su tutta la pagina: ogni blocco/separatore riceve
 * un'intensità proporzionale alla vicinanza del cursore, quindi più blocchi
 * possono brillare insieme, in modo graduale e fluido.
 *
 * Superfici trattate (stesso materiale, definito in globals.css /
 * apple-foundation.css — qui c'è solo il "dove" e il "quanto"):
 *   .glass-edge  → le "scatole" delle primitive React (card/KPI/pannelli)
 *   .card        → le scatole legacy Bootstrap/Jampack (il loro anello vetro
 *                  di default sta in apple-foundation.css e legge le stesse
 *                  variabili: senza questo aggancio non si accenderebbe mai)
 *   .glass-sep   → i separatori sottili
 *
 * Note: un solo listener delegato su document, con throttle a un frame
 * (requestAnimationFrame). Le letture sono solo getBoundingClientRect
 * (nessuna scrittura di layout: le variabili toccano solo la pittura dei
 * pseudo-elementi). Rispetta prefers-reduced-motion: se l'utente riduce le
 * animazioni, non insegue nulla.
 */

/* Raggio d'azione del riflesso OLTRE il bordo del blocco (px): entro questa
   distanza il blocco brilla in proporzione alla vicinanza, oltre è spento.
   È la "manopola" della fluidità tra blocchi: più alto = alone più esteso. */
const GLOW_RADIUS = 240;

/* Ogni quanto (ms) ricostruire la lista delle superfici vetro, per cogliere
   blocchi montati/smontati durante la navigazione senza query a ogni frame. */
const REFRESH_MS = 500;

export default function GlassPointer() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    if (prefersReducedMotion) {
      return undefined;
    }

    let frame = 0;
    let surfaces = [];
    let surfacesTime = -Infinity;
    let pointerX = null;
    let pointerY = null;
    /* Ultimo glow scritto per elemento: evita di riscrivere lo stile dei
       blocchi che restano spenti (la stragrande maggioranza, a ogni frame). */
    const written = new WeakMap();

    const refreshSurfaces = () => {
      const now = performance.now();
      if (now - surfacesTime < REFRESH_MS) {
        return;
      }
      surfacesTime = now;
      surfaces = Array.from(document.querySelectorAll('.glass-edge, .glass-sep, .card'));
    };

    const paint = () => {
      frame = 0;
      if (pointerX === null) {
        return;
      }
      refreshSurfaces();
      for (const element of surfaces) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          continue;
        }
        /* Distanza del cursore dal punto più vicino del rettangolo
           (0 quando il cursore è dentro). */
        const dx = Math.max(rect.left - pointerX, 0, pointerX - rect.right);
        const dy = Math.max(rect.top - pointerY, 0, pointerY - rect.bottom);
        const distance = Math.hypot(dx, dy);
        let glow = 1 - distance / GLOW_RADIUS;

        if (glow <= 0) {
          if (written.get(element)) {
            element.style.setProperty('--glass-glow', '0');
            written.set(element, 0);
          }
          continue;
        }

        /* Smoothstep: addolcisce l'attacco e lo spegnimento del riflesso. */
        glow = glow * glow * (3 - 2 * glow);

        element.style.setProperty('--gx', `${((pointerX - rect.left) / rect.width) * 100}%`);
        element.style.setProperty('--gy', `${((pointerY - rect.top) / rect.height) * 100}%`);
        element.style.setProperty('--glass-glow', glow.toFixed(3));
        written.set(element, glow);
      }
    };

    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    const handleMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      schedule();
    };

    /* Allo scroll i blocchi si muovono sotto il cursore fermo: si ridipinge
       con l'ultima posizione nota. */
    const handleScroll = () => {
      if (pointerX !== null) {
        schedule();
      }
    };

    const handleLeave = () => {
      pointerX = null;
      pointerY = null;
      for (const element of surfaces) {
        if (written.get(element)) {
          element.style.setProperty('--glass-glow', '0');
          written.set(element, 0);
        }
      }
    };

    document.addEventListener('pointermove', handleMove, { passive: true });
    document.addEventListener('pointerleave', handleLeave, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('blur', handleLeave);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerleave', handleLeave);
      document.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('blur', handleLeave);
    };
  }, []);

  return null;
}
