/** @odoo-module **/
import { registry } from "../../core/registry";
import { Domain } from "@web/core/domain";
import { useService } from "@web/core/service_hook";
import { makeContext } from "@web/core/context";

const { Component } = owl;
const { useSubEnv, useState } = owl.hooks;

const fieldRegistry = registry.category("fields");

export class Field extends Component {
    static template = owl.tags.xml`
        <t t-component="component" t-props="props" />`;

    setup() {
        let type = this.props.type;
        if (!type) {
            let fields = this.env.model.fields;
            type = fields[this.props.name].type;
        }
        this.component = fieldRegistry.get(type, FieldChar);
    }
}

class FieldChar extends Component {
    static template = owl.tags.xml`
        <t t-if="props.mode === 'readonly'">
            <span class="o-field"><t t-esc="data"/></span>
        </t>`;

    setup() {
        this.record = this.props.record;
        this.data = this.record.data[this.props.name];
    }
}

fieldRegistry.add("char", FieldChar);

class FieldMany2one extends Component {
    static template = owl.tags.xml`
        <t t-if="props.mode === 'readonly'">
            <span class="o-field"><t t-esc="data"/></span>
        </t>`;

    setup() {
        const data = this.props.record.data[this.props.name];
        this.data = data ? data[1] : "";
    }
}

fieldRegistry.add("many2one", FieldMany2one);

export class FormCompiler {
    constructor(qweb) {
        this.qweb = qweb;
        const parser = new DOMParser();
        this.document = parser.parseFromString("<templates />", "text/xml");
        this.id = 0;
    }

    appendChild(parent, node) {
        if (node) {
            parent.appendChild(node);
        }
    }

    getModifiers(node) {
        const modifiers = node.getAttribute("modifiers");
        if (!modifiers) {
            return null;
        }
        const parsed = JSON.parse(modifiers);
        return parsed;
    }

    getInvisible(node) {
        if (node.getAttribute("invisible")) {
            return true;
        }
        const modifiers = this.getModifiers(node);
        if (!modifiers) {
            return false;
        }
        if (modifiers.invisible && !Array.isArray(modifiers.invisible)) {
            return true;
        }
        return modifiers.invisible;
    }

    applyInvisible(invisible, transformed) {
        if (!invisible) {
            return transformed;
        }
        if (typeof invisible === "boolean") {
            return;
        }
        transformed.setAttribute("t-if", `!evalDomain(${JSON.stringify(invisible)})`);
        return transformed;
    }

    compile(xmlNode) {
        const newRoot = this.document.createElement("t");
        const child = this.compileNode(xmlNode);
        newRoot.appendChild(child);
        return newRoot;
    }

    compileNode(node, params = {}) {
        if (!(node instanceof Element)) {
            return this.document.createTextNode(node.textContent);
        }
        const tag = node.tagName.charAt(0).toUpperCase() + node.tagName.substring(1);
        const compiler = this[`compile${tag}`];
        if (compiler) {
            return compiler.call(this, node, params);
        }
        return node;
    }

    compileForm(node, params) {
        const form = this.document.createElement("div");
        form.setAttribute(`class`, "o_form_view");
        form.setAttribute(
            `t-attf-class`,
            "{{props.mode === 'readonly' ? 'o_form_readonly' : 'o_form_editable'}}"
        );

        for (let child of node.childNodes) {
            const toAppend = this.compileNode(child, params);
            this.appendChild(form, toAppend);
        }
        return form;
    }

    compileSheet(node, params) {
        const sheetBG = this.document.createElement("div");
        sheetBG.setAttribute("class", "o_form_sheet_bg");

        const sheetFG = this.document.createElement("div");
        sheetFG.setAttribute("class", "o_form_sheet");
        sheetBG.appendChild(sheetFG);
        for (let child of node.childNodes) {
            this.appendChild(sheetFG, this.compileNode(child, params));
        }
        return sheetBG;
    }

    compileGroup(node, params) {
        let group;
        if (!params.isInGroup) {
            group = this.document.createElement("div");
            group.setAttribute("class", "o_group");
            const _params = Object.create(params);
            _params.isInGroup = true;
            for (let child of node.childNodes) {
                this.appendChild(group, this.compileNode(child, _params));
            }
        } else {
            const table = (group = this.document.createElement("table"));
            table.setAttribute("class", "o_group o_inner_group o_group_col_6");
            const tbody = this.document.createElement("tbody");
            table.appendChild(tbody);
            for (let child of node.childNodes) {
                const tr = this.document.createElement("tr");
                tbody.appendChild(tr);
                this.appendChild(tr, this.compileNode(child, params));
            }
        }
        return group;
    }

    compileField(node) {
        if (node.getAttribute("invisible") === "1") {
            return;
        }
        const field = this.document.createElement("Field");
        field.setAttribute("name", `"${node.getAttribute("name")}"`);
        field.setAttribute("record", `record`);
        field.setAttribute("mode", `props.mode`);
        return field;
    }

