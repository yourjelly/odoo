/** @odoo-module **/

import { cloneTree, leafToString, useLoadDisplayNames } from "@web/core/domain_selector/utils";
import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { formatValue } from "@web/core/tree_editor/tree";
import { getPathEditorInfo } from "@web/core/domain_selector/domain_selector_path_editor";
import {
    getDefaultOperator,
    getOperatorEditorInfo,
} from "@web/core/domain_selector/domain_selector_operator_editor";
import {
    getDefaultValue,
    getValueEditorInfo,
} from "@web/core/domain_selector/domain_selector_value_editors";
import { ModelFieldSelector } from "@web/core/model_field_selector/model_field_selector";
import { useLoadFieldInfo } from "@web/core/model_field_selector/utils";
import { unique } from "../utils/arrays";

function collectDifferences(tree, otherTree) {
    // some differences shadow the other differences "below":
    if (tree.type !== otherTree.type) {
        return [{ type: "other" }];
    }
    if (tree.negate !== otherTree.negate) {
        return [{ type: "other" }];
    }
    if (tree.type === "condition") {
        if (formatValue(tree.path) !== formatValue(otherTree.path)) {
            return [{ type: "other" }];
        }
        if (formatValue(tree.value) !== formatValue(otherTree.value)) {
            return [{ type: "other" }];
        }
        if (formatValue(tree.operator) !== formatValue(otherTree.operator)) {
            if (tree.operator === "!=" && otherTree.operator === "set") {
                return [{ type: "replacement", tree, operator: "set" }];
            } else if (tree.operator === "=" && otherTree.operator === "not_set") {
                return [{ type: "replacement", tree, operator: "not_set" }];
            } else {
                return [{ type: "other" }];
            }
        }
        return [];
    }
    if (tree.value !== otherTree.value) {
        return [{ type: "other" }];
    }
    if (tree.type === "complex_condition") {
        return [];
    }
    if (tree.children.length !== otherTree.children.length) {
        return [{ type: "other" }];
    }
    const diffs = [];
    for (let i = 0; i < tree.children.length; i++) {
        const child = tree.children[i];
        const otherChild = otherTree.children[i];
        const childDiffs = collectDifferences(child, otherChild);
        if (childDiffs.some((d) => d.type !== "replacement")) {
            return [{ type: "other" }];
        }
        diffs.push(...childDiffs);
    }
    return diffs;
}

function restoreVirtualOperators(tree, otherTree) {
    const diffs = collectDifferences(tree, otherTree);
    // note that the array diffs is homogeneous:
    // we have diffs of the form [], [other], [repl, ..., repl]
    if (diffs.some((d) => d.type !== "replacement")) {
        return;
    }
    for (const { tree, operator } of diffs) {
        tree.operator = operator;
    }
}

export class TreeEditor extends Component {
    static template = "web.TreeEditor";
    static components = {
        Dropdown,
        DropdownItem,
        ModelFieldSelector,
    };
    static props = {
        tree: Object,
        resModel: String,
        update: Function,
        readonly: { type: Boolean, optional: true },
        isDebugMode: { type: Boolean, optional: true },
        defaultConnector: { type: [{ value: "&" }, { value: "|" }], optional: true },
    };
    static defaultProps = {
        defaultConnector: "&",
        isDebugMode: false,
        readonly: false,
    };

    setup() {
        this.loadFieldInfo = useLoadFieldInfo();
        this.loadDisplayNames = useLoadDisplayNames();
        this.defaultCondition = {
            type: "condition",
            path: "id",
            negate: false,
            operator: "=",
            value: 1,
        };
        onWillStart(() => this.onPropsUpdated(this.props));
        onWillUpdateProps((nextProps) => this.onPropsUpdated(nextProps));
    }

