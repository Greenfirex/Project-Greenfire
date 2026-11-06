// Rozhodování, co je pod kurzorem — ptá se registrovaných operací podle priority.
// O obsahu operací nic neví; scéna mu dodá, co která operace na daném místě umí.
export default class InteractionSystem {

  constructor(scene) {
    this.s = scene;
    this.providers = [];
  }

  register(id, options) {
    if (!id || !options || typeof options.pick !== 'function') return;
    const priority = Number.isFinite(options.priority) ? options.priority : 0;
    this.providers = this.providers.filter((item) => item.id !== id);
    this.providers.push({ id, priority, pick: options.pick, act: options.act || null });
    this.providers.sort((first, second) => second.priority - first.priority);
  }

  targetAt(context) {
    const ctx = context || {};
    for (const provider of this.providers) {
      const target = provider.pick(ctx);
      if (target) return { ...target, id: provider.id };
    }
    return null;
  }

  targetOf(id, context) {
    const provider = this.providers.find((item) => item.id === id);
    if (!provider) return null;
    const target = provider.pick(context || {});
    return target ? { ...target, id: provider.id } : null;
  }

  act(target) {
    if (!target) return false;
    const provider = this.providers.find((item) => item.id === target.id);
    if (!provider || typeof provider.act !== 'function') return false;
    return Boolean(provider.act(target));
  }
}
