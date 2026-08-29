window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

window.OGSGolf.ui.parseHandicapIndex = function parseHandicapIndex(value) {
  const text = String(value ?? "").trim().replaceAll(" ", "");

  if (!text) return null;

  const plusGolfer = text.startsWith("+");
  const numericText = plusGolfer ? text.slice(1) : text;

  if (!/^-?\d+(?:\.\d+)?$/.test(numericText)) return null;

  const number = Number(numericText);
  if (!Number.isFinite(number)) return null;

  return plusGolfer ? -Math.abs(number) : number;
};

window.OGSGolf.ui.formatHandicapIndex = function formatHandicapIndex(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return number < 0 ? `+${Math.abs(number)}` : String(number);
};

window.OGSGolf.ui.getPlayerMeta = function getPlayerMeta(player) {
  const ghinText = player.ghin ? `GHIN ${player.ghin}` : "No GHIN";
  return `${ghinText} | Index ${window.OGSGolf.ui.formatHandicapIndex(player.handicap)} | ${player.tee} tees`;
};
