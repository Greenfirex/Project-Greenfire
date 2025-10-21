let activeActionsState = {
    crashSite: null
};

export function getActiveCrashSiteAction() {
    return activeActionsState.crashSite;
}

export function setActiveCrashSiteAction(action) {
    activeActionsState.crashSite = action;
}