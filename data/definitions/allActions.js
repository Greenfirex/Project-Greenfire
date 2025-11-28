import { salvageActions } from './actions.js';
import { upgradeActions } from './upgrades.js';

// Live aggregator array. Keep this object reference stable so imports stay in sync.
export const allActions = [
    ...salvageActions,
    ...upgradeActions,
];

// Refresh the contents to reflect current live actions after resets/loads.
export function refreshAllActions() {
    allActions.length = 0;
    allActions.push(...salvageActions, ...upgradeActions);
}
