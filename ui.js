export function createButton(scene, x, y, imageKey, text, callback, tooltipText) {
    let buttonImage = scene.add.image(0, 0, imageKey);
    let buttonText = scene.add.text(0, 0, text, { fontSize: '20px', fill: '#ffffff' });

    buttonText.setOrigin(0.5, 0.5);
    buttonImage.setOrigin(0.5, 0.5);

    let buttonContainer = scene.add.container(x, y, [buttonImage, buttonText]);

    buttonText.x = 0;
    buttonText.y = 0;

    buttonContainer.setSize(buttonImage.width, buttonImage.height);
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
        buttonGraphics.strokeRect(buttonContainer.x - buttonImage.width / 2, buttonContainer.y - buttonImage.height / 2, buttonImage.width, buttonImage.height);
        tooltip.setPosition(pointer.worldX + 10, pointer.worldY + 10);
        tooltip.setVisible(true);
    });

    buttonContainer.on('pointerout', () => {
        buttonImage.clearTint();
        buttonGraphics.clear();
        tooltip.setVisible(false);
    });

    return buttonContainer;
}