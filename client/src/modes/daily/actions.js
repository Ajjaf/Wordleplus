import { buildApiUrl } from "../../config";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const LS_DAILY_USER = "wp.dailyUserId";

function getOrCreateUserId() {
  let userId = localStorage.getItem(LS_DAILY_USER);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(LS_DAILY_USER, userId);
  }
  return userId;
}

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
        const userId = getOrCreateUserId();
        const res = await fetch(buildApiUrl("/api/daily"), {
          method: "GET",
          credentials: "include",
          headers: {
            "X-User-Id": userId,
          },
        });
        if (!res.ok) {
          const errorPayload = await safeJson(res);
          throw new Error(errorPayload?.error || "Failed to load daily challenge");
        }
        const data = await safeJson(res);
        
        // Save the userId from server if returned
        if (data?.userId) {
          localStorage.setItem(LS_DAILY_USER, data.userId);
        }
        
        return data;
      } catch (err) {
        return { error: err.message || "Unable to load daily challenge" };
      }
    },

    async submitGuess(guess) {
      try {
        const userId = getOrCreateUserId();
        const res = await fetch(buildApiUrl("/api/daily/guess"), {
          method: "POST",
          credentials: "include",
          headers: {
            ...JSON_HEADERS,
            "X-User-Id": userId,
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
