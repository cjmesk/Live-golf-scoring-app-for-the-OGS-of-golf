window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

window.OGSGolf.ui.getPlayerMeta = function getPlayerMeta(player) {
  const ghinText = player.ghin ? `GHIN ${player.ghin}` : "No GHIN";
  return `${ghinText} | Index ${window.OGSGolf.rules.formatHandicapIndex(player.handicap)} | ${player.tee} tees`;
};
