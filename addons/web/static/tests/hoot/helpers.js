/** @odoo-module **/

// todo: move this in test assets somewhere
function inject(targets, { mocks } = {}) {
    const ModuleLoader = odoo.loader.constructor;
    const factories = new Map(odoo.loader.factories);
    const loader = new ModuleLoader();
    loader.factories = factories;

    // replace some factories by mocks
    if (mocks) {
        for (const name in mocks) {
            const deps = factories.get(name).deps;
            factories.set(name, { fn: mocks[name], deps });
        }
    }

    // add recursively all required dependencies
    const addJob = (target) => {
        if (!factories.has(target)) {
            throw new Error(`unknown dependency: ${target}`);
        }
        for (const dep of factories.get(target).deps) {
            addJob(dep);
        }
        loader.addJob(target);
    };
    for (const target of targets) {
        if (!loader.jobs.has(target)) {
            addJob(target);
        }
    }
    const errors = loader.findErrors();
    if (!errors.failed.length && !errors.unloaded.length) {
        return loader.modules;
    }
    throw new Error("Error while loading module set");
}

export function fromModules(targets) {
    const modules = inject(targets);

    return function importCode(modName) {
        // todo: throw if not in a beforeSuite
        if (!modules.has(modName)) {
            throw new Error("Cannot find module");
        }
        return modules.get(modName);
    };
}
