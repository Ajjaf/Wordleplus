import { lazy } from "react";
import { createActions } from "./actions.js";
import { createSelectors } from "./selectors.js";

export const key = "battle";
export const Screen = lazy(() => import("../../screens/BattleGameScreen.jsx"));

export { createActions, createSelectors };
