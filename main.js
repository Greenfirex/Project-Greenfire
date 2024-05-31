const config = {
    type: Phaser.CANVAS,
    width: window.innerWidth, // Nastavuje šířku scény podle šířky okna prohlížeče
    height: window.innerHeight, // Nastavuje výšku scény podle výšky okna prohlížeče
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const buttonStyle = {
    fontSize: '32px',
    fill: '#ffffff',
    backgroundColor: '#0000ff',
    padding: { x: 10, y: 5 },
    borderRadius: 5
};

const game = new Phaser.Game(config);

function preload() {
    // Načtěte zde zdroje (obrázky, zvuky, atd.)
this.load.image('background', 'assets/images/background.jpg');
this.load.image('button1', 'assets/images/PNG/Button01.png');
}

function create() {
    // Inicializace herních objektů a proměnných zde
    this.add.image(config.width / 2, config.height / 2, 'background').setDisplaySize(config.width, config.height); // Nastavíte obrázek pozadí tak, aby vyplňoval celou scénu

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x00ff00, 1);

// Vodorovná čára
    graphics.beginPath();
    graphics.moveTo(0, config.height * 0.1); // Začátek na 10% od vrchu
    graphics.lineTo(config.width * 0.8, config.height * 0.1); // Končí na svislé čáře
    graphics.strokePath();

// Svislá čára
    graphics.beginPath();
    graphics.moveTo(config.width * 0.8, 0);
    graphics.lineTo(config.width * 0.8, config.height);
    graphics.strokePath();

// Vytvoření tlačítka s grafikou a textem
    let button1 = this.add.image(0, 0, 'button1');
    let text1 = this.add.text(0, 0, 'Klikni zde', { fontSize: '20px', fill: '#ffffff' });

    let container1 = this.add.container(config.width * 0.4, config.height * 0.2, [button1, text1]);

// Vycentrování textu na tlačítku
    text1.setOrigin(0.5, 0.5);
    text1.x = button1.width / 2;
    text1.y = button1.height / 2;

    container1.setSize(button1.width, button1.height);
    container1.setInteractive()
        .on('pointerdown', () => {
            console.log('Tlačítko 1 bylo stisknuto!');
        });



function update() {
    // Logika herní smyčky jde sem
}

