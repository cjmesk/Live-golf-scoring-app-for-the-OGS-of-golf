window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

function escapeRosterText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.OGSGolf.ui.clearPlayerForm = function clearPlayerForm(elements) {
  elements.editingPlayerId.value = "";
  elements.playerName.value = "";
  elements.playerGhin.value = "";
  elements.playerHandicap.value = "";
  elements.playerTee.value = "white";
  elements.playerActive.checked = true;
  elements.savePlayer.textContent = "Save Player";
};

window.OGSGolf.ui.fillPlayerForm = function fillPlayerForm(elements, player) {
  elements.editingPlayerId.value = player.id;
  elements.playerName.value = player.name;
  elements.playerGhin.value = player.ghin || "";
  elements.playerHandicap.value = window.OGSGolf.rules.formatHandicapIndex(player.handicap);
  elements.playerTee.value = player.tee;
  elements.playerActive.checked = player.active;
  elements.savePlayer.textContent = "Update Player";
};

window.OGSGolf.ui.readPlayerForm = function readPlayerForm(elements) {
  const name = elements.playerName.value.trim();
  const handicapValue = elements.playerHandicap.value.trim();
  const handicap = window.OGSGolf.rules.parseHandicapIndex(elements.playerHandicap.value);

  if (!name) {
    return {
      error: "Player name is required."
    };
  }

  if (!handicapValue || !Number.isFinite(handicap)) {
    return {
      error: "Handicap index must be a valid number."
    };
  }

  return {
    player: {
    id: elements.editingPlayerId.value || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    ghin: elements.playerGhin.value.trim(),
    handicap,
    tee: elements.playerTee.value,
    active: elements.playerActive.checked
    }
  };
};

window.OGSGolf.ui.renderPlayerManagement = function renderPlayerManagement(elements, players, maxRosterSize) {
  elements.rosterCount.textContent = `${players.length} of ${maxRosterSize} members`;
  elements.savePlayer.disabled = !elements.editingPlayerId.value && players.length >= maxRosterSize;

  if (players.length === 0) {
    elements.playerManagementList.innerHTML = `<div class="empty-state">No players in the roster yet.</div>`;
    return;
  }

  elements.playerManagementList.innerHTML = players
    .map((player) => `
      <div class="member-row player-management-row">
        <div>
          <strong>${escapeRosterText(player.name)}</strong>
          <span class="player-details">
            ${player.ghin ? `GHIN ${escapeRosterText(player.ghin)}` : "No GHIN"}
            | Index ${window.OGSGolf.rules.formatHandicapIndex(player.handicap)}
            | Default tee ${escapeRosterText(player.tee)}
            | ${player.active ? "Active" : "Inactive"}
          </span>
          <span class="player-details">Player ID: ${escapeRosterText(player.id)}</span>
        </div>
        <div class="player-management-row-actions">
          <button type="button" class="secondary-button" data-edit-player="${escapeRosterText(player.id)}">Edit</button>
          <button type="button" class="secondary-button" data-remove-player="${escapeRosterText(player.id)}">Remove</button>
        </div>
      </div>
    `)
    .join("");
};
