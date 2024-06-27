/** @odoo-module ignore */

(() => {
    const { factories, modules } = window.top.odoo.loader;
    for (const moduleName of ["@odoo/hoot", "@odoo/hoot-mock"]) {
        const module = modules.get(moduleName);
        odoo.loader.factories.set(moduleName, factories.get(moduleName));
        odoo.loader.modules.set(moduleName, module);
    }

    modules.get("@odoo/hoot-mock").patchWindow(window);

    odoo.define = {
        ["define (mocked)"](name, dependencies, factory) {
            const lazy =
                !name.endsWith(".hoot") && !name.startsWith("@odoo") && !name.includes("/../lib/");
            return odoo.loader.define(name, dependencies, factory, lazy);
        },
    }["define (mocked)"];
})();
