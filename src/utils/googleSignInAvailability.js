import { apiFetch } from "../lib/apiFetch";

// `/auth/google/health` non segue la busta `{ data }` delle altre rotte
// (e' un endpoint di salute, non passa da `ok()`): si legge il payload grezzo.
export const fetchGoogleSignInAvailability = async () => {
  try {
    const response = await apiFetch("/auth/google/health", {
      method: "GET",
      skipAuthHeaders: true,
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.googleClientIdConfigured === true;
  } catch (_error) {
    return false;
  }
};
