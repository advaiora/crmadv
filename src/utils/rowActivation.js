// Helper per rendere un'intera riga/card/box cliccabile verso la sua pagina di
// dettaglio, senza interferire con gli elementi interattivi interni (pulsanti,
// link, menu, input, ecc.). Usato in tutto il CRM per uniformare il pattern
// "clic sulla riga = apri il dettaglio".
//
// Uso tipico su un elemento contenitore:
//   <div {...rowActivationProps(() => history.push(`/apps/clients/${id}`))}>
//
// Per escludere esplicitamente un sotto-elemento dalla navigazione (oltre a
// quelli interattivi già riconosciuti), aggiungere l'attributo
// `data-row-nav-ignore` su di esso.

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[data-row-nav-ignore]',
].join(',');

// True se il clic proviene da (o dentro) un elemento interattivo: in tal caso
// la navigazione di riga NON deve scattare.
export const isInteractiveTarget = (event) => {
  const { target, currentTarget } = event;
  if (!(target instanceof Element)) {
    return false;
  }
  const match = target.closest(INTERACTIVE_SELECTOR);
  // Considera solo elementi interni al contenitore della riga.
  return Boolean(match && currentTarget instanceof Element && currentTarget.contains(match));
};

// Restituisce le props da spalmare sul contenitore della riga/card.
// onActivate riceve l'evento originale.
export const rowActivationProps = (onActivate, options = {}) => {
  const { role = 'link', disabled = false } = options;
  if (disabled || typeof onActivate !== 'function') {
    return {};
  }

  return {
    role,
    tabIndex: 0,
    onClick: (event) => {
      if (isInteractiveTarget(event)) {
        return;
      }
      onActivate(event);
    },
    onKeyDown: (event) => {
      // Attiva con Invio/Spazio solo quando il focus è sul contenitore stesso
      // (gli elementi interni gestiscono i propri tasti).
      if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
        event.preventDefault();
        onActivate(event);
      }
    },
  };
};
