export function createButton(scene, x, y, imageKey, text, callback) {
    let buttonImage = scene.add.image(0, 0, imageKey);
    let buttonText = scene.add.text(0, 0, text, { fontSize: '20px', fill: '#ffffff' });

    buttonText.setOrigin(0.5, 0.5);
    buttonImage.setOrigin(0.5, 0.5);

    let buttonContainer = scene.add.container(x, y, [buttonImage, buttonText]);

    buttonText.x = 0;
    buttonText.y = 0;

    buttonContainer.setSize(buttonImage.width, buttonImage.height);
    buttonContainer.setInteractive().on('pointerdown', callback);

    return buttonContainer;
}