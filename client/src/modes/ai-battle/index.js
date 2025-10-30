import BattleGameScreen from "../../screens/BattleGameScreen.jsx";
import { createActions } from "./actions.js";
import { createSelectors } from "./selectors.js";

export const key = "battle_ai";
export const Screen = BattleGameScreen;

export { createActions, createSelectors };