    async onPropsUpdated(props) {
        this.tree = cloneTree(props.tree);
        if (this.tree.type !== "connector") {
            this.tree = { type: "connector", value: props.defaultConnector, children: [this.tree] };
        }

        if (this.previousTree) {
            // find "first" difference
            restoreVirtualOperators(this.tree, this.previousTree);
            this.previousTree = null;
        }

        const paths = [];
        function extractPathsFromTree(tree) {
            if (tree.type === "condition") {
                return paths.push(tree.path);
            }
            if (tree.type === "connector") {
                for (const child of tree.children) {
                    extractPathsFromTree(child);
                }
            }
        }
        extractPathsFromTree(this.tree);
        await this.loadFieldDefs(props.resModel, paths);

        function isId(val) {
            return Number.isInteger(val) && val >= 1;
        }

        const idsByModel = {};
        function extractIdsFromDomain(tree, getFieldDef) {
            if (tree.type === "condition") {
                const fieldDef = getFieldDef(tree.path);
                if (["many2one", "many2many", "one2many"].includes(fieldDef?.type)) {
                    const value = tree.value;
                    const values = Array.isArray(value) ? value : [value];
                    const ids = values.filter((val) => isId(val));
                    const resModel = fieldDef.relation;
                    if (ids.length) {
                        if (!idsByModel[resModel]) {
                            idsByModel[resModel] = [];
                        }
                        idsByModel[resModel].push(...ids);
                    }
                }
            }
            if (tree.type === "connector") {
                for (const child of tree.children) {
                    extractPathsFromTree(child);
                }
            }

            for (const resModel in idsByModel) {
                idsByModel[resModel] = unique(idsByModel[resModel]);
            }
            return idsByModel;
        }

        if (props.readonly) {
            const idsByModel = extractIdsFromDomain(this.tree, this.getFieldDef.bind(this));
            this.displayNames = await this.loadDisplayNames(idsByModel);
        }
    }

    get className() {
        return `${this.props.readonly ? "o_read_mode" : "o_edit_mode"}`;
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

    notifyChanges() {
        this.previousTree = cloneTree(this.tree);
        this.props.update(this.tree);
    }

    updateConnector(node, value) {
        node.value = value;
        node.negate = false;
        this.notifyChanges();
    }

    updateAtomicCondition(node, value) {
        node.value = value;
        this.notifyChanges();
    }

    createNewLeaf() {
        return cloneTree(this.defaultCondition);
    }

    createNewBranch(connector) {
        return {
            type: "connector",
            value: connector,
            negate: false,
            children: [this.createNewLeaf(), this.createNewLeaf()],
        };
    }

    insertRootLeaf(parent) {
        parent.children.push(this.createNewLeaf());
        this.notifyChanges();
    }

    insertLeaf(parent, node) {
        const newNode = node.type !== "connector" ? cloneTree(node) : this.createNewLeaf();
        const index = parent.children.indexOf(node);
        parent.children.splice(index + 1, 0, newNode);
        this.notifyChanges();
    }

    insertBranch(parent, node) {
        const nextConnector = parent.value === "&" ? "|" : "&";
        const newNode = this.createNewBranch(nextConnector);
        const index = parent.children.indexOf(node);
        parent.children.splice(index + 1, 0, newNode);
        this.notifyChanges();
    }

    delete(parent, node) {
        const index = parent.children.indexOf(node);
        parent.children.splice(index, 1);
        this.notifyChanges();
    }

    getDescription(node) {
        const fieldDef = this.getFieldDef(node.path);
        return leafToString(node, fieldDef, this.displayNames[fieldDef?.relation]);
    }

    getPathEditorInfo() {
        const { resModel, isDebugMode } = this.props;
        const defaultPath = this.defaultCondition.path;
        return getPathEditorInfo({ defaultPath, isDebugMode, resModel });
    }

    getOperatorEditorInfo(node) {
        const fieldDef = this.getFieldDef(node.path);
        return getOperatorEditorInfo(fieldDef);
    }

    getValueEditorInfo(node) {
        const fieldDef = this.getFieldDef(node.path);
        return getValueEditorInfo(fieldDef, node.operator);
    }

    async updatePath(node, path) {
        const { fieldDef } = await this.loadFieldInfo(this.props.resModel, path);
        node.path = path;
        node.negate = false;
        node.operator = getDefaultOperator(fieldDef);
        node.value = getDefaultValue(fieldDef, node.operator);
        this.notifyChanges();
    }

    updateLeafOperator(node, operator, negate) {
        const fieldDef = this.getFieldDef(node.path);
        node.negate = negate;
        node.operator = operator;
        node.value = getDefaultValue(fieldDef, operator, node.value);
        this.notifyChanges();
    }

    updateLeafValue(node, value) {
        node.value = value;
        this.notifyChanges();
    }

    highlightNode(target) {
        const nodeEl = target.closest(".o_tree_editor_node");
        nodeEl.classList.toggle("o_hovered_button");
    }
}
