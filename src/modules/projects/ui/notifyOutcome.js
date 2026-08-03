import { toast } from "react-toastify";

// Ponte unico fra gli esiti degli hook ({attempted, error}, la convenzione di
// useStageChecklistRules) e i toast della pagina. L'ORDINE dei due rami e'
// portante: prima `error`, poi `attempted` — le validazioni arrivano come
// {attempted: false, error: "..."} e si vedono solo perche' l'errore viene
// guardato per primo. Invertire i rami le farebbe sparire in silenzio.
export const notifyOutcome = ({ attempted, error }, successMessage, toastOptions) => {
  if (error) {
    toast.error(error);
    return;
  }

  if (attempted) {
    toast.success(successMessage, toastOptions);
  }
};
