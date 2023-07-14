/** @odoo-module **/

import { expressionFromTree, treeFromExpression } from "@web/core/tree_editor/tree";
import { TreeEditor } from "@web/core/tree_editor/tree_editor";
import { useService } from "@web/core/utils/hooks";
import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";

export class ExpressionEditor extends Component {
    static template = "web.ExpressionEditor";
    static components = { TreeEditor };
    static props = {
        resModel: String,
        expression: String,
        update: Function,
        isDebugMode: { type: Boolean, optional: true },
    };
    static defaultProps = {
        isDebugMode: false,
    };

    setup() {
        this.fieldService = useService("field");
        onWillStart(() => this.onPropsUpdated(this.props));
        onWillUpdateProps((nextProps) => this.onPropsUpdated(nextProps));
    }

    async onPropsUpdated(props) {
        try {
            this.fieldDefs = await this.fieldService.loadFields(props.resModel);
            this.tree = treeFromExpression(props.expression, {
                getFieldDef: (name) => this.getFieldDef(name),
            });
        } catch {
            this.fieldDefs = {};
            this.tree = null;
        }
    }

    getFieldDef(name) {
        if (typeof name !== "string") {
            return null;
        }
        return this.fieldDefs[name] || null;
    }

    onExpressionChange(expression) {
        this.props.update(expression);
    }

    resetExpression() {
        this.props.update("True");
    }

    update(tree) {
        const expression = expressionFromTree(tree, {
            getFieldDef: (name) => this.getFieldDef(name),
        });
        this.props.update(expression);
    }
}
