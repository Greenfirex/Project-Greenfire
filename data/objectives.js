// Minimal objectives module for the timeloop reset game.
// Legacy file was moved to backup/data/.
export function getInitialStoryLog() {
    return [];
}

export let storyLog = getInitialStoryLog();

let objectivesStatus = [];

export function getObjectivesStatus() {
    return objectivesStatus;
}

export function setObjectivesStatus(status) {
    objectivesStatus = Array.isArray(status) ? status : [];
}

export function getVisibleObjectives() {
    return [];
}

export function getAllObjectivesWithState() {
    return [];
}

export function getObjectiveSteps() {
    return [];
}

export function getTrackedObjectiveId() {
    return null;
}

export function setTrackedObjective() {}

export function recomputeObjectives() {
    return { newlyActive: [] };
}

export function resetObjectives() {
    objectivesStatus = [];
}