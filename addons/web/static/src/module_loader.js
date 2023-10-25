/**
 *------------------------------------------------------------------------------
 * Odoo Web Boostrap Code
 *------------------------------------------------------------------------------
 */
(function () {
    "use strict";

    function topologicalSort(elems, getDependencies) {
        const result = [];
        const visited = new Set();
        function visit(n) {
            if (visited.has(n)) {
                return;
            }
            visited.add(n);
            // first visit all dependencies of n, then append n to result
            for (const dep of getDependencies(n)) {
                visit(dep);
            }
            result.push(n);
        }

        for (const el of elems) {
            visit(el);
        }

        return result;
    }

    class ModuleLoader {
        /** @type {Map<string,{fn: Function, deps: string[]}>} mapping name => deps/fn */
        factories = new Map();
        /** @type {Set<string>} names of modules waiting to be started */
        jobs = new Set();
        /** @type {Set<string>} names of failed modules */
        failed = new Set();

        /** @type {Map<string,any>} mapping name => value */
        modules = new Map();

        bus = new EventTarget();

        checkErrorProm = null;

        /**
         * @param {string} name
         * @param {string[]} deps
         * @param {Function} factory
         */
        define(name, deps, factory) {
            if (odoo.debug) {
                if (typeof name !== "string") {
                    throw new Error(`Invalid name definition: ${name} (should be a string)"`);
                }
                if (!(deps instanceof Array)) {
                    throw new Error(`Dependencies should be defined by an array: ${deps}`);
                }
                if (typeof factory !== "function") {
                    throw new Error(`Factory should be defined by a function ${factory}`);
                }
            }
            if (!this.factories.has(name)) {
                this.factories.set(name, {
                    name,
                    deps,
                    fn: factory,
                    ignoreMissingDeps: globalThis.__odooIgnoreMissingDependencies,
                });
                this.checkErrorProm ||= Promise.resolve().then(() => {
                    this.checkAndReportErrors();
                    this.checkErrorProm = null;
                });
                if (!this.started) {
                    this.started = true;
                    Promise.resolve().then(() => {
                        this.startModules();
                        this.started = false;
                    });
                }
            }
        }

        // addJob(name) {
        //     // this.jobs.add(name);
        //     this.startModules();
        // }

        // findJob() {
        //     for (const job of this.jobs) {
        //         if (this.factories.get(job).deps.every((dep) => this.modules.has(dep))) {
        //             return job;
        //         }
        //     }
        //     return null;
        // }

        sortModules() {}

        async startModules() {
            // const factories = [...this.factories.values()];
            // window.primaryFactories = factories.filter((factory) => {
            //     return factory.name === "@odoo/owl" || factory.name === "@web/start" || factory.deps.includes("@web/core/registry")
            // });
            // const primaryFactoryNames = primaryFactories.map((f) => f.name);
            // // should iterate until stabilization
            // window.secondaryFactories = factories.filter((factory) => {
            //     return primaryFactoryNames.includes(factory.name) || factory.deps.some((dep) => primaryFactoryNames.includes(dep));
            // })
            // window.lastFactories = factories.filter((factory) => {
            //     return !secondaryFactories.includes(factory);
            // })
            // let sortedFactories = topologicalSort(secondaryFactories, (factory) => {
            //     return factory.deps.map((dep) => this.factories.get(dep));
            // });
            const mainFactory = this.factories.get("@web_enterprise/main");
            this.factories.delete("@web_enterprise/main");
            const factories = [mainFactory, ...this.factories.values()];
            this.factories.set("@web_enterprise/main", mainFactory);
            console.time("topological sort");
            const sortedFactories = topologicalSort(factories, (factory) => {
                return factory.deps.map((dep) => this.factories.get(dep));
            });
            console.timeEnd("topological sort");
            for (const factory of sortedFactories) {
                this.startModule(factory.name);
            }
            // odoo.loader.modules.get("@web/core/network/rpc_service").jsonrpc("/totphook");
            // await new Promise((r) => setTimeout(r));
            // sortedFactories = topologicalSort(lastFactories, (factory) => {
            //     return factory.deps.map((dep) => this.factories.get(dep));
            // });
            // for (const factory of sortedFactories) {
            //     this.startModule(factory.name);
            // }
            // debugger
            // let job;
            // while ((job = this.findJob())) {
            //     this.startModule(job);
            // }
        }

        startModule(name) {
            const require = (name) => this.modules.get(name);
            // this.jobs.delete(name);
            const factory = this.factories.get(name);
            let value = null;
            try {
                value = factory.fn(require);
            } catch (error) {
                this.failed.add(name);
                throw new Error(`Error while loading "${name}":\n${error}`);
            }
            this.modules.set(name, value);
            this.bus.dispatchEvent(
                new CustomEvent("module-started", { detail: { moduleName: name, module: value } })
            );
        }

        findErrors() {
            // cycle detection
            const dependencyGraph = new Map();
            for (const job of this.jobs) {
                dependencyGraph.set(job, this.factories.get(job).deps);
            }
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
                    const jobs = Array.from(visited).concat([job]);
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
                const factory = this.factories.get(job);
                if (factory.ignoreMissingDeps) {
                    continue;
                }
                for (const dep of factory.deps) {
                    if (!this.factories.has(dep)) {
                        missing.add(dep);
                    }
                }
            }

            return {
                failed: [...this.failed],
                cycle: visitJobs(this.jobs),
                missing: [...missing],
                unloaded: [...this.jobs].filter((j) => !this.factories.get(j).ignoreMissingDeps),
            };
        }

        async checkAndReportErrors() {
            const { failed, cycle, missing, unloaded } = this.findErrors();
            if (!failed.length && !unloaded.length) {
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
                        failed
                    )
                );
                alert.appendChild(
                    list(
                        "The following modules could not be loaded because they form a dependency cycle:",
                        cycle && [cycle]
                    )
                );
                alert.appendChild(
                    list(
                        "The following modules are needed by other modules but have not been defined, they may not be present in the correct asset bundle:",
                        missing
                    )
                );
                alert.appendChild(
                    list(
                        "The following modules could not be loaded because they have unmet dependencies, this is a secondary error which is likely caused by one of the above problems:",
                        unloaded
                    )
                );
                document.body.appendChild(container);
            });
        }
    }

    if (!globalThis.odoo) {
        globalThis.odoo = {};
    }
    const odoo = globalThis.odoo;
    if (odoo.debug && !new URLSearchParams(location.search).has("debug")) {
        // remove debug mode if not explicitely set in url
        odoo.debug = "";
    }

    const loader = new ModuleLoader();
    odoo.define = loader.define.bind(loader);

    odoo.loader = loader;
})();
