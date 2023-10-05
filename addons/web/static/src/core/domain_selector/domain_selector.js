/** @odoo-module **/

import {
    buildDomain,
    buildDomainSelectorTree,
    extractPathsFromDomain,
    useGetDefaultLeafDomain,
} from "@web/core/domain_selector/utils";
import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { Domain } from "@web/core/domain";
import { TreeEditor } from "@web/core/tree_editor/tree_editor";
import { useLoadFieldInfo } from "@web/core/model_field_selector/utils";
import { CheckBox } from "@web/core/checkbox/checkbox";

class DomainSelectorTreeEditor extends TreeEditor {
    static template = "web.DomainSelectorTreeEditor";
    static components = {
        ...TreeEditor.components,
        CheckBox,
    };
    /** @todo get back toggleArchived */
}

export class DomainSelector extends Component {
    static template = "web.DomainSelector";
    static components = { TreeEditor: DomainSelectorTreeEditor };
    static props = {
        domain: String,
        resModel: String,
        className: { type: String, optional: true },
        defaultConnector: { type: [{ value: "&" }, { value: "|" }], optional: true },
        isDebugMode: { type: Boolean, optional: true },
        readonly: { type: Boolean, optional: true },
        update: { type: Function, optional: true },
    };
    static defaultProps = {
        className: "",
        isDebugMode: false,
        readonly: true,
        update: () => {},
    };

    setup() {
        this.getDefaultLeafDomain = useGetDefaultLeafDomain();
        this.loadFieldInfo = useLoadFieldInfo();
        this.tree = null;
        this.previousTree = null;
        onWillStart(() => this.onPropsUpdated(this.props));
        onWillUpdateProps((np) => this.onPropsUpdated(np));
    }

    get className() {
        return `${this.props.readonly ? "o_read_mode" : "o_edit_mode"} ${
            this.props.className
        }`.trim();
    }

    async onPropsUpdated(p) {
        let domain;
        let isSupported = true;
        try {
            domain = new Domain(p.domain);
        } catch {
            isSupported = false;
        }
        if (!isSupported) {
            this.tree = null;
            this.previousTree = null;
            return;
        }
        const paths = new Set(extractPathsFromDomain(domain));
        await this.loadFieldDefs(p.resModel, paths);
        this.tree = buildDomainSelectorTree(domain, this.getFieldDef.bind(this), {
            distributeNot: !p.isDebugMode,
        });
    }

    getFieldDef(path) {
        if (typeof path === "string") {
            return this.fieldDefs[path];
        }
        if ([0, 1].includes(path)) {
            return { type: "integer", string: String(path) };
        }
        return null;
    }

    async loadFieldDefs(resModel, paths) {
        const promises = [];
        const fieldDefs = {};
        for (const path of paths) {
            if (typeof path === "string") {
                promises.push(
                    this.loadFieldInfo(resModel, path).then(({ fieldDef }) => {
                        fieldDefs[path] = fieldDef;
                    })
                );
            }
        }
        await Promise.all(promises);
        this.fieldDefs = fieldDefs;
    }

    resetDomain() {
        this.props.update("[]");
    }

    onDomainChange(domain) {
        this.props.update(domain, true);
    }

    update(tree) {
        this.props.update(buildDomain(tree));
    }
}
