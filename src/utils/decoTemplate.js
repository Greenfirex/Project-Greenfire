// Překlad dekorace na šablonu — procedura z kódu, nebo model z disku.
// Na jednom místě, aby se seznam druhů neopisoval na víc místech.
import { treeTemplate } from './treeFactory.js';
import { rockTemplate } from './rockFactory.js';
import { shellTemplate } from './shellFactory.js';
import { coralTemplate } from './coralFactory.js';
import { flowerTemplate } from './flowerFactory.js';
import { bushTemplate } from './bushFactory.js';
import { resolveModel } from './assetLoader.js';

export function proceduralTemplate(scene, def) {
  if (!def) return null;
  if (def.tree) return treeTemplate(scene, def.tree);
  if (def.rock) return rockTemplate(scene, def.rock);
  if (def.shell) return shellTemplate(scene, def.shell);
  if (def.coral) return coralTemplate(scene, def.coral);
  if (def.flower) return flowerTemplate(scene, def.flower);
  if (def.bush) return bushTemplate(scene, def.bush);
  return null;
}

export function decorationTemplate(scene, def) {
  const quick = proceduralTemplate(scene, def);
  if (quick) return Promise.resolve(quick);
  if (!def || !def.model) return Promise.resolve(null);
  return resolveModel(scene, def.model);
}
