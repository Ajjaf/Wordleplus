import { lazy } from "react";
import { createActions } from "./actions.js";
import { createSelectors } from "./selectors.js";

export const key = "duel";
export const Screen = lazy(() => import("../../screens/DuelGameScreen.jsx"));

export { createActions, createSelectors };
