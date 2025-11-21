import { buildApiUrl } from "../../config";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

export function createActions() {
  const safeJson = async (response) => {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error("Invalid response from server");
    }
  };

  return {
    async loadChallenge() {
      try {
        const res = await fetch(buildApiUrl("/api/daily"), {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) {
          const errorPayload = await safeJson(res);
          throw new Error(errorPayload?.error || "Failed to load daily challenge");
        }
        const data = await safeJson(res);
        return data;
      } catch (err) {
        return { error: err.message || "Unable to load daily challenge" };
      }
    },

    async submitGuess(guess) {
      try {
        const res = await fetch(buildApiUrl("/api/daily/guess"), {
          method: "POST",
          credentials: "include",
          headers: {
            ...JSON_HEADERS,
          },
          body: JSON.stringify({ guess }),
        });
        if (!res.ok) {
          const errorPayload = await safeJson(res);
          throw new Error(errorPayload?.error || "Guess rejected");
        }
        return await safeJson(res);
      } catch (err) {
        return { error: err.message || "Unable to submit guess" };
      }
    },
  };
}
