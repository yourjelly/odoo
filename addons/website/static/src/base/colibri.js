/**
 * This is a mini framework designed to make it easy to describe the dynamic
 * content of a "interaction".
 */

let owl = null;
let Markup = null;

export class Colibri {
    compiledFns = new Map();
    frame = null;
    queue = new Set(); // interactions to update next frame

    constructor(env) {
        this.env = env;
    }

    attach(el, I) {
        const interaction = new I(el, this.env, this);
        // patch destroy to cleanup colibri stuff
        const destroy = interaction.destroy;
        interaction.destroy = function () {
            if (!this.isDestroyed) {
                this.__colibri__.cleanup?.();
                for (let [el, ev, fn, options] of this.__colibri__.handlers) {
                    el.removeEventListener(ev, fn, options);
                }
                this.isDestroyed = true;
                destroy.call(this);
            }
        };
        return interaction;
    }

    applyContent(interaction, content) {
        let fn;
        if (!this.compiledFns.has(content)) {
            fn = this.compile(content);
            this.compiledFns.set(content, fn);
        } else {
            fn = this.compiledFns.get(content);
        }
        const { start, cleanup, update } = fn(this, interaction);
        interaction.__colibri__.update = update.bind(interaction);
        interaction.__colibri__.cleanup = cleanup;
        update.call(interaction);
        start.call(interaction);
    }

    compile(content) {
        let nextId = 1;
        let selectors = {}; // sel => variable name
        let attrs = [],
            handlers = [],
            tOuts = [];
        let cleanups = [];
        // preprocess content
        for (let [sel, directive, value] of generateEntries(content)) {
            if (!(sel in selectors)) {
                if (sel !== "_root" && sel !== "_body") {
                    selectors[sel] = `nodes_${nextId++}`;
                }
            }
            if (directive.startsWith("t-att-")) {
                attrs.push([sel, directive.slice(6), value]);
            }
            if (directive.startsWith("t-on-")) {
                handlers.push([sel, directive.slice(5), value]);
            }
            if (directive === "t-out") {
                tOuts.push([sel, value]);
            }
        }
        // generate function code
        let fnStr = "    const root = interaction.el;\n";
        let indent = 1;
        const addLine = (txt) =>
            (fnStr += new Array(indent + 2).join("  ") + txt);
        const applyToSelector = (sel, fn) => {
            if (sel === "_root" || sel === "_body") {
                addLine(`${fn(sel.slice(1))};\n`);
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
        // handlers
        for (let handler of handlers) {
            const [sel, event, expr] = handler;
            const varName = `fn_${nextId++}`;
            addLine(
                `const ${varName} = function (ev) {this[\`${expr}\`](ev);framework.schedule(this);}.bind(interaction);\n`,
            );
            cleanups.push([sel, event, varName]);
            handler[2] = varName;
        }

        // start function
        fnStr += "\n";
        addLine("function start() {\n");
        indent++;
        for (let [sel, event, varName] of handlers) {
            applyToSelector(
                sel,
                (el) => `${el}.addEventListener(\`${event}\`, ${varName})`,
            );
        }
        indent--;
        addLine("}\n");

        // update function
        fnStr += "\n";
        addLine("function update() {\n");
        indent++;
        for (let [sel, attr, expr] of attrs) {
            const varName = `value_${nextId++}`;
            addLine(`const ${varName} = ${expr};\n`);
            applyToSelector(
                sel,
                (el) => `${el}.setAttribute(\`${attr}\`, ${varName});`,
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

        // cleanup function
        fnStr += "\n";
        addLine("function cleanup() {\n");
        indent++;
        for (let [sel, event, varName] of cleanups) {
            applyToSelector(
                sel,
                (el) => `${el}.removeEventListener(\`${event}\`, ${varName});`,
            );
        }
        indent--;
        addLine("}\n");

        addLine("return { start, update, cleanup };");
        const fn = new Function("framework", "interaction", fnStr);
        console.log(fn.toString());
        return fn;
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
    schedule(interaction) {
        this.queue.add(interaction);
        if (!this.frame) {
            this.frame = requestAnimationFrame(() => {
                this.flush();
                this.frame = null;
            });
        }
    }

    flush() {
        for (let interaction of this.queue) {
            if (!interaction.isDestroyed) {
                interaction.__colibri__.update();
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
