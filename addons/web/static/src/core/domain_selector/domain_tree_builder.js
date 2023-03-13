/** @odoo-module **/

import {
    BranchDomainNode,
    DomainValueExpr,
    LeafDomainNode,
} from "@web/core/domain_selector/domain_selector_nodes";
import { findOperator, parseOperator } from "@web/core/domain_selector/domain_selector_operators";
import { formatAST } from "@web/core/py_js/py_utils";

export class DomainTreeBuilder {
    build(domain, fieldDefs) {
        const nodeIterator = domain.ast.value.values();
        const nextNode = () => {
            const it = nodeIterator.next();
            return it.done ? null : it.value;
        };

        const rawNode = nextNode();
        const node =
            rawNode && this.isBranch(rawNode)
                ? new BranchDomainNode(this.getBranchOperator(rawNode))
                : new BranchDomainNode("AND");
        if (rawNode) {
            this.buildNode(node, rawNode, nextNode, fieldDefs);
        }

        return node;
    }

    /** @private */
    buildNode(parent, rawNode, nextNode, fieldDefs) {
        if (this.isBranch(rawNode)) {
            this.buildBranch(parent, rawNode, nextNode, fieldDefs);
        } else {
            this.buildLeaf(parent, rawNode, fieldDefs);
        }
    }

    /** @private */
    buildLeaf(parent, rawNode, fieldDefs) {
        const fieldName = this.getLeafFieldName(rawNode);
        const operatorInfo = this.getLeafOperatorInfo(rawNode, fieldDefs[fieldName]?.type);
        const value = this.getLeafValue(rawNode);
        const field = { ...fieldDefs[fieldName], name: fieldName };
        parent.add(new LeafDomainNode(field, operatorInfo, value));
    }

    /** @private */
    buildBranch(parent, rawNode, nextNode, fieldDefs) {
        let newParent = parent;
        const currentOperator = this.getBranchOperator(rawNode);
        if (currentOperator !== parent.operator) {
            newParent = new BranchDomainNode(currentOperator);
            parent.add(newParent);
        }
        this.buildNode(newParent, nextNode(), nextNode, fieldDefs);
        this.buildNode(newParent, nextNode(), nextNode, fieldDefs);
    }

    /** @private */
    isBranch(rawNode) {
        return rawNode.type === 1 && ["&", "|", "!"].includes(rawNode.value);
    }

    /** @private */
    getBranchOperator(rawNode) {
        switch (rawNode.value) {
            case "&":
                return "AND";
            case "|":
                return "OR";
            case "!":
                return "NOT";
        }
    }

    /** @private */
    getLeafFieldName(rawNode) {
        return rawNode.value[0].value.toString();
    }

    /** @private */
    getLeafOperatorInfo(rawNode, fieldType) {
        const rawOperator = rawNode.value[1].value;
        if (fieldType && fieldType === "boolean") {
            return findOperator(rawOperator === "=" ? "is" : "is_not");
        } else if (rawNode.value[2].type === 2) {
            return findOperator(rawOperator === "!=" ? "set" : "not_set");
        } else {
            return parseOperator(rawOperator);
        }
    }

    /** @private */
    getLeafValue(rawNode) {
        if (this.isLeafValueArray(rawNode)) {
            return rawNode.value[2].value.map((v) => v.value);
        } else if (this.isLeafValueLiteral(rawNode)) {
            return rawNode.value[2].value;
        } else {
            return new DomainValueExpr(formatAST(rawNode.value[2]));
        }
    }

    /** @private */
    isLeafValueArray(rawNode) {
        return [4, 10].includes(rawNode.value[2].type);
    }

    /** @private */
    isLeafValueLiteral(rawNode) {
        return [0, 1, 2, 3].includes(rawNode.value[2].type);
    }
}
