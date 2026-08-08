window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.state = window.OGSGolf.state || {};

window.OGSGolf.state.roundStorage = {
  key: "ogsGolfRounds",
  unfinishedKey: "ogsGolfUnfinishedRound",

  getAll() {
    try {
      const rounds = JSON.parse(window.localStorage.getItem(this.key) || "[]");
      return Array.isArray(rounds) ? rounds : [];
    } catch (error) {
      console.warn("[OGS Golf] Completed-round cache was unreadable and has been ignored.", error);
      return [];
    }
  },

  save(roundData) {
    const rounds = this.getAll();
    const existingIndex = rounds.findIndex((round) => round.id === roundData.id);

    if (existingIndex >= 0) {
      rounds[existingIndex] = roundData;
    } else {
      rounds.push(roundData);
    }

    try {
      window.localStorage.setItem(this.key, JSON.stringify(rounds));
      return rounds;
    } catch (error) {
      // Completed snapshots can be large. Trim older cached rounds until the
      // newest one fits; the cloud archive remains the source of truth.
      const newestFirst = rounds
        .filter((round) => round?.id !== roundData.id)
        .sort((first, second) => {
          const firstTime = Date.parse(first?.completedAt || first?.savedAt || first?.date || 0) || 0;
          const secondTime = Date.parse(second?.completedAt || second?.savedAt || second?.date || 0) || 0;
          return secondTime - firstTime;
        });

      while (newestFirst.length > 0) {
        newestFirst.pop();
        try {
          const reducedRounds = [...newestFirst, roundData];
          window.localStorage.setItem(this.key, JSON.stringify(reducedRounds));
          return reducedRounds;
        } catch (retryError) {
          // Keep trimming. A cache failure must never block cloud results.
        }
      }

      console.warn("[OGS Golf] Completed round opened without a local cache copy.", error);
      return rounds;
    }
  },

  remove(roundId) {
    const rounds = this.getAll().filter((round) => round.id !== roundId);
    window.localStorage.setItem(this.key, JSON.stringify(rounds));
    return rounds;
  },

  getUnfinished() {
    return JSON.parse(window.localStorage.getItem(this.unfinishedKey) || "null");
  },

  saveUnfinished(roundData) {
    window.localStorage.setItem(this.unfinishedKey, JSON.stringify(roundData));
  },

  clearUnfinished() {
    window.localStorage.removeItem(this.unfinishedKey);
  }
};
