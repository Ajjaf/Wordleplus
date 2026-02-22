import { lazy } from "react";
import { createActions } from "./actions.js";
import { createSelectors } from "./selectors.js";

export const key = "shared";
export const Screen = lazy(() => import("../../screens/SharedDuelGameScreen.jsx"));

export { createActions, createSelectors };
