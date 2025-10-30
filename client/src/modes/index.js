import * as duel from "./duel/index.js";
import * as shared from "./shared/index.js";
import * as battle from "./battle/index.js";
import * as aiBattle from "./ai-battle/index.js";
import * as daily from "./daily/index.js";

export const MODES = {
  duel,
  shared,
  battle,
  battle_ai: aiBattle,
  daily,
};
