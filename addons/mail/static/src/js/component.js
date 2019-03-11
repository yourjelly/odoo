odoo.define('mail.Component', function (require) {
    "use strict";

    var patch = require('mail.snabbdom.patch');
    var EventBus = require('mail.EventBus');

    //------------------------------------------------------------------------------
    // Widget
    //------------------------------------------------------------------------------
    class Component extends EventBus {
        //--------------------------------------------------------------------------
        // Lifecycle
        //--------------------------------------------------------------------------
        constructor(parent, props) {
            super();
            this.template = "default";
            this.inlineTemplate = null;
            this.state = {};
            this.refs = {};
            // is this a good idea?
            //   Pro: if props is empty, we can create easily a widget
            //   Con: this is not really safe
            //   Pro: but creating widget (by a template) is always unsafe anyway
            this.props = props;
            let id;
            let p = null;
            if (parent instanceof Component) {
                p = parent;
                this.env = parent.env;
                id = this.env.getID();
                parent.__widget__.children[id] = this;
            }
            else {
                this.env = parent;
                id = this.env.getID();
            }
            this.__widget__ = {
                id: id,
                vnode: null,
                isStarted: false,
                isMounted: false,
                isDestroyed: false,
                parent: p,
                children: {},
                cmap: {},
                renderId: 1,
                renderPromise: null,
                renderProps: props,
                boundHandlers: {}
            };
        }
        get el() {
            return this.__widget__.vnode ? this.__widget__.vnode.elm : null;
        }
        async willStart() { }
        mounted() { }
        shouldUpdate(nextProps) {
            return true;
        }
        willUnmount() { }
        destroyed() { }
        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------
        async mount(target) {
            const vnode = await this._start();
            if (this.__widget__.isDestroyed) {
                // widget was destroyed before we get here...
                return;
            }
            this._patch(vnode);
            target.appendChild(this.el);
            if (document.body.contains(target)) {
                this.visitSubTree(w => {
                    if (!w.__widget__.isMounted && this.el.contains(w.el)) {
                        w.__widget__.isMounted = true;
                        w.mounted();
                        return true;
                    }
                    return false;
                });
            }
        }
        detach() {
            if (this.el) {
                this.visitSubTree(w => {
                    if (w.__widget__.isMounted) {
                        w.willUnmount();
                        w.__widget__.isMounted = false;
                        return true;
                    }
                    return false;
                });
                this.el.remove();
            }
        }
        destroy() {
            if (!this.__widget__.isDestroyed) {
                for (let id in this.__widget__.children) {
                    this.__widget__.children[id].destroy();
                }
                if (this.__widget__.isMounted) {
                    this.willUnmount();
                }
                if (this.el) {
                    this.el.remove();
                    this.__widget__.isMounted = false;
                    delete this.__widget__.vnode;
                }
                if (this.__widget__.parent) {
                    let id = this.__widget__.id;
                    delete this.__widget__.parent.__widget__.children[id];
                    this.__widget__.parent = null;
                }
                this.clear();
                this.__widget__.isDestroyed = true;
                this.destroyed();
            }
        }
        /**
         * This is the safest update method for widget: its job is to update the state
         * and rerender (if widget is mounted).
         *
         * Notes:
         * - it checks if we do not add extra keys to the state.
         * - it is ok to call updateState before the widget is started. In that
         * case, it will simply update the state and will not rerender
         */
        async updateState(nextState) {
            if (Object.keys(nextState).length === 0) {
                return;
            }
            Object.assign(this.state, nextState);
            if (this.__widget__.isStarted) {
                return this.render();
            }
        }
        updateProps(nextProps) {
            const shouldUpdate = this.shouldUpdate(nextProps);
            this.props = nextProps;
            return shouldUpdate ? this.render() : Promise.resolve();
        }
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
        async render() {
            if (this.__widget__.isDestroyed) {
                return;
            }
            const renderVDom = this._render();
            const renderId = this.__widget__.renderId;
            const vnode = await renderVDom;
            if (renderId === this.__widget__.renderId) {
                // we only update the vnode and the actual DOM if no other rendering
                // occurred between now and when the render method was initially called.
                this._patch(vnode);
            }
        }
        _patch(vnode) {
            this.__widget__.renderPromise = null;
            this.__widget__.vnode = patch(this.__widget__.vnode || document.createElement(vnode.sel), vnode);
        }
        async _start() {
            this.__widget__.renderProps = this.props;
            this.__widget__.renderPromise = this.willStart().then(() => {
                if (this.__widget__.isDestroyed) {
                    return Promise.resolve(h_4.default("div"));
                }
                this.__widget__.isStarted = true;
                if (this.inlineTemplate) {
                    this.env.qweb.addTemplate(this.inlineTemplate, this.inlineTemplate, true);
                }
                return this._render();
            });
            return this.__widget__.renderPromise;
        }
        async _render() {
            this.__widget__.renderId++;
            const promises = [];
            const template = this.inlineTemplate || this.template;
            let vnode = this.env.qweb.render(template, this, {
                promises,
                handlers: this.__widget__.boundHandlers
            });
            // this part is critical for the patching process to be done correctly. The
            // tricky part is that a child widget can be rerendered on its own, which
            // will update its own vnode representation without the knowledge of the
            // parent widget.  With this, we make sure that the parent widget will be
            // able to patch itself properly after
            vnode.key = this.__widget__.id;
            this.__widget__.renderProps = this.props;
            this.__widget__.renderPromise = Promise.all(promises).then(() => vnode);
            return this.__widget__.renderPromise;
        }
        /**
         * Only called by qweb t-widget directive
         */
        _mount(vnode, elm) {
            this.__widget__.vnode = patch(elm, vnode);
            this.__mount();
            return this.__widget__.vnode;
        }
        __mount() {
            if (this.__widget__.isMounted) {
                return;
            }
            if (this.__widget__.parent) {
                if (this.__widget__.parent.__widget__.isMounted) {
                    this.__widget__.isMounted = true;
                    this.mounted();
                    const children = this.__widget__.children;
                    for (let id in children) {
                        children[id].__mount();
                    }
                }
            }
        }
        visitSubTree(callback) {
            const shouldVisitChildren = callback(this);
            if (shouldVisitChildren) {
                const children = this.__widget__.children;
                for (let id in children) {
                    children[id].visitSubTree(callback);
                }
            }
        }
    }
    return Component;

});

