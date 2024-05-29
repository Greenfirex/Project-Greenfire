const config = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
	// Load assets here (images, sounds, etc.)
	this.load.image('background', 'assets/images/background.jpg');
}

function create() {
	// Initialize game objects and variables here
	this.add.image(960, 540, 'background').setOrigin(0.5, 0.5);
}

function update() {
    // Game loop logic goes here
}

