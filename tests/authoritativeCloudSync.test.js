const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
global.OGSGolf = {};

function load(filePath) {
  const source = fs.readFileSync(path.join(__dirname, "..", filePath), "utf8");
  vm.runInThisContext(source, { filename: filePath });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

load("src/state/roundSync.js");

const blankScores = () => Array(18).fill(null);
const cloudRound = {
  id: "round-sync-test",
  players: [
    { id: "chris", name: "Chris Mesker", matchTeam: "A" },
    { id: "allen", name: "Allen Carmack", matchTeam: "A" },
    { id: "alex-felts", name: "Alex Felts", matchTeam: "B" },
    { id: "ben", name: "Ben Rucks", matchTeam: "B" }
  ],
  roundSettings: {
    players: [],
    selectedPlayerIds: ["chris", "allen", "alex-felts", "ben"],
    groups: [["chris", "allen", "alex-felts", "ben"]],
    groupRecords: [{ playerIds: ["chris", "allen", "alex-felts", "ben"], currentHole: 5 }],
    groupScorers: ["chris"]
  },
  savedScores: {
    chris: [4, 4, 5, 4, ...Array(14).fill(null)],
    allen: [5, 4, 5, 4, ...Array(14).fill(null)],
    "alex-felts": [4, 5, 4, 5, ...Array(14).fill(null)],
    ben: [5, 5, 4, 4, ...Array(14).fill(null)]
  },
  savedHoleResults: Array(18).fill(null),
  groupHoleIndexes: [4],
  playerStatuses: {}
};
cloudRound.roundSettings.players = cloudRound.players;

const stalePhoneRound = {
  ...cloudRound,
  players: [
    { id: "chris", name: "Chris Mesker", matchTeam: "B" },
    { id: "allen", name: "Allen Carmack", matchTeam: "A" },
    { id: "alex-felts", name: "Alex Felts", matchTeam: "A" },
    { id: "ben-graves", name: "Ben Graves", matchTeam: "B" }
  ],
  roundSettings: {
    ...cloudRound.roundSettings,
    groups: [["alex-felts", "allen", "chris", "ben-graves"]],
    selectedPlayerIds: ["chris", "allen", "alex-felts", "ben-graves"]
  },
  savedScores: {
    ...cloudRound.savedScores,
    "ben-graves": [6, 6, 5, 6, 7, ...Array(13).fill(null)]
  },
  savedHoleResults: Array(18).fill(null),
  currentGroupIndex: 0,
  currentHoleIndex: 4,
  currentHole: 5
};

const stalePhoneMerge = OGSGolf.state.roundSync.mergeActiveRound({
  localRound: stalePhoneRound,
  cloudRound,
  savedGroupIndex: 0,
  savedHoleIndex: 4
});

assert(
  stalePhoneMerge.players.map((player) => player.id).join(",") === "chris,allen,alex-felts,ben",
  "A stale scoring phone replaced the authoritative cloud roster."
);
assert(
  stalePhoneMerge.roundSettings.groups[0].join(",") === "chris,allen,alex-felts,ben",
  "A stale scoring phone replaced the authoritative cloud group."
);
assert(!stalePhoneMerge.savedScores["ben-graves"], "The inactive fifth player remained in saved scores.");

const commissionerCorrection = {
  ...stalePhoneRound,
  players: cloudRound.players,
  roundSettings: cloudRound.roundSettings,
  savedScores: {
    chris: blankScores(),
    allen: blankScores(),
    "alex-felts": blankScores(),
    ben: blankScores()
  }
};
const authoritativeMerge = OGSGolf.state.roundSync.mergeActiveRound({
  localRound: commissionerCorrection,
  cloudRound: stalePhoneRound,
  preferLocalSetup: true
});

assert(
  authoritativeMerge.players.some((player) => player.id === "ben")
    && !authoritativeMerge.players.some((player) => player.id === "ben-graves"),
  "The commissioner's authoritative player replacement was not preserved."
);
assert(
  authoritativeMerge.players.find((player) => player.id === "chris").matchTeam === "A",
  "The commissioner's corrected match teams were not preserved."
);

OGSGolf.cloud = {
  supabaseConfig: { url: "https://example.supabase.co", anonKey: "test-key" }
};
const requests = [];
let rosterReads = 0;

global.fetch = async (url, options = {}) => {
  requests.push({ url, method: options.method || "GET" });

  if (url.includes("round_players?select=player_id,playing")) {
    rosterReads += 1;
    const rows = rosterReads === 1
      ? [{ player_id: "chris", playing: true }, { player_id: "allen", playing: true }, { player_id: "alex-felts", playing: true }, { player_id: "ben", playing: true }, { player_id: "ben-graves", playing: true }]
      : [{ player_id: "chris", playing: true }, { player_id: "allen", playing: true }, { player_id: "alex-felts", playing: true }, { player_id: "ben", playing: true }, { player_id: "ben-graves", playing: false }];
    return { ok: true, json: async () => rows, text: async () => "" };
  }

  return { ok: true, json: async () => [], text: async () => "" };
};

load("src/cloud/roundCloudService.js");

(async () => {
  const result = await OGSGolf.cloud.roundCloudService.saveActiveRound({
    ...cloudRound,
    course: { id: "twelve-stones", name: "Twelve Stones", par: 72 }
  });

  assert(result.ok && result.detailSyncOk, "The reconciled active round did not save cleanly.");
  assert(
    requests.some((request) => request.method === "DELETE"
      && request.url.includes("/rest/v1/hole_scores?")
      && request.url.includes("player_id=eq.ben-graves")),
    "The obsolete player's active-round scores were not removed."
  );
  assert(
    requests.some((request) => request.method === "PATCH"
      && request.url.includes("/rest/v1/round_players?")
      && request.url.includes("player_id=eq.ben-graves")),
    "The obsolete player was not retired from the active round."
  );

  console.log("authoritative cloud sync and two-phone replacement tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