odoo.define('mail.PureComponent', function (require) {
    "use strict";

    var Component = require('mail.Component');

    class PureComponent extends Component {
        shouldUpdate(nextProps) {
            for (let k in nextProps) {
                if (nextProps[k] !== this.props[k]) {
                    return true;
                }
            }
            return false;
        }
        async updateState(nextState) {
            for (let k in nextState) {
                if (nextState[k] !== this.state[k]) {
                    return super.updateState(nextState);
                }
            }
        }
    }
    return PureComponent;
});


odoo.define('mail.EventBus', function (require) {
    "use strict";
    //------------------------------------------------------------------------------
    // EventBus
    //------------------------------------------------------------------------------
    class EventBus {
        constructor() {
            this.subscriptions = {};
        }
        /**
         * Add a listener for the 'eventType' events.
         *
         * Note that the 'owner' of this event can be anything, but will more likely
         * be a widget or a class. The idea is that the callback will be called with
         * the proper owner bound.
         *
         * Also, the owner should be kind of unique. This will be used to remove the
         * listener.
         */
        on(eventType, owner, callback) {
            if (!callback) {
                throw new Error("Missing callback");
            }
            if (!this.subscriptions[eventType]) {
                this.subscriptions[eventType] = [];
            }
            this.subscriptions[eventType].push({
                owner,
                callback
            });
        }
        /**
         * Remove a listener
         */
        off(eventType, owner) {
            const subs = this.subscriptions[eventType];
            if (subs) {
                this.subscriptions[eventType] = subs.filter(s => s.owner !== owner);
            }
        }
        /**
         * Emit an event of type 'eventType'.  Any extra arguments will be passed to
         * the listeners callback.
         */
        trigger(eventType, ...args) {
            const subs = this.subscriptions[eventType] || [];
            for (let sub of subs) {
                sub.callback.call(sub.owner, ...args);
            }
        }
        /**
         * Remove all subscriptions.
         */
        clear() {
            this.subscriptions = {};
        }
    }

    return EventBus;
});

