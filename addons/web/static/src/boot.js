/**
 *------------------------------------------------------------------------------
 * Odoo Web Boostrap Code
 *------------------------------------------------------------------------------
 */
(function () {
    "use strict";

    class ModuleLoader {
        /** @type {Map<string, { factory: Function; dependencies: string[]; }>} descriptions of modules */
        descriptors = new Map();
        /** @type {Map<string, any>} exported values of modules */
        modules = new Map();
        /** @type {Set<string>} names of failed modules */
        failedModules = new Set();
        /** @type {Set<string>} names of modules waiting to be started */
        jobs = new Set();

        constructor(descriptors = null) {
            this.descriptors = new Map(descriptors);
            this.checkDescriptor = descriptors === null;
        }

        /**
         * @param {string} name
         * @param {string[]} dependencies
         * @param {Function} factory
         */
        addModule(name, dependencies, factory) {
            if (typeof name !== "string") {
                throw new Error(`Module: name should be defined by a string: ${name}`);
            }
            if (!Array.isArray(dependencies)) {
                throw new Error(`Module: dependencies of "${name}" should be defined by an array: ${dependencies}`);
            }
            if (typeof factory !== "function") {
                throw new Error(`Module: factory of "${name}" should be defined by a function`);
            }
            if (this.checkDescriptor && this.descriptors.has(name)) {
                return console.warn(`Module "${name}" is already defined`);
            }
            this.descriptors.set(name, { dependencies, factory });
            this.jobs.add(name);
            this.startModules();
        }

        nextAvailableJob() {
            for (const job of this.jobs) {
                if (this.descriptors.get(job).dependencies.every((dep) => this.modules.has(dep))) {
                    return job;
                }
            }
            return null;
        }

        startModule(name) {
            try {
                const { factory } = this.descriptors.get(name);
                const module = factory((dep) => this.modules.get(dep));
                this.modules.set(name, module);
            } catch (error) {
                this.failedModules.add(name);
                console.error(`Error while loading module "${name}":\n`, error);
            }
        }

        startModules() {
            let job = null;
            while ((job = this.nextAvailableJob())) {
                this.jobs.delete(job);
                this.startModule(job);
            }
        }

        findErrors() {
            if (!this.failedModules.size && !this.jobs.size) {
                return null;
            }

            // cycle
            const dependencyGraph = new Map();
            for (const job of this.jobs) {
                dependencyGraph.set(job, this.descriptors.get(job).dependencies);
            }
            // cycle detection
            function visitJobs(jobs, visited = new Set()) {
                for (const job of jobs) {
                    const result = visitJob(job, visited);
                    if (result) {
                        return result;
                    }
                }
                return null;
            }

            function visitJob(job, visited) {
                if (visited.has(job)) {
                    const jobs = [...visited, job];
                    const index = jobs.indexOf(job);
                    return jobs
                        .slice(index)
                        .map((j) => `"${j}"`)
                        .join(" => ");
                }
                const deps = dependencyGraph.get(job);
                return deps ? visitJobs(deps, new Set(visited).add(job)) : null;
            }

            // missing dependencies
            const missing = new Set();
            for (const job of this.jobs) {
                for (const dep of this.descriptors.get(job).dependencies) {
                    if (!this.descriptors.has(dep)) {
                        missing.add(dep);
                    }
                }
            }

            return {
                failed: [...this.failedModules],
                cycle: visitJobs(this.jobs),
                missing: [...missing],
                unloaded: [...this.jobs],
            };
        }

        validateModules() {
            const errors = this.findErrors();
            if (errors) {
                throw new Error(`Couldn't load all JS modules: ${JSON.stringify(errors)}`);
            }
        }
    }

    if (!globalThis.odoo) {
        globalThis.odoo = {};
    }
    const odoo = globalThis.odoo;

    const loader = new ModuleLoader();
    odoo.loader = loader; // debug

    odoo.define = loader.addModule.bind(loader);

    odoo.waitTick = function () {
        return Promise.resolve();
    };

    odoo.checkAndReportErrors = function () {
        const errors = loader.findErrors();
        if (!errors) {
            return;
        }

        function domReady(cb) {
            if (document.readyState === "complete") {
                cb();
            } else {
                document.addEventListener("DOMContentLoaded", cb);
            }
        }

        function list(heading, names) {
            const frag = document.createDocumentFragment();
            if (!names || !names.length) {
                return frag;
            }
            frag.textContent = heading;
            const ul = document.createElement("ul");
            for (const el of names) {
                const li = document.createElement("li");
                li.textContent = el;
                ul.append(li);
            }
            frag.appendChild(ul);
            return frag;
        }

        domReady(() => {
            // Empty body
            while (document.body.childNodes.length) {
                document.body.childNodes[0].remove();
            }
            const container = document.createElement("div");
            container.className =
                "position-fixed w-100 h-100 d-flex align-items-center flex-column bg-white overflow-auto modal";
            container.style.zIndex = "10000";
            const alert = document.createElement("div");
            alert.className = "alert alert-danger o_error_detail fw-bold m-auto";
            container.appendChild(alert);
            alert.appendChild(
                list(
                    "The following modules failed to load because of an error, you may find more information in the devtools console:",
                    errors.failed
                )
            );
            alert.appendChild(
                list(
                    "The following modules could not be loaded because they form a dependency cycle:",
                    errors.cycle && [errors.cycle]
                )
            );
            alert.appendChild(
                list(
                    "The following modules are needed by other modules but have not been defined, they may not be present in the correct asset bundle:",
                    errors.missing
                )
            );
            alert.appendChild(
                list(
                    "The following modules could not be loaded because they have unmet dependencies, this is a secondary error which is likely caused by one of the above problems:",
                    errors.unloaded
                )
            );
            document.body.appendChild(container);
        });
    };

    ///////////////////////////////////////////////////////////////////////////
    // TODO: move this in tests
    /**
     * @param {string[]} moduleNames
     * @param {object} mocks
     * @returns {Map<string, any>}
     */
    function loadModules(moduleNames, mocks = {}) {
        const ModuleLoader = odoo.loader.constructor;
        const loader = new ModuleLoader(odoo.loader.descriptors);
        for (const [name, factory] of Object.entries(mocks)) {
            loader.addModule(name, [], factory);
        }
        const addJobs = (names) => {
            for (const name of names) {
                if (!this.descriptors.has(name)) {
                    throw new Error(`Module "${name}" is unknown`);
                }
                // add recursively all required dependencies
                addJobs(this.descriptors.get(name).dependencies);
                this.jobs.add(name);
            }
        };
        addJobs(moduleNames);
        loader.startModules();
        loader.validateModules();
        return loader.modules;
    }
    odoo.inject = loadModules;
    ///////////////////////////////////////////////////////////////////////////
})();
