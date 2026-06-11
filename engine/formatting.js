export let currentNotation = 'standard';

const names = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

export function setNotation(notation) {
    currentNotation = notation;
}

export function formatNumber(num) {
    if (num < 1000) {
        return num.toFixed(2);
    }

    switch (currentNotation) {
        case 'scientific':
            return num.toExponential(2);
        case 'short':
            const i = Math.floor(Math.log10(num) / 3);
            const val = num / Math.pow(1000, i);
            return `${val.toFixed(2)} ${names[i]}`;
        case 'standard':
        default:
            return Math.floor(num).toLocaleString();
    }
}