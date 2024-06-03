function createButton(text, onClick) {
    const button = document.createElement('button');
    button.innerText = text;
    button.classList.add('menu-button');
    button.onclick = onClick;
    return button;
}