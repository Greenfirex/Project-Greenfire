export function createButton(scene, x, y, imageKey, text) {
    let buttonImage = scene.add.image(0, 0, imageKey);
    let buttonText = scene.add.text(0, 0, text, { fontSize: '20px', fill: '#ffffff' });

    let buttonContainer = scene.add.container(x, y, [buttonImage, buttonText]);

    buttonText.setOrigin(0.5, 0.5);
    buttonText.x = buttonImage.width / 2;
    buttonText.y = buttonImage.height / 2;

    buttonContainer.setSize(buttonImage.width, buttonImage.height);
    buttonContainer.setInteractive().on('pointerdown', callback);

    return buttonContainer;
}