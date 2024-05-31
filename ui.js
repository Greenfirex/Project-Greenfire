export function createButton(scene, x, y, imageKey, text, callback) {
    let buttonImage = scene.add.image(0, 0, imageKey);
    let buttonText = scene.add.text(0, 0, text, { fontSize: '20px', fill: '#ffffff' });

    buttonText.setOrigin(0.5, 0.5);
    buttonImage.setOrigin(0.5, 0.5);

    let buttonContainer = scene.add.container(x, y, [buttonImage, buttonText]);

    buttonText.x = 0;
    buttonText.y = 0;

    buttonContainer.setSize(buttonImage.width, buttonImage.height);
    buttonContainer.setInteractive();

    buttonContainer.on('pointerdown', callback);

    // Hover effect
    buttonContainer.on('pointerover', () => {
        buttonImage.setTint(0x44ff44); // Change to a brighter color
        scene.add.graphics().lineStyle(2, 0xffffff, 1).strokeRect(buttonContainer.x - buttonImage.width / 2, buttonContainer.y - buttonImage.height / 2, buttonImage.width, buttonImage.height);
    });

    buttonContainer.on('pointerout', () => {
        buttonImage.clearTint(); // Reset color
        scene.children.each(child => {
            if (child.type === 'Graphics') {
                child.clear(); // Clear graphics
            }
        });
    });

    return buttonContainer;
}