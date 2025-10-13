let timerState = {
    duration: 3600, // 3600 seconds = 1 hour
    startTime: null,
    active: false,
    intervalId: null
};

// Create a progress bar element once
const footerBar = document.createElement('div');
footerBar.className = 'footer-progress-bar';

export function startImpactTimer() {
    if (timerState.active) return; // Don't start it twice

    console.log("METEOR IMPACT TIMER STARTED!");
    timerState.startTime = Date.now();
    timerState.active = true;
    
    const footer = document.getElementById('footer');
    if(footer) {
        footer.appendChild(footerBar);
    }
}

export function updateImpactTimer() {
    if (!timerState.active) return;

    const elapsedTime = (Date.now() - timerState.startTime) / 1000;
    const progress = (elapsedTime / timerState.duration) * 100;
    
    // Update the bar's width
    footerBar.style.width = `${progress}%`;

    if (progress >= 100) {
        // Game Over! (for now, just log it)
        console.log("IMPACT!");
        timerState.active = false;
    }
}