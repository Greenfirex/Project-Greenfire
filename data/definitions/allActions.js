import { salvageActions } from './actions.js';
import { upgradeActions } from './upgrades.js';

export const allActions = [
    ...salvageActions,
    ...upgradeActions,
];
