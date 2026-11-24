// Část herní scény: postup postavy — zkušenosti (za zabité tvory, později i za úkoly), nová úroveň a rozdělování bodů do vlastností.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { PLAYER_STAT_INFO } from '../data/catalogs/statInfo.js';

export default {
  gainXp(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const gained = this.playerStats.gainXp(amount);
    if (gained) {
      this.log.add(`Nová úroveň ${this.playerStats.level}! Body k rozdělení: ${this.playerStats.points} (okno postavy, C)`, 'gain');
    }
    return gained;
  },

  spendAttributePoint(key) {
    if (!this.playerStats.spendPoint(key)) return false;
    const info = PLAYER_STAT_INFO[key];
    this.log.add(`${info ? info.label : key} zvýšena na ${this.playerStats.attributes[key]}`, 'action');
    this.refreshInventory();
    return true;
  },

  refreshProgress() {
    const stats = this.playerStats;
    this.playerAttackSystem.setAttributeBonus(stats.combatBonus);
    this.xpBar.set(stats.level, stats.xp, stats.xpNeeded(), stats.points);
    if (this.characterPanel.open) this.refreshCharacterPanel();
  },
};
