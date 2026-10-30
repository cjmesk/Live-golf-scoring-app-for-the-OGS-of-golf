const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const app = fs.readFileSync("src/app.js", "utf8");
const start = app.indexOf("let handicapSaveQueue");
const end = app.indexOf("elements.memberList.onHandicapIndexChange", start);
const calls = [];
const oldPlayer = { id: "chris", handicap: 13, tee: "white" };
const context = vm.createContext({
  commissionerMode: true,
  members: [oldPlayer, { id: "other", handicap: 20 }],
  playerStorage: { saveAll(players) { context.saved = players; } },
  roundCloudService: { async updatePlayerHandicap(id, index) { calls.push([id, index]); return { ok: true }; } }
});
vm.runInContext(app.slice(start, end), context);
(async () => {
  await vm.runInContext('saveCurrentPlayerIndex("chris", 8.5)', context);
  assert.equal(context.saved[0].handicap, 8.5);
  assert.equal(context.saved[0].handicapIndex, 8.5);
  assert.equal(context.saved[1].handicap, 20);
  assert.equal(oldPlayer.handicap, 13, "Historical round object must not change");
  await vm.runInContext('saveCurrentPlayerIndex("chris", -1.4)', context);
  assert.equal(context.saved[0].handicap, -1.4);
  await vm.runInContext('saveCurrentPlayerIndex("chris", 85)', context);
  assert.equal(calls.length, 2, "Invalid indexes must not save");
  const requests = [];
  const cloud = vm.createContext({
    window: { OGSGolf: { cloud: { supabaseConfig: { url: "https://example.test", anonKey: "test" } } } },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => [{ id: "chris", handicap_index: 8.5 }] };
    }
  });
  vm.runInContext(fs.readFileSync("src/cloud/roundCloudService.js", "utf8"), cloud);
  const result = await cloud.window.OGSGolf.cloud.roundCloudService.updatePlayerHandicap("chris", 8.5);
  assert.equal(result.ok, true);
  assert.equal(requests[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[0].options.body), { handicap_index: 8.5 });
  cloud.fetch = async () => ({ ok: true, json: async () => [] });
  assert.equal((await cloud.window.OGSGolf.cloud.roundCloudService.updatePlayerHandicap("chris", 8.5)).ok, false);
  console.log("Current player index persistence tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
