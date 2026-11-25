// Pozadí hlavního menu a načítání — smyčka videa ostrova a nad ní logo se září a odleskem.
// Než se video rozjede (nebo když ho prohlížeč nepřehraje), je vidět jeho první snímek jako obrázek.
const VIDEO_URL = 'assets/ui/menu-loop.mp4';
const POSTER_URL = 'assets/ui/menu-poster.jpg';
const LOGO_URL = 'assets/ui/logo.png';

export default class MenuBackdrop {

  constructor() {
    this.root = null;
    this.video = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'menu-backdrop';
    root.style.backgroundImage = `url('${POSTER_URL}')`;
    root.innerHTML = `
      <video class="menu-backdrop__video" muted loop playsinline autoplay preload="auto"></video>
      <div class="menu-backdrop__shade"></div>
      <div class="menu-backdrop__logo">
        <img src="${LOGO_URL}" alt="Project Greenfire" draggable="false">
        <div class="menu-backdrop__shine"></div>
      </div>
    `;
    const shine = root.querySelector('.menu-backdrop__shine');
    shine.style.maskImage = `url('${LOGO_URL}')`;
    shine.style.webkitMaskImage = `url('${LOGO_URL}')`;
    const video = root.querySelector('.menu-backdrop__video');
    video.muted = true;
    video.poster = POSTER_URL;
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    video.src = VIDEO_URL;
    const started = video.play();
    if (started && started.catch) started.catch(() => {});
    this.root = root;
    this.video = video;
    return root;
  }

  dispose() {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
    if (this.root) this.root.remove();
    this.root = null;
  }
}
