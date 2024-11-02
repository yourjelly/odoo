/**
 * This is the base class to describe interactions. It contains a few helper
 * to accomplish common tasks, such as adding dom listener or waiting for 
 * some task to complete
 */
export class Interaction {
    static selector = "";

    constructor(el, env, colibri) {
        this.__colibri__ = { colibri, cleanup: null, update: null, handlers: [] };
        this.isDestroyed = false;
        this.el = el;
        this.env = env;
        this.services = env.services;
        this.setup();
        const content = this.constructor.dynamicContent;
        if (content) {
            colibri.applyContent(this, content);
        }
    }

    setup() {}

    waitFor(fn) {
        return new Promise(async (resolve) => {
            const result = await fn();
            if (!this.isDestroyed) {
                resolve(result);
                this.updateDOM();
            }
        });
    }

    updateDOM() {
        this.__colibri__.colibri.schedule(this);
    }

    addDomListener(target, event, fn, options) {
        const handler = ev => {
            fn.call(this,ev);
            this.updateDOM();
        }
        const addListener = el => {
            el.addEventListener(event, handler, options);
            this.__colibri__.handlers.push([el, event, handler, options]);
        }
        if (typeof target === "string") {
            const nodes = this.el.querySelectorAll(target);
            for (let node of nodes) {
                addListener(node)
;            }
        } else {
            addListener(target);
        }

    }



    destroy() {}
}
