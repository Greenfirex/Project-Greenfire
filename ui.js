export function createButton(scene, x, y, width, height, imageKey, text, callback, tooltipText) {
    let buttonImage = scene.add.image(0, 0, imageKey);
    let buttonText = scene.add.text(0, 0, text, { fontSize: '20px', fill: '#ffffff' });

    buttonText.setOrigin(0.5, 0.5);
    buttonImage.setOrigin(0.5, 0.5);

    let buttonContainer = scene.add.container(x, y, [buttonImage, buttonText]);

    buttonText.x = 0;
    buttonText.y = 0;

    buttonContainer.setSize(width, height);
    buttonContainer.setInteractive();

    let buttonGraphics = scene.add.graphics();

    let tooltip = scene.add.text(0, 0, tooltipText, {
        fontSize: '16px',
        fill: '#ffffff',
        backgroundColor: '#000000',
        padding: {
            left: 10,
            right: 10,
            top: 5,
            bottom: 5
        }
    });

    tooltip.setVisible(false);

    buttonContainer.on('pointerdown', callback);

    buttonContainer.on('pointerover', (pointer) => {
        buttonImage.setTint(0x44ff44);
        buttonGraphics.lineStyle(2, 0xffffff, 1);
        buttonGraphics.strokeRect(buttonContainer.x - width / 2, buttonContainer.y - height / 2, width, height);
        tooltip.setPosition(pointer.worldX + 10, pointer.worldY + 10);
        tooltip.setVisible(true);
    });

    buttonContainer.on('pointerout', () => {
        buttonImage.clearTint();
        buttonGraphics.clear();
        tooltip.setVisible(false);
    });
}

export function createLeftButton(scene, x, y, text, callback, tooltipText) {
    const leftColumnWidth = scene.sys.game.config.width * 0.2; // Šířka levého sloupce

    // Vypočítáme šířku a výšku tlačítka
    const buttonWidth = leftColumnWidth * 0.8;
    const buttonHeight = scene.sys.game.config.height * 0.05;

    // Vytvoříme tlačítko s použitím funkce createButton z ui.js
    let buttonImage = scene.add.image(x, y, 'button1');
    let buttonText = scene.add.text(x, y, text, { fontSize: '20px', fill: '#ffffff', align: 'center' }); // Zarovnání textu na střed

    // Nastavení velikosti obrázku na rozměry tlačítka
    buttonImage.setDisplaySize(buttonWidth, buttonHeight);

    let buttonContainer = scene.add.container(x, y, [buttonImage, buttonText]);

    // Upravení pozice textu tak, aby byl zarovnán s obrázkem tlačítka
    buttonText.setPosition(buttonContainer.x, buttonContainer.y);

    buttonContainer.setSize(buttonWidth, buttonHeight);
    buttonContainer.setInteractive();

    let buttonGraphics = scene.add.graphics();

    let tooltip = scene.add.text(0, 0, tooltipText, {
        fontSize: '16px',
        fill: '#ffffff',
        backgroundColor: '#000000',
        padding: {
            left: 10,
            right: 10,
            top: 5,
            bottom: 5
        }
    });

    tooltip.setVisible(false);

    buttonContainer.on('pointerdown', callback);

    buttonContainer.on('pointerover', (pointer) => {
        buttonImage.setTint(0x44ff44);
        buttonGraphics.lineStyle(2, 0xffffff, 1);
        buttonGraphics.strokeRect(buttonContainer.x - buttonWidth / 2, buttonContainer.y - buttonHeight / 2, buttonWidth, buttonHeight);
        tooltip.setPosition(pointer.worldX + 10, pointer.worldY + 10);
        tooltip.setVisible(true);
    });

    buttonContainer.on('pointerout', () => {
        buttonImage.clearTint();
        buttonGraphics.clear();
        tooltip.setVisible(false);
    });
}
