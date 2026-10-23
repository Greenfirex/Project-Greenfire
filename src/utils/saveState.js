// Společná pomůcka pro ukládání — z jedné deklarace udělá hotový přihlašovací balíček.
// Řeší výchozí hodnoty, pořadí načítání i hlášení chyb, aby to každá věc nepsala ručně.
export function stateProvider(def) {
  const fallback = typeof def.defaults === 'function' ? def.defaults : () => (def && def.defaults !== undefined ? def.defaults : null);
  const restore = def && typeof def.restore === 'function' ? def.restore : () => {};
  return {
    serialize: typeof def.serialize === 'function' ? def.serialize : () => null,
    apply(data) {
      const hasData = data !== null && data !== undefined;
      const defaults = fallback();
      if (!hasData && defaults === null) return;
      restore(hasData ? data : defaults);
    },
    order: def && def.order !== undefined ? def.order : 100,
  };
}