odoo.define('mail.QWebVDOM', function (require) {
    "use strict";

    const h = require('mail.snabbdom.h');

    const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(",");
    //------------------------------------------------------------------------------
    // Compilation Context
    //------------------------------------------------------------------------------
    class Context {
        constructor() {
            this.nextID = 1;
            this.code = [];
            this.variables = {};
            this.escaping = false;
            this.parentNode = null;
            this.rootNode = null;
            this.indentLevel = 0;
            this.shouldDefineOwner = false;
            this.shouldProtectContext = false;
            this.inLoop = false;
            this.rootContext = this;
            this.addLine("let h = this.utils.h;");
        }
        generateID() {
            const id = this.rootContext.nextID++;
            return id;
        }
        withParent(node) {
            const newContext = Object.create(this);
            if (this === this.rootContext && this.parentNode) {
                throw new Error("A template should not have more than one root node");
            }
            newContext.parentNode = node;
            if (!this.rootContext.rootNode) {
                this.rootContext.rootNode = node;
            }
            return newContext;
        }
        withVariables(variables) {
            const newContext = Object.create(this);
            newContext.variables = Object.create(variables);
            return newContext;
        }
        withInLoop() {
            const newContext = Object.create(this);
            newContext.inLoop = true;
            return newContext;
        }
        withCaller(node) {
            const newContext = Object.create(this);
            newContext.caller = node;
            return newContext;
        }
        withEscaping() {
            const newContext = Object.create(this);
            newContext.escaping = true;
            return newContext;
        }
        indent() {
            this.indentLevel++;
        }
        dedent() {
            this.indentLevel--;
        }
        addLine(line) {
            const prefix = new Array(this.indentLevel + 2).join("    ");
            this.code.push(prefix + line);
        }
        addIf(condition) {
            this.addLine(`if (${condition}) {`);
            this.indent();
        }
        addElse() {
            this.dedent();
            this.addLine("} else {");
            this.indent();
        }
        closeIf() {
            this.dedent();
            this.addLine("}");
        }
        getValue(val) {
            return val in this.variables ? this.getValue(this.variables[val]) : val;
        }
    }
    //------------------------------------------------------------------------------
    // QWeb rendering engine
    //------------------------------------------------------------------------------
    class QWeb {
        constructor() {
            this.processedTemplates = {};
            this.templates = {};
            this.exprCache = {};
            this.directives = [];
            this.utils = {
                h: h,
                getFragment(str) {
                    const temp = document.createElement("template");
                    temp.innerHTML = str;
                    return temp.content;
                }
            };
            [
                forEachDirective,
                escDirective,
                rawDirective,
                setDirective,
                elseDirective,
                elifDirective,
                ifDirective,
                callDirective,
                onDirective,
                refDirective,
                widgetDirective
            ].forEach(d => this.addDirective(d));
        }
        addDirective(dir) {
            this.directives.push(dir);
            this.directives.sort((d1, d2) => d1.priority - d2.priority);
        }
        /**
         * Add a template to the internal template map.  Note that it is not
         * immediately compiled.
         */
        addTemplate(name, template, allowDuplicates = false) {
            if (name in this.processedTemplates) {
                if (allowDuplicates) {
                    return;
                }
                else {
                    throw new Error(`Template ${name} already defined`);
                }
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(template, "text/xml");
            if (!doc.firstChild) {
                throw new Error("Invalid template (should not be empty)");
            }
            if (doc.getElementsByTagName("parsererror").length) {
                throw new Error("Invalid XML in template");
            }
            let elem = doc.firstChild;
            this._processTemplate(elem);
            this.processedTemplates[name] = elem;
        }
        _processTemplate(elem) {
            let tbranch = elem.querySelectorAll("[t-elif], [t-else]");
            for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
                let node = tbranch[i];
                let prevElem = node.previousElementSibling;
                let pattr = function (name) {
                    return prevElem.getAttribute(name);
                };
                let nattr = function (name) {
                    return +!!node.getAttribute(name);
                };
                if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
                    if (pattr("t-foreach")) {
                        throw new Error("t-if cannot stay at the same level as t-foreach when using t-elif or t-else");
                    }
                    if (["t-if", "t-elif", "t-else"].map(nattr).reduce(function (a, b) {
                        return a + b;
                    }) > 1) {
                        throw new Error("Only one conditional branching directive is allowed per node");
                    }
                    // All text nodes between branch nodes are removed
                    let textNode;
                    while ((textNode = node.previousSibling) !== prevElem) {
                        if (textNode.nodeValue.trim().length) {
                            throw new Error("text is not allowed between branching directives");
                        }
                        textNode.remove();
                    }
                }
                else {
                    throw new Error("t-elif and t-else directives must be preceded by a t-if or t-elif directive");
                }
            }
        }
        /**
         * Load templates from a xml (as a string).  This will look up for the first
         * <templates> tag, and will consider each child of this as a template, with
         * the name given by the t-name attribute.
         */
        loadTemplates(xmlstr) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlstr, "text/xml");
            const templates = doc.getElementsByTagName("templates")[0];
            if (!templates) {
                return;
            }
            for (let elem of templates.children) {
                const name = elem.getAttribute("t-name");
                this._processTemplate(elem);
                this.processedTemplates[name] = elem;
            }
        }
        /**
         * Render a template
         *
         * @param {string} name the template should already have been added
         */
        render(name, context = {}, extra = null) {
            if (!(name in this.processedTemplates)) {
                throw new Error(`Template ${name} does not exist`);
            }
            const template = this.templates[name] || this._compile(name);
            return template.call(this, context, extra);
        }
        _compile(name) {
            if (name in this.templates) {
                return this.templates[name];
            }
            const mainNode = this.processedTemplates[name];
            const isDebug = mainNode.attributes.hasOwnProperty("t-debug");
            const ctx = new Context();
            this._compileNode(mainNode, ctx);
            if (ctx.shouldProtectContext) {
                ctx.code.unshift("    context = Object.create(context);");
            }
            if (ctx.shouldDefineOwner) {
                // this is necessary to prevent some directives (t-forach for ex) to
                // pollute the rendering context by adding some keys in it.
                ctx.code.unshift("    let owner = context;");
            }
            if (!ctx.rootNode) {
                throw new Error("A template should have one root node");
            }
            ctx.addLine(`return vn${ctx.rootNode};`);
            if (isDebug) {
                ctx.code.unshift("    debugger");
            }
            let template;
            try {
                template = new Function("context", "extra", ctx.code.join("\n"));
            }
            catch (e) {
                throw new Error(`Invalid template (or compiled code): ${e.message}`);
            }
            if (isDebug) {
                console.log(`Template: ${this.processedTemplates[name].outerHTML}\nCompiled code:\n` + template.toString());
            }
            this.templates[name] = template;
            return template;
        }
        /**
         * Generate code from an xml node
         *
         */
        _compileNode(node, ctx) {
            if (!(node instanceof Element)) {
                // this is a text node, there are no directive to apply
                let text = node.textContent;
                if (ctx.parentNode) {
                    ctx.addLine(`c${ctx.parentNode}.push({text: \`${text}\`});`);
                }
                else {
                    // this is an unusual situation: this text node is the result of the
                    // template rendering.
                    let nodeID = ctx.generateID();
                    ctx.addLine(`let vn${nodeID} = {text: \`${text}\`};`);
                    ctx.rootContext.rootNode = nodeID;
                    ctx.rootContext.parentNode = nodeID;
                }
                return;
            }
            const attributes = node.attributes;
            const validDirectives = [];
            for (let directive of this.directives) {
                // const value = attributes[i].textContent!;
                let fullName;
                let value;
                for (let i = 0; i < attributes.length; i++) {
                    const name = attributes[i].name;
                    if (name === "t-" + directive.name ||
                        name.startsWith("t-" + directive.name + "-")) {
                        fullName = name;
                        value = attributes[i].textContent;
                    }
                }
                if (fullName) {
                    validDirectives.push({ directive, value, fullName });
                }
            }
            for (let { directive, value, fullName } of validDirectives) {
                if (directive.atNodeEncounter) {
                    const isDone = directive.atNodeEncounter({
                        node,
                        qweb: this,
                        ctx,
                        fullName,
                        value
                    });
                    if (isDone) {
                        return;
                    }
                }
            }
            if (node.nodeName !== "t") {
                let nodeID = this._compileGenericNode(node, ctx);
                ctx = ctx.withParent(nodeID);
                for (let { directive, value, fullName } of validDirectives) {
                    if (directive.atNodeCreation) {
                        directive.atNodeCreation({
                            node,
                            qweb: this,
                            ctx,
                            fullName,
                            value,
                            nodeID
                        });
                    }
                }
            }
            this._compileChildren(node, ctx);
            for (let { directive, value, fullName } of validDirectives) {
                if (directive.finalize) {
                    directive.finalize({ node, qweb: this, ctx, fullName, value });
                }
            }
        }
        _compileGenericNode(node, ctx) {
            // nodeType 1 is generic tag
            if (node.nodeType !== 1) {
                throw new Error("unsupported node type");
            }
            const attributes = node.attributes;
            const attrs = [];
            const tattrs = [];
            for (let i = 0; i < attributes.length; i++) {
                let name = attributes[i].name;
                const value = attributes[i].textContent;
                // regular attributes
                if (!name.startsWith("t-")) {
                    const attID = ctx.generateID();
                    ctx.addLine(`let _${attID} = '${value}';`);
                    if (!name.match(/^[a-zA-Z]+$/)) {
                        // attribute contains 'non letters' => we want to quote it
                        name = '"' + name + '"';
                    }
                    attrs.push(`${name}: _${attID}`);
                }
                // dynamic attributes
                if (name.startsWith("t-att-")) {
                    let attName = name.slice(6);
                    let formattedValue = this._formatExpression(ctx.getValue(value));
                    const attID = ctx.generateID();
                    if (!attName.match(/^[a-zA-Z]+$/)) {
                        // attribute contains 'non letters' => we want to quote it
                        attName = '"' + attName + '"';
                    }
                    // we need to combine dynamic with non dynamic attributes:
                    // class="a" t-att-class="'yop'" should be rendered as class="a yop"
                    const attValue = node.getAttribute(attName);
                    if (attValue) {
                        const attValueID = ctx.generateID();
                        ctx.addLine(`let _${attValueID} = ${formattedValue};`);
                        formattedValue = `'${attValue}' + (_${attValueID} ? ' ' + _${attValueID} : '')`;
                    }
                    ctx.addLine(`let _${attID} = ${formattedValue};`);
                    attrs.push(`${attName}: _${attID}`);
                }
                if (name.startsWith("t-attf-")) {
                    let attName = name.slice(7);
                    if (!attName.match(/^[a-zA-Z]+$/)) {
                        // attribute contains 'non letters' => we want to quote it
                        attName = '"' + attName + '"';
                    }
                    const formattedExpr = value.replace(/\{\{.*?\}\}/g, s => "${" + this._formatExpression(s.slice(2, -2)) + "}");
                    const attID = ctx.generateID();
                    ctx.addLine(`let _${attID} = \`${formattedExpr}\`;`);
                    attrs.push(`${attName}: _${attID}`);
                }
                // t-att= attributes
                if (name === "t-att") {
                    let id = ctx.generateID();
                    ctx.addLine(`let _${id} = ${this._formatExpression(value)};`);
                    tattrs.push(id);
                }
            }
            let nodeID = ctx.generateID();
            let p = attrs.length + tattrs.length > 0
                ? `{key:${nodeID},attrs:{${attrs.join(",")}}}`
                : `{key:${nodeID}}`;
            ctx.addLine(`let c${nodeID} = [], p${nodeID} = ${p};`);
            for (let id of tattrs) {
                ctx.addIf(`_${id} instanceof Array`);
                ctx.addLine(`p${nodeID}.attrs[_${id}[0]] = _${id}[1];`);
                ctx.addElse();
                ctx.addLine(`for (let key in _${id}) {`);
                ctx.indent();
                ctx.addLine(`p${nodeID}.attrs[key] = _${id}[key];`);
                ctx.dedent();
                ctx.addLine(`}`);
                ctx.closeIf();
            }
            ctx.addLine(`let vn${nodeID} = h('${node.nodeName}', p${nodeID}, c${nodeID});`);
            if (ctx.parentNode) {
                ctx.addLine(`c${ctx.parentNode}.push(vn${nodeID});`);
            }
            return nodeID;
        }
        _compileChildren(node, ctx) {
            if (node.childNodes.length > 0) {
                for (let child of Array.from(node.childNodes)) {
                    this._compileNode(child, ctx);
                }
            }
        }
        _formatExpression(e) {
            if (e in this.exprCache) {
                return this.exprCache[e];
            }
            // Thanks CHM for this code...
            const chars = e.split("");
            let instring = "";
            let invar = "";
            let invarPos = 0;
            let r = "";
            chars.push(" ");
            for (var i = 0, ilen = chars.length; i < ilen; i++) {
                var c = chars[i];
                if (instring.length) {
                    if (c === instring && chars[i - 1] !== "\\") {
                        instring = "";
                    }
                }
                else if (c === '"' || c === "'") {
                    instring = c;
                }
                else if (c.match(/[a-zA-Z_\$]/) && !invar.length) {
                    invar = c;
                    invarPos = i;
                    continue;
                }
                else if (c.match(/\W/) && invar.length) {
                    // TODO: Should check for possible spaces before dot
                    if (chars[invarPos - 1] !== "." && RESERVED_WORDS.indexOf(invar) < 0) {
                        invar = "context['" + invar + "']";
                    }
                    r += invar;
                    invar = "";
                }
                else if (invar.length) {
                    invar += c;
                    continue;
                }
                r += c;
            }
            const result = r.slice(0, -1);
            this.exprCache[e] = result;
            return result;
        }
    }

    function compileValueNode(value, node, qweb, ctx) {
        if (value === "0" && ctx.caller) {
            qweb._compileNode(ctx.caller, ctx);
            return;
        }
        if (typeof value === "string") {
            const exprID = ctx.generateID();
            ctx.addLine(`let e${exprID} = ${qweb._formatExpression(value)};`);
            ctx.addIf(`e${exprID} || e${exprID} === 0`);
            let text = `e${exprID}`;
            if (!ctx.parentNode) {
                throw new Error("Should not have a text node without a parent");
            }
            if (ctx.escaping) {
                ctx.addLine(`c${ctx.parentNode}.push({text: ${text}});`);
            }
            else {
                let fragID = ctx.generateID();
                ctx.addLine(`let frag${fragID} = this.utils.getFragment(e${exprID})`);
                let tempNodeID = ctx.generateID();
                ctx.addLine(`let p${tempNodeID} = {hook: {`);
                ctx.addLine(`  insert: n => n.elm.parentNode.replaceChild(frag${fragID}, n.elm),`);
                ctx.addLine(`}};`);
                ctx.addLine(`let vn${tempNodeID} = h('div', p${tempNodeID})`);
                ctx.addLine(`c${ctx.parentNode}.push(vn${tempNodeID});`);
            }
            if (node.childNodes.length) {
                ctx.addElse();
                qweb._compileChildren(node, ctx);
            }
            ctx.closeIf();
            return;
        }
        if (value instanceof NodeList) {
            for (let node of Array.from(value)) {
                qweb._compileNode(node, ctx);
            }
        }
    }
    const escDirective = {
        name: "esc",
        priority: 70,
        atNodeEncounter({ node, qweb, ctx }) {
            if (node.nodeName !== "t") {
                let nodeID = qweb._compileGenericNode(node, ctx);
                ctx = ctx.withParent(nodeID);
            }
            let value = ctx.getValue(node.getAttribute("t-esc"));
            compileValueNode(value, node, qweb, ctx.withEscaping());
            return true;
        }
    };
    const rawDirective = {
        name: "raw",
        priority: 80,
        atNodeEncounter({ node, qweb, ctx }) {
            if (node.nodeName !== "t") {
                let nodeID = qweb._compileGenericNode(node, ctx);
                ctx = ctx.withParent(nodeID);
            }
            let value = ctx.getValue(node.getAttribute("t-raw"));
            compileValueNode(value, node, qweb, ctx);
            return true;
        }
    };
    const setDirective = {
        name: "set",
        priority: 60,
        atNodeEncounter({ node, ctx }) {
            const variable = node.getAttribute("t-set");
            let value = node.getAttribute("t-value");
            if (value) {
                ctx.variables[variable] = value;
            }
            else {
                ctx.variables[variable] = node.childNodes;
            }
            return true;
        }
    };
    const ifDirective = {
        name: "if",
        priority: 20,
        atNodeEncounter({ node, qweb, ctx }) {
            let cond = ctx.getValue(node.getAttribute("t-if"));
            ctx.addIf(`${qweb._formatExpression(cond)}`);
            return false;
        },
        finalize({ ctx }) {
            ctx.closeIf();
        }
    };
    const elifDirective = {
        name: "elif",
        priority: 30,
        atNodeEncounter({ node, qweb, ctx }) {
            let cond = ctx.getValue(node.getAttribute("t-elif"));
            ctx.addLine(`else if (${qweb._formatExpression(cond)}) {`);
            ctx.indent();
            return false;
        },
        finalize({ ctx }) {
            ctx.closeIf();
        }
    };
    const elseDirective = {
        name: "else",
        priority: 40,
        atNodeEncounter({ ctx }) {
            ctx.addLine(`else {`);
            ctx.indent();
            return false;
        },
        finalize({ ctx }) {
            ctx.closeIf();
        }
    };
    const callDirective = {
        name: "call",
        priority: 50,
        atNodeEncounter({ node, qweb, ctx }) {
            if (node.nodeName !== "t") {
                throw new Error("Invalid tag for t-call directive (should be 't')");
            }
            const subTemplate = node.getAttribute("t-call");
            const nodeTemplate = qweb.processedTemplates[subTemplate];
            if (!nodeTemplate) {
                throw new Error(`Cannot find template "${subTemplate}" (t-call)`);
            }
            const nodeCopy = node.cloneNode(true);
            nodeCopy.removeAttribute("t-call");
            // extract variables from nodecopy
            const tempCtx = new Context();
            qweb._compileNode(nodeCopy, tempCtx);
            const vars = Object.assign({}, ctx.variables, tempCtx.variables);
            const subCtx = ctx.withCaller(nodeCopy).withVariables(vars);
            qweb._compileNode(nodeTemplate, subCtx);
            return true;
        }
    };
    const forEachDirective = {
        name: "foreach",
        priority: 10,
        atNodeEncounter({ node, qweb, ctx }) {
            ctx.rootContext.shouldProtectContext = true;
            ctx = ctx.withInLoop();
            const elems = node.getAttribute("t-foreach");
            const name = node.getAttribute("t-as");
            let arrayID = ctx.generateID();
            ctx.addLine(`let _${arrayID} = ${qweb._formatExpression(elems)};`);
            ctx.addLine(`if (!_${arrayID}) { throw new Error('QWeb error: Invalid loop expression')}`);
            ctx.addLine(`if (typeof _${arrayID} === 'number') { _${arrayID} = Array.from(Array(_${arrayID}).keys())}`);
            let keysID = ctx.generateID();
            ctx.addLine(`let _${keysID} = _${arrayID} instanceof Array ? _${arrayID} : Object.keys(_${arrayID});`);
            let valuesID = ctx.generateID();
            ctx.addLine(`let _${valuesID} = _${arrayID} instanceof Array ? _${arrayID} : Object.values(_${arrayID});`);
            ctx.addLine(`for (let i = 0; i < _${keysID}.length; i++) {`);
            ctx.indent();
            ctx.addLine(`context.${name}_first = i === 0;`);
            ctx.addLine(`context.${name}_last = i === _${keysID}.length - 1;`);
            ctx.addLine(`context.${name}_parity = i % 2 === 0 ? 'even' : 'odd';`);
            ctx.addLine(`context.${name}_index = i;`);
            ctx.addLine(`context.${name} = _${keysID}[i];`);
            ctx.addLine(`context.${name}_value = _${valuesID}[i];`);
            const nodeCopy = node.cloneNode(true);
            nodeCopy.removeAttribute("t-foreach");
            qweb._compileNode(nodeCopy, ctx);
            ctx.dedent();
            ctx.addLine("}");
            return true;
        }
    };
    const onDirective = {
        name: "on",
        priority: 90,
        atNodeCreation({ ctx, fullName, value, nodeID, qweb }) {
            ctx.rootContext.shouldDefineOwner = true;
            const eventName = fullName.slice(5);
            let extraArgs;
            let handler = value.replace(/\(.*\)/, function (args) {
                extraArgs = args.slice(1, -1);
                return "";
            });
            if (extraArgs) {
                ctx.addLine(`p${nodeID}.on = {${eventName}: context['${handler}'].bind(owner, ${qweb._formatExpression(extraArgs)})};`);
            }
            else {
                ctx.addLine(`extra.handlers[${nodeID}] = extra.handlers[${nodeID}] || context['${handler}'].bind(owner);`);
                ctx.addLine(`p${nodeID}.on = {${eventName}: extra.handlers[${nodeID}]};`);
            }
        }
    };
    const refDirective = {
        name: "ref",
        priority: 95,
        atNodeCreation({ ctx, node, nodeID }) {
            let ref = node.getAttribute("t-ref");
            ctx.addLine(`p${ctx.parentNode}.hook = {
            create: (_, n) => context.refs['${ref}'] = n.elm,
        };`);
        }
    };
    const widgetDirective = {
        name: "widget",
        priority: 100,
        atNodeEncounter({ ctx, value, node, qweb }) {
            ctx.addLine("//WIDGET");
            ctx.rootContext.shouldDefineOwner = true;
            let props = node.getAttribute("t-props");
            let keepAlive = node.getAttribute("t-keep-alive") ? true : false;
            // t-on- events...
            const events = [];
            const attributes = node.attributes;
            for (let i = 0; i < attributes.length; i++) {
                const name = attributes[i].name;
                if (name.startsWith("t-on-")) {
                    events.push([name.slice(5), attributes[i].textContent]);
                }
            }
            let key = node.getAttribute("t-key");
            if (key) {
                key = qweb._formatExpression(key);
            }
            if (props) {
                props = props.trim();
                if (props[0] === "{" && props[props.length - 1] === "}") {
                    const innerProp = props
                        .slice(1, -1)
                        .split(",")
                        .map(p => {
                        let [key, val] = p.split(":");
                        return `${key}: ${qweb._formatExpression(val)}`;
                    })
                        .join(",");
                    props = "{" + innerProp + "}";
                }
                else {
                    props = qweb._formatExpression(props);
                }
            }
            let dummyID = ctx.generateID();
            let defID = ctx.generateID();
            let widgetID = ctx.generateID();
            let keyID = key && ctx.generateID();
            if (key) {
                // we bind a variable to the key (could be a complex expression, so we
                // want to evaluate it only once)
                ctx.addLine(`let key${keyID} = ${key};`);
            }
            ctx.addLine(`let _${dummyID}_index = c${ctx.parentNode}.length;`);
            ctx.addLine(`c${ctx.parentNode}.push(null);`);
            ctx.addLine(`let def${defID};`);
            let templateID = key
                ? `key${keyID}`
                : ctx.inLoop
                    ? `String(-${widgetID} - i)`
                    : String(widgetID);
            ctx.addLine(`let w${widgetID} = ${templateID} in context.__widget__.cmap ? context.__widget__.children[context.__widget__.cmap[${templateID}]] : false;`);
            ctx.addLine(`let props${widgetID} = ${props};`);
            ctx.addLine(`let isNew${widgetID} = !w${widgetID};`);
            // check if we can reuse current rendering promise
            ctx.addIf(`w${widgetID} && w${widgetID}.__widget__.renderPromise`);
            ctx.addIf(`w${widgetID}.__widget__.isStarted`);
            ctx.addIf(`props${widgetID} === w${widgetID}.__widget__.renderProps`);
            ctx.addLine(`def${defID} = w${widgetID}.__widget__.renderPromise;`);
            ctx.addElse();
            ctx.addLine(`def${defID} = w${widgetID}.updateProps(props${widgetID});`);
            ctx.closeIf();
            ctx.addElse();
            ctx.addLine(`isNew${widgetID} = true`);
            ctx.addIf(`props${widgetID} === w${widgetID}.__widget__.renderProps`);
            ctx.addLine(`def${defID} = w${widgetID}.__widget__.renderPromise;`);
            ctx.addElse();
            ctx.addLine(`w${widgetID}.destroy();`);
            ctx.addLine(`w${widgetID} = false`);
            ctx.closeIf();
            ctx.closeIf();
            ctx.closeIf();
            ctx.addIf(`!def${defID}`);
            ctx.addIf(`w${widgetID}`);
            ctx.addLine(`def${defID} = w${widgetID}.updateProps(props${widgetID});`);
            ctx.addElse();
            ctx.addLine(`w${widgetID} = new context.widgets['${value}'](owner, props${widgetID});`);
            ctx.addLine(`context.__widget__.cmap[${templateID}] = w${widgetID}.__widget__.id;`);
            for (let [event, method] of events) {
                ctx.addLine(`w${widgetID}.on('${event}', owner, owner['${method}'])`);
            }
            let ref = node.getAttribute("t-ref");
            if (ref) {
                ctx.addLine(`context.refs['${ref}'] = w${widgetID};`);
            }
            ctx.addLine(`def${defID} = w${widgetID}._start();`);
            ctx.closeIf();
            ctx.closeIf();
            ctx.addIf(`isNew${widgetID}`);
            ctx.addLine(`def${defID} = def${defID}.then(vnode=>{let pvnode=h(vnode.sel, {key: ${templateID}});c${ctx.parentNode}[_${dummyID}_index]=pvnode;pvnode.data.hook = {insert(vn){let nvn=w${widgetID}._mount(vnode, vn.elm);pvnode.elm=nvn.elm},remove(){w${widgetID}.${keepAlive ? "detach" : "destroy"}()}}; w${widgetID}.__widget__.pvnode = pvnode;});`);
            ctx.addElse();
            ctx.addLine(`def${defID} = def${defID}.then(()=>{if (w${widgetID}.__widget__.isDestroyed) {return};let vnode;if (!w${widgetID}.__widget__.vnode){vnode=w${widgetID}.__widget__.pvnode} else { vnode=h(w${widgetID}.__widget__.vnode.sel, {key: ${templateID}});vnode.elm=w${widgetID}.el;vnode.data.hook = {insert(a){a.elm.parentNode.replaceChild(w${widgetID}.el,a.elm);a.elm=w${widgetID}.el;w${widgetID}.__mount();},remove(){w${widgetID}.${keepAlive ? "detach" : "destroy"}()}}}c${ctx.parentNode}[_${dummyID}_index]=vnode;});`);
            ctx.closeIf();
            ctx.addLine(`extra.promises.push(def${defID});`);
            if (node.getAttribute("t-if")) {
                ctx.closeIf();
            }
            return true;
        }
    };

    return QWeb;
});