/**
 * This is a mini framework designed to make it easy to describe the dynamic
 * content of a "interaction".
 */

let owl = null;
let Markup = null;

export class Colibri {
    constructor(app, I, el, env) {
        this.app = app;
        this.update = null;
        this.handlers = [];
        this.cleanups = [];
        this.classMap = new Map();
        this.startProm = null;
        const interaction = new I(el, env, this);
        this.interaction = interaction;
        interaction.setup();
        this.startProm = (interaction.willStart() || Promise.resolve()).then(() => {
            if (interaction.isDestroyed) {
                return;
            }
            const content = I.dynamicContent;
            if (content) {
                this.processContent(content);
            }
            interaction.start();
        });
    }

    scheduleUpdate() {
        this.app.schedule(this);
    }

    addDomListener(nodes, event, fn, options) {
        const handler = ev => {
            fn.call(this.interaction, ev);
            this.scheduleUpdate();
        }
        for (let node of nodes) {
            node.addEventListener(event, handler, options);
            this.handlers.push([node, event, handler, options])
        }
    }

    applyTOut(el, value) {
        if (!Markup) {
            owl = odoo.loader.modules.get("@odoo/owl");
            if (owl) {
                Markup = owl.markup("").constructor;
            }
        }
        if (Markup && value instanceof Markup) {
            el.innerHTML = value;
        } else {
            el.textContent = value;
        }
        return this.markup;
    }

    applyAttr(el, attr, value) {
        if (attr === "class") {
            const before = this.classMap.get(el) || new Set();
            const after = new Set(value.trim().split(" "));
            // add new class
            for (let cl of after) {
                if (!before.has(cl)) {
                    el.classList.add(cl);
                }
            }
            // remove old class
            for (let cl of before) {
                if (!after.has(cl)) {
                    el.classList.remove(cl);
                }
            }
            this.classMap.set(el, after);
        } else {
            el.setAttribute(attr, value);
        }
    }

    processContent(content) {
        const fn = this.app.compile(content);
        const update = fn(this, this.interaction);
        this.update = update.bind(this.interaction);
        update.call(this.interaction);
    }

    destroy() {
        for (let cleanup of this.cleanups.reverse()) {
            cleanup();
        }
        this.cleanups = [];
        for (let [el, ev, fn, options] of this.handlers) {
            el.removeEventListener(ev, fn, options);
        }
        this.handlers = [];
        this.classMap.clear();
        this.interaction.destroy();
        this.interaction.isDestroyed = true;
    }
}

const GLOBALS = {
    _root: "root",
    _body: "document.body",
    _window: "window",
    _document: "document",
}
export class ColibriApp {
    compiledFns = new Map();
    frame = null;
    queue = new Set(); // interactions to update next frame

    constructor(env) {
        this.env = env;
    }

    attachTo(el, I) {
        const colibri = new Colibri(this, I, el, this.env);
        return colibri;
    }


    compile(content) {
        let fn;
        if (!this.compiledFns.has(content)) {
            fn = this._compile(content);
            this.compiledFns.set(content, fn);
        } else {
            fn = this.compiledFns.get(content);
        }
        return fn;
    }

    _compile(content) {
        let nextId = 1;
        let selectors = {}; // sel => variable name
        let attrs = [],
            handlers = [],
            tOuts = [];
        // preprocess content
        for (let [sel, directive, value] of generateEntries(content)) {
            if (!(sel in selectors)) {
                if (!(sel in GLOBALS)) {
                    selectors[sel] = `nodes_${nextId++}`;
                }
            }
            if (directive.startsWith("t-att-")) {
                attrs.push([sel, directive.slice(6), value]);
            } else if (directive.startsWith("t-on-")) {
                handlers.push([sel, directive.slice(5), value]);
            } else if (directive === "t-out") {
                tOuts.push([sel, value]);
            } else {
                const suffix = directive.startsWith("t-") ? "" : " (should start with t-)"
                throw new Error(`Invalid directive: '${directive}'${suffix}`);
            }
        }
        // generate function code
        let fnStr = "    const root = interaction.el;\n";
        let indent = 1;
        const addLine = (txt) =>
            (fnStr += new Array(indent + 2).join("  ") + txt);
        const applyToSelector = (sel, fn) => {
            if (sel in GLOBALS) {
                const target = GLOBALS[sel];
                addLine(`${fn(target)};\n`);
            } else {
                addLine(`for (let node of ${selectors[sel]}) {\n`);
                addLine(`  ${fn("node")}\n`);
                addLine("}\n");
            }
        };
        // nodes
        for (let sel in selectors) {
            addLine(
                `const ${selectors[sel]} = root.querySelectorAll(\`${sel}\`);\n`,
            );
        }

        // start function
        fnStr += "\n";
        for (let [sel, event, expr] of handlers) {
            const nodes = sel in GLOBALS ? `[${GLOBALS[sel]}]` : selectors[sel];
            addLine(`framework.addDomListener(${nodes}, \`${event}\`, interaction[\`${expr}\`]);`)
        }

        // update function
        fnStr += "\n";
        addLine("function update() {\n");
        indent++;
        for (let [sel, attr, expr] of attrs) {
            const varName = `value_${nextId++}`;
            addLine(`const ${varName} = ${expr};\n`);
            applyToSelector(
                sel,
                (el) => `framework.applyAttr(${el}, \`${attr}\`, ${varName});`,
            );
        }
        for (let [sel, expr] of tOuts) {
            const varName = `value_${nextId++}`;
            addLine(`const ${varName} = ${expr};\n`);
            applyToSelector(
                sel,
                (el) => `framework.applyTOut(${el}, ${varName});`,
            );
        }
        indent--;
        addLine("}\n");

        addLine("return update;");
        // console.log(fnStr);
        const fn = new Function("framework", "interaction", fnStr);
        // console.log(fn.toString());
        return fn;
    }



    schedule(colibri) {
        this.queue.add(colibri);
        if (!this.frame) {
            this.frame = requestAnimationFrame(() => {
                this.flush();
                this.frame = null;
            });
        }
    }

    flush() {
        for (let colibri of this.queue) {
            if (!colibri.interaction.isDestroyed) {
                colibri.update();
            }
        }
        this.queue.clear();
    }
}

function* generateEntries(content) {
    for (let key in content) {
        const value = content[key];
        if (typeof value === "string") {
            const [selector, directive] = key.split(":");
            yield [selector, directive, value];
        } else {
            for (let directive in value) {
                yield [key, directive, value[directive]];
            }
        }
    }
}
