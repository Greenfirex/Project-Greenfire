const config = {
    type: Phaser.AUTO,
    width: window.innerWidth * 0.6,
    height: window.innerHeight,
    parent: 'gameArea',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('background', 'assets/images/backgrousdfsfnd.jpg');
}

function create() {
    this.add.image(this.scale.width / 2, this.scale.height / 2, 'background').setOrigin(0.5, 0.5);
}

function update() {
    // Game loop logic
}
