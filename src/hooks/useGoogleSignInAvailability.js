import { useEffect, useState } from "react";
import { fetchGoogleSignInAvailability } from "../utils/googleSignInAvailability";

// Parte nascosto: finche' il backend non conferma la capacita', nessun bottone morto.
export const useGoogleSignInAvailability = () => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchGoogleSignInAvailability().then((result) => {
      if (!cancelled) {
        setAvailable(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return available;
};
