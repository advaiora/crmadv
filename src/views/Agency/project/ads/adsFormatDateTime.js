// Data e ora in formato italiano leggibile. Se il valore non e' una data
// valida si restituisce com'e': meglio mostrare il grezzo che "Invalid Date".
//
// Nota: questa funzione e' copiata identica in altri otto file dell'area
// Agency. Il consolidamento in un posto solo e' annotato nel debito tecnico
// della roadmap; qui e' stata solo spostata fuori dalla pagina, non unificata.
export const formatDateTime = (value) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("it-IT");
};

export default formatDateTime;
