const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    // Load assets here (images, sounds, etc.)
}

function create() {
    // Initialize game objects and variables here
    this.add.text(100, 100, 'Welcome to Sci-Fi Idle Game', { font: '24px Arial', fill: '#ffffff' });
}

function update() {
    // Game loop logic goes here
}