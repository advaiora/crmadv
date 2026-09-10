import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { fetchGoogleSignInAvailability } from "../utils/googleSignInAvailability";
import { useGoogleSignInAvailability } from "./useGoogleSignInAvailability";

vi.mock("../utils/googleSignInAvailability", () => ({
  fetchGoogleSignInAvailability: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGoogleSignInAvailability", () => {
  it("parte nascosto e diventa true quando il backend conferma la capacita'", async () => {
    fetchGoogleSignInAvailability.mockResolvedValue(true);

    const { result } = renderHook(() => useGoogleSignInAvailability());

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("resta false quando il backend segnala GOOGLE_CLIENT_ID assente", async () => {
    fetchGoogleSignInAvailability.mockResolvedValue(false);

    const { result } = renderHook(() => useGoogleSignInAvailability());

    await waitFor(() => expect(fetchGoogleSignInAvailability).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(false);
  });
});