    compileNotebook(node, params) {
        if (params.inNotebook) {
            throw new Error("LPE FORBIDDEN");
        }
        const _params = Object.create(params);
        _params.inNotebook = true;

        const notebook = this.document.createElement("div");
        notebook.classList.add("o_notebook");

        const activePage = this.document.createElement("t");
        activePage.setAttribute("t-set", "activePage");
        notebook.appendChild(activePage);

        const headers = this.document.createElement("div");
        headers.classList.add("o_notebook_headers");
        const headersList = this.document.createElement("ul");
        headersList.classList.add("nav", "nav-tabs");
        headers.appendChild(headersList);

        notebook.appendChild(headers);

        const contents = this.document.createElement("div");
        contents.classList.add("tab-content");
        notebook.appendChild(contents);

        const invisibleDomains = {};

        for (let child of node.childNodes) {
            if (!(child instanceof Element)) {
                continue;
            }
            const page = this.compilePage(child, _params);
            if (!page) {
                continue;
            }
            invisibleDomains[page.pageId] = page.invisible;
            this.appendChild(headersList, this.applyInvisible(page.invisible, page.header));
            this.appendChild(contents, page.content);
        }
        activePage.setAttribute(
            "t-value",
            `state.activePage or getActivePage(${JSON.stringify(invisibleDomains)})`
        );
        return notebook;
    }

    compilePage(node, params) {
        const invisible = this.getInvisible(node);
        if (typeof invisible === "boolean" && invisible) {
            return;
        }

        const pageId = `page_${this.id++}`;
        const header = this.document.createElement("li");
        header.classList.add("nav-item");

        const headerLink = this.document.createElement("a");
        headerLink.setAttribute("t-on-click.prevent", `state.activePage = "${pageId}"`);
        headerLink.setAttribute("href", "#");
        headerLink.classList.add("nav-link");
        headerLink.setAttribute("role", "tab");
        headerLink.setAttribute("t-attf-class", `{{ activePage === "${pageId}" ? 'active' : '' }}`);
        headerLink.textContent = node.getAttribute("name");
        header.appendChild(headerLink);

        const content = this.document.createElement("div");
        content.setAttribute("t-if", `activePage === "${pageId}"`);
        content.classList.add("tab-pane", "active");

        for (let child of node.childNodes) {
            this.appendChild(content, this.compileNode(child, params));
        }

        return { pageId, header, content, invisible };
    }

    compileHeader(node, params) {
        const statusBar = this.document.createElement("div");
        statusBar.setAttribute("class", "o_form_statusbar");
        for (let child of node.childNodes) {
            this.appendChild(statusBar, this.compileNode(child, params));
        }
        return statusBar;
    }

    compileButton(node, params) {
        const button = this.document.createElement("button");
        button.textContent = node.getAttribute("string");

        const buttonClickParams = {};
        for (const attName of ["name", "type", "args", "context", "close", "special", "effect"]) {
            const att = node.getAttribute(attName);
            if (att) {
                buttonClickParams[attName] = att;
            }
        }
        button.setAttribute("t-on-click", `buttonClicked(${JSON.stringify(buttonClickParams)})`);
        return button;
    }
}

const templateIds = Object.create(null);
let nextId = 1;

export class FormRenderer extends Component {
    static template = owl.tags.xml`<t t-call="{{ owlifiedArch }}" />`;

    setup() {
        let templateId = templateIds[this.props.info.arch];
        if (!templateId) {
            const formCompiler = new FormCompiler(this.env.qweb);
            const tmpl = formCompiler.compile(this.props.info.xmlDoc).outerHTML;
            templateId = `__form__${nextId++}`;
            this.env.qweb.addTemplate(templateId, tmpl);
            templateIds[this.props.info.arch] = templateId;
            console.log(tmpl);
        }
        this.owlifiedArch = templateId;
        this.state = useState({ activePage: null });
        useSubEnv({ model: this.props.model });
        this.record = this.props.model.root;
        this.action = useService("action");
    }

    evalDomain(domain) {
        domain = new Domain(domain);
        return domain.contains(this.record.data);
    }

    getActivePage(invisibleDomains) {
        for (const page in invisibleDomains) {
            if (!invisibleDomains[page] || !this.evalDomain(invisibleDomains[page])) {
                return page;
            }
        }
    }

    async buttonClicked(params) {
        const buttonContext = makeContext(params.context);
        const envContext = null; //LPE FIXME record.context ?? new Context(payload.env.context).eval();

        const { resModel, resId, resIds } = this.props.model;

        const doActionParams = Object.assign({}, params, {
            resModel,
            resId,
            resIds,
            context: envContext,
            buttonContext,
            onclose: () => this.props.model.load(),
        });

        // LPE TODO: disable all buttons
        this.action.doActionButton(doActionParams);
    }
}

FormRenderer.components = { Field };
