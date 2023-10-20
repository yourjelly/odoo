/** @odoo-module **/

import { Domain } from "@web/core/domain";
import { formatAST, parseExpr } from "@web/core/py_js/py";
import { toPyValue } from "@web/core/py_js/py_utils";

/** @typedef { import("@web/core/py_js/py_parser").AST } AST */
/** @typedef {import("@web/core/domain").DomainRepr} DomainRepr */

/**
 * @typedef {number|string|boolean|Expression} Atom
 */

/**
 * @typedef {Atom|Atom[]} Value
 */

/**
 * @typedef {Object} Condition
 * @property {"condition"} type
 * @property {Value} path
 * @property {Value} operator
 * @property {Value} value
 * @property {boolean} negate
 */

/**
 * @typedef {Object} ComplexCondition
 * @property {"complex_condition"} type
 * @property {string} value expression
 */

/**
 * @typedef {Object} AND
 * @property {"connector"} type
 * @property {boolean} negate
 * @property {"&"} value
 * @property {(Connector|OR)[]} children
 */

/**
 * @typedef {Object} OR
 * @property {"connector"} type
 * @property {boolean} negate
 * @property {"|"} value
 * @property {(Connector|AND)[]} children
 */

/**
 * @typedef {AND|OR|Condition} SimpleTree
 */

/**
 * @typedef {AND|OR|Condition|ComplexCondition} Tree
 */

/**
 * @typedef {Object} Options
 * @property {(value: Value) => (null|Object)} [getFieldDef]
 * @property {boolean} [distributeNot]
 */

export const TERM_OPERATORS_NEGATION = {
    "<": ">=",
    ">": "<=",
    "<=": ">",
    ">=": "<",
    "=": "!=",
    "!=": "=",
    in: "not in",
    like: "not like",
    ilike: "not ilike",
    "not in": "in",
    "not like": "like",
    "not ilike": "ilike",
};

const TERM_OPERATORS_NEGATION_EXTENDED = {
    ...TERM_OPERATORS_NEGATION,
    is: "is not",
    "is not": "is",
    "==": "!=",
    "!=": "==", // override here
};

const EXCHANGE = {
    "<": ">",
    "<=": ">=",
    ">": "<",
    ">=": "<=",
    "=": "=",
    "!=": "!=",
};

const COMPARATORS = ["<", "<=", ">", ">=", "in", "not in", "==", "is", "!=", "is not"];

export class Expression {
    constructor(ast) {
        if (typeof ast === "string") {
            ast = parseExpr(ast);
        }
        this._ast = ast;
        this._expr = formatAST(ast);
    }

    toAST() {
        return this._ast;
    }

    toString() {
        return this._expr;
    }
}

export function formatValue(value) {
    return formatAST(toAST(value));
}

export function normalizeValue(value) {
    return toValue(toAST(value)); // no array in array (see isWithinArray)
}

/**
 * @param {import("@web/core/py_js/py_parser").AST} ast
 * @returns {Value}
 */
export function toValue(ast, isWithinArray = false) {
    if ([4, 10].includes(ast.type) && !isWithinArray) {
        /** 4: list, 10: tuple */
        return ast.value.map((v) => toValue(v, true));
    } else if ([0, 1, 2].includes(ast.type)) {
        /** 0: number, 1: string, 2: boolean */
        return ast.value;
    } else if (ast.type === 6 && ast.op === "-" && ast.right.type === 0) {
        /** 6: unary operator */
        return -ast.right.value;
    } else if (ast.type === 5 && ["false", "true"].includes(ast.value)) {
        /** 5: name */
        return JSON.parse(ast.value);
    } else {
        return new Expression(ast);
    }
}

/**
 * @param {Value} value
 * @returns  {import("@web/core/py_js/py_parser").AST}
 */
function toAST(value) {
    if (value instanceof Expression) {
        return value.toAST();
    }
    if (Array.isArray(value)) {
        return { type: 4, value: value.map(toAST) };
    }
    return toPyValue(value);
}

/**
 * @param {AND|OR} parent
 * @param {Tree} child
 */
function addChild(parent, child) {
    if (child.type === "connector" && !child.negate && child.value === parent.value) {
        parent.children.push(...child.children);
    } else {
        parent.children.push(child);
    }
}

/**
 * @param {Condition} condition
 * @returns {Condition}
 */
function getNormalizedCondition(condition) {
    let { operator, negate } = condition;
    if (negate && typeof operator === "string" && TERM_OPERATORS_NEGATION[operator]) {
        operator = TERM_OPERATORS_NEGATION[operator];
        negate = false;
    }
    return { ...condition, operator, negate };
}

function normalizeCondition(condition) {
    Object.assign(condition, getNormalizedCondition(condition));
}

/**
 * @param {AST[]} ASTs
 * @param {boolean} distributeNot
 * @param {boolean} [negate=false]
 * @returns {{ tree: Tree, remaimingASTs: AST[] }}
 */
function _construcTree(ASTs, distributeNot, negate = false) {
    const [firstAST, ...tailASTs] = ASTs;

    if (firstAST.type === 1 && firstAST.value === "!") {
        return _construcTree(tailASTs, distributeNot, !negate);
    }

    const tree = { type: firstAST.type === 1 ? "connector" : "condition" };
    if (tree.type === "connector") {
        tree.value = firstAST.value;
        if (distributeNot && negate) {
            tree.value = tree.value === "&" ? "|" : "&";
            tree.negate = false;
        } else {
            tree.negate = negate;
        }
        tree.children = [];
    } else {
        const [pathAST, operatorAST, valueAST] = firstAST.value;
        tree.path = toValue(pathAST);
        tree.negate = negate;
        tree.operator = toValue(operatorAST);
        tree.value = toValue(valueAST);
        normalizeCondition(tree);
    }
    let remaimingASTs = tailASTs;
    if (tree.type === "connector") {
        for (let i = 0; i < 2; i++) {
            const { tree: child, remaimingASTs: otherASTs } = _construcTree(
                remaimingASTs,
                distributeNot,
                distributeNot && negate
            );
            remaimingASTs = otherASTs;
            addChild(tree, child);
        }
    }
    return { tree, remaimingASTs };
}

/**
 * @param {AST[]} initialASTs
 * @param {Object} options
 * @param {boolean} [options.distributeNot=false]
 * @returns {Tree}
 */
function construcTree(initialASTs, options) {
    if (!initialASTs.length) {
        return { type: "connector", value: "&", negate: false, children: [] };
    }
    const { tree } = _construcTree(initialASTs, options.distributeNot);
    return tree;
}

/**
 * @param {Tree} tree
 * @returns {AST[]}
 */
function getASTs(tree) {
    const ASTs = [];
    if (tree.type === "condition") {
        if (tree.negate) {
            ASTs.push(toAST("!"));
        }
        ASTs.push({
            type: 10,
            value: [tree.path, tree.operator, tree.value].map(toAST),
        });
        return ASTs;
    }

    const length = tree.children.length;
    if (length && tree.negate) {
        ASTs.push(toAST("!"));
    }
    for (let i = 0; i < length - 1; i++) {
        ASTs.push(toAST(tree.value));
    }
    for (const child of tree.children) {
        ASTs.push(...getASTs(child));
    }
    return ASTs;
}

function not(ast) {
    if (isNot(ast)) {
        return ast.right;
    }
    if (ast.type === 2) {
        return { ...ast, value: !ast.value };
    }
    if (ast.type === 7 && COMPARATORS.includes(ast.op)) {
        return { ...ast, op: TERM_OPERATORS_NEGATION_EXTENDED[ast.op] };
    }
    if (ast.type === 16) {
        return { ...ast, value: not(ast.value) };
    }
    return { type: 6, op: "not", right: isBool(ast) ? ast.args[0] : ast };
}

function bool(ast) {
    if (isBool(ast) || isNot(ast) || ast.type === 2) {
        return ast;
    }
    return { type: 8, fn: { type: 5, value: "bool" }, args: [ast], kwargs: {} };
}

function name(value) {
    return { type: 5, value };
}

function or(left, right) {
    return { type: 14, op: "or", left, right };
}

function and(left, right) {
    return { type: 14, op: "and", left, right };
}

function isNot(ast) {
    return ast.type === 6 && ast.op === "not";
}

function is(oneParamFunc, ast) {
    return (
        ast.type === 8 &&
        ast.fn &&
        ast.fn.type === 5 &&
        ast.fn.value === oneParamFunc &&
        ast.args &&
        ast.args.length === 1
    ); // improve condition?
}

function isBool(ast) {
    return is("bool", ast);
}

function isValidPath(ast, options) {
    const getFieldDef = options.getFieldDef || (() => null);
    if (ast.type === 5) {
        return getFieldDef(ast.value) !== null;
    }
    return false;
}

function isRelational(ast, options) {
    if (isValidPath(ast, options)) {
        const fieldDef = options.getFieldDef(ast.value); // safe: isValidPath has not returned null;
        return ["many2one", "many2many", "one2many"].includes(fieldDef.type);
    }
    return false;
}

function _getConditionFromComparator(ast, options) {
    if (["is", "is not"].includes(ast.op)) {
        // we could do something smarter here
        // e.g. if left is a boolean field and right is a boolean
        // we can create a condition based on "="
        return null;
    }

    const tree = { type: "condition", negate: false };

    let operator = ast.op;
    if (operator === "==") {
        operator = "=";
    }

    let left = ast.left;
    let right = ast.right;
    if (isValidPath(left, options) == isValidPath(right, options)) {
        return null;
    }

    if (!isValidPath(left, options)) {
        if (operator in EXCHANGE) {
            left = ast.right;
            right = ast.left;
            operator = EXCHANGE[operator];
        } else {
            return null;
        }
    }
    tree.path = left.value;
    tree.operator = operator;
    tree.value = toValue(right);

    return tree;
}

/**
 * @param {AST} ast
 * @param {Options} options
 * @param {boolean} [negate=false]
 * @returns {import("@web/core/tree_editor/condition_tree").Condition|ComplexCondition}
 */
function _leafFromAST(ast, options, negate = false) {
    if (isNot(ast)) {
        return _treeFromAST(ast.right, options, !negate);
    }

    if (ast.type === 5 /** name */ && isValidPath(ast, options)) {
        return {
            type: "condition",
            negate: false,
            path: ast.value,
            operator: negate ? "=" : "!=",
            value: false,
        };
    }

    const astValue = toValue(ast);
    if (["boolean", "number", "string"].includes(typeof astValue)) {
        return {
            negate: false,
            type: "condition",
            path: astValue ? 1 : 0,
            operator: "=",
            value: 1,
        };
    }

    if (ast.type === 7 && COMPARATORS.includes(ast.op)) {
        if (negate) {
            return _leafFromAST(not(ast), options);
        }
        const tree = _getConditionFromComparator(ast, options);
        if (tree) {
            return tree;
        }
    }

    if (
        !negate &&
        ast.type === 16 /** for comprehension */ &&
        ast.subtype === "list" &&
        ast.keys.length === 1
    ) {
        const { keys, iterator, value, condition } = ast;

        const isKey = (ast) => ast.type === 5 && ast.value === keys[0];
        const isSimple = (op, ast) =>
            ast.type === 7 && ast.op === op && isKey(ast.left) && [4, 10].includes(ast.right.type);
        const isSimpleOnPath = (op, ast) =>
            ast.type === 7 && ast.op === op && isKey(ast.left) && isRelational(ast.right, options);

        if (isRelational(iterator, options)) {
            if (
                isKey(value) &&
                condition &&
                (isSimple("in", condition) || isSimple("not in", condition))
            ) {
                return {
                    type: "condition",
                    negate: false,
                    path: iterator.value,
                    operator: condition.op,
                    value: toValue(condition.right),
                };
            }
            if (!condition && (isSimple("in", value) || isSimple("not in", value))) {
                return {
                    type: "condition",
                    negate: false,
                    path: iterator.value,
                    operator: value.op,
                    value: toValue(value.right),
                };
            }
        } else if (condition && isSimpleOnPath("in", condition)) {
            return {
                type: "condition",
                negate: false,
                path: condition.right.value,
                operator: "in",
                value: toValue(iterator),
            };
        } else if (!condition && isSimpleOnPath("in", value)) {
            return {
                type: "condition",
                negate: false,
                path: iterator.value,
                operator: "in",
                value: value.value,
            };
        }
    }

    if (is("any", ast) && ast.args[0].type === 16 /** for comprehension */) {
        if (negate) {
            return _leafFromAST({ ...ast, fn: name("all"), args: ast.args.map(not) }, options);
        }
        const tree = _leafFromAST(ast.args[0], options, false);
        if (tree.type === "condition") {
            return tree;
        }
    }

    if (is("all", ast) && ast.args[0].type === 16 /** for comprehension */) {
        if (negate) {
            return _leafFromAST({ ...ast, fn: name("any"), args: ast.args.map(not) }, options);
        }
        // TODO: improve this in future
    }

    // no conclusive way to transform ast in a condition
    return {
        type: "complex_condition",
        value: formatAST(negate ? not(ast) : ast),
    };
}

/**
 * @param {AST} ast
 * @param {Options} options
 * @param {boolean} [negate=false]
 * @returns {Tree}
 */
function _treeFromAST(ast, options, negate = false) {
    if (isNot(ast)) {
        return _treeFromAST(ast.right, options, !negate);
    }

    if (ast.type === 14) {
        const tree = {
            type: "connector",
            value: ast.op === "and" ? "&" : "|", // and/or are the only ops that are given type 14 (for now)
            children: [],
        };
        if (options.distributeNot && negate) {
            tree.value = tree.value === "&" ? "|" : "&";
            tree.negate = false;
        } else {
            tree.negate = negate;
        }
        const subASTs = [ast.left, ast.right];
        for (const subAST of subASTs) {
            const child = _treeFromAST(subAST, options, options.distributeNot && negate);
            addChild(tree, child);
        }
        return tree;
    }

    if (ast.type === 13) {
        const newAST = or(and(ast.condition, ast.ifTrue), and(not(ast.condition), ast.ifFalse));
        return _treeFromAST(newAST, options, negate);
    }

    return _leafFromAST(ast, options, negate);
}

function _expressionFromTree(tree, options, isRoot = false) {
    if (tree.type === "connector" && tree.value === "|" && tree.children.length === 2) {
        // check if we have an "if else"
        const isSimpleAnd = (tree) =>
            tree.type === "connector" && tree.value === "&" && tree.children.length === 2;
        if (tree.children.every((c) => isSimpleAnd(c))) {
            const [c1, c2] = tree.children;
            for (let i = 0; i < 2; i++) {
                const c1Child = c1.children[i];
                const str1 = _expressionFromTree({ ...c1Child }, options);
                for (let j = 0; j < 2; j++) {
                    const c2Child = c2.children[j];
                    const str2 = _expressionFromTree(c2Child, options);
                    if (str1 === `not ${str2}` || `not ${str1}` === str2) {
                        /** @todo smth smarter. this is very fragile */
                        const others = [c1.children[1 - i], c2.children[1 - j]];
                        const str = _expressionFromTree(c1Child, options);
                        const strs = others.map((c) => _expressionFromTree(c, options));
                        return `${strs[0]} if ${str} else ${strs[1]}`;
                    }
                }
            }
        }
    }

    if (tree.type === "connector") {
        const connector = tree.value === "&" ? "and" : "or";
        const subExpressions = tree.children.map((c) => _expressionFromTree(c, options));
        if (!subExpressions.length) {
            return connector === "and" ? "1" : "0";
        }
        let expression = subExpressions.join(` ${connector} `);
        if (!isRoot || tree.negate) {
            expression = `( ${expression} )`;
        }
        if (tree.negate) {
            expression = `not ${expression}`;
        }
        return expression;
    }

    if (tree.type === "complex_condition") {
        return tree.value;
    }

    tree = getNormalizedCondition(tree);
    const { path, operator, value } = tree;

    const op = operator === "=" ? "==" : operator; // do something about is ?
    if (typeof op !== "string" || !COMPARATORS.includes(op)) {
        throw new Error("Invalid operator");
    }

    // we can assume that negate = false here: comparators have negation defined
    // and the tree has been normalized

    if ([0, 1].includes(path)) {
        if (operator !== "=" || value !== 1) {
            // check if this is too restricive for us
            return new Error("Invalid condition");
        }
        return formatAST({ type: 2, value: Boolean(path) });
    }

    const pathAST = toAST(path);
    if (typeof path == "string" && isValidPath(name(path), options)) {
        pathAST.type = 5;
    }

    if (value === false && ["=", "!="].includes(operator)) {
        // true makes sense for non boolean fields?
        return formatAST(operator === "=" ? not(pathAST) : pathAST);
    }

    // add case true for boolean fields

    return formatAST({
        type: 7,
        op,
        left: pathAST,
        right: toAST(value),
    });
}

////////////////////////////////////////////////////////////////////////////////
//  PUBLIC: CREATE/REMOVE
//    between operator
//    is, is_not, set, not_set operators
//    complex conditions
////////////////////////////////////////////////////////////////////////////////

/**
 * @param {Tree} tree
 * @returns {Tree}
 */
function createBetweenOperators(tree) {
    if (["condition", "complex_condition"].includes(tree.type)) {
        return tree;
    }
    const processedChildren = tree.children.map(createBetweenOperators);
    if (tree.value === "|") {
        return { ...tree, children: processedChildren };
    }
    const children = [];
    for (let i = 0; i < processedChildren.length; i++) {
        const child1 = processedChildren[i];
        const child2 = processedChildren[i + 1];
        if (
            child1.type === "condition" &&
            child2 &&
            child2.type === "condition" &&
            formatValue(child1.path) === formatValue(child2.path) &&
            child1.operator === ">=" &&
            child2.operator === "<="
        ) {
            children.push({
                type: "condition",
                negate: false,
                path: child1.path,
                operator: "between",
                value: normalizeValue([child1.value, child2.value]),
            });
            i += 1;
        } else {
            children.push(child1);
        }
    }
    if (children.length === 1) {
        return { ...children[0] };
    }
    return { ...tree, children };
}

/**
 * @param {Tree} tree
 * @returns {Tree}
 */
export function removeBetweenOperators(tree) {
    if (tree.type === "complex_condition") {
        return tree;
    }
    if (tree.type === "condition") {
        if (tree.operator !== "between") {
            return tree;
        }
        const { negate, path, value } = tree;
        return {
            type: "connector",
            negate,
            value: "&",
            children: [
                {
                    type: "condition",
                    negate: false,
                    path,
                    operator: ">=",
                    value: value[0],
                },
                {
                    type: "condition",
                    negate: false,
                    path,
                    operator: "<=",
                    value: value[1],
                },
            ],
        };
    }
    const processedChildren = tree.children.map(removeBetweenOperators);
    if (tree.value === "|") {
        return { ...tree, children: processedChildren };
    }
    const newTree = { ...tree, children: [] };
    // after processing a child might have become a connector "&" --> normalize
    for (let i = 0; i < processedChildren.length; i++) {
        addChild(newTree, processedChildren[i]);
    }
    return newTree;
}

/**
 * @param {Tree} tree
 * @param {options} [options={}]
 * @param {Function} [options.getFieldDef]
 * @returns {Tree}
 */
export function createVirtualOperators(tree, options = {}) {
    if (tree.type === "condition") {
        const { path, operator, value } = tree;
        if (["=", "!="].includes(operator)) {
            const fieldDef = options.getFieldDef?.(path) || null;
            if (fieldDef) {
                if (fieldDef.type === "boolean") {
                    return { ...tree, operator: operator === "=" ? "is" : "is_not" };
                } else if (
                    !["many2one", "date", "datetime"].includes(fieldDef?.type) &&
                    value === false
                ) {
                    return { ...tree, operator: operator === "=" ? "not_set" : "set" };
                }
            }
        }
        return tree;
    }
    if (tree.type === "complex_condition") {
        return tree;
    }
    const processedChildren = tree.children.map((c) => createVirtualOperators(c, options));
    return { ...tree, children: processedChildren };
}

/**
 * @param {Tree} tree
 * @returns {Tree}
 */
export function removeVirtualOperators(tree) {
    if (tree.type === "condition") {
        const { operator } = tree;
        if (["is", "is_not"].includes(operator)) {
            return { ...tree, operator: operator === "is" ? "=" : "!=" };
        }
        if (["set", "not_set"].includes(operator)) {
            return { ...tree, operator: operator === "set" ? "!=" : "=" };
        }
        return tree;
    }
    if (tree.type === "complex_condition") {
        return tree;
    }
    const processedChildren = tree.children.map((c) => removeVirtualOperators(c));
    return { ...tree, children: processedChildren };
}

/**
 * @param {Tree} tree
 * @returns {Tree} the conditions better expressed as complex conditions become complex conditions
 */
function createComplexConditions(tree) {
    if (tree.type === "condition") {
        if (tree.path instanceof Expression && tree.operator === "=" && tree.value === 1) {
            // not sure about this one -> we should maybe evaluate the condition and check
            // if it does not become something e.g. the name of a integer field?
            return {
                type: "complex_condition",
                value: String(tree.path),
            };
        }
        return { ...tree };
    }
    if (tree.type === "complex_condition") {
        return { ...tree };
    }
    return {
        ...tree,
        children: tree.children.map((child) => createComplexConditions(child)),
    };
}

/**
 * @param {Tree} tree
 * @returns {Tree} a simple tree (without complex conditions)
 */
function removeComplexConditions(tree) {
    if (tree.type === "condition") {
        return { ...tree };
    }
    if (tree.type === "complex_condition") {
        const ast = parseExpr(tree.value);
        return {
            type: "condition",
            path: new Expression(bool(ast)),
            operator: "=",
            value: 1,
        };
    }
    return {
        ...tree,
        children: tree.children.map((child) => removeComplexConditions(child)),
    };
}

////////////////////////////////////////////////////////////////////////////////
//  PUBLIC: MAPPINGS
//    tree <-> expression
//    domain <-> expression
//    expression <-> tree
////////////////////////////////////////////////////////////////////////////////

/**
 * @param {string} expression
 * @param {Options} [options={}]
 * @returns {Tree} a tree representation of an expression
 */
export function treeFromExpression(expression, options = {}) {
    const ast = parseExpr(expression);
    const tree = _treeFromAST(ast, options);
    return createVirtualOperators(createBetweenOperators(tree), options);
}

/**
 * @param {Tree} tree
 * @param {Options} [options={}]
 * @returns {string} an expression
 */
export function expressionFromTree(tree, options = {}) {
    const simplifiedTree = createComplexConditions(
        removeBetweenOperators(removeVirtualOperators(tree))
    );
    return _expressionFromTree(simplifiedTree, options, true);
}

/**
 * @param {Tree} tree
 * @returns {string} a string representation of a domain
 */
export function domainFromTree(tree) {
    const simplifiedTree = removeBetweenOperators(
        removeVirtualOperators(removeComplexConditions(tree))
    );
    const domainAST = {
        type: 4,
        value: getASTs(simplifiedTree),
    };
    return formatAST(domainAST);
}

/**
 * @param {DomainRepr} domain
 * @param {Object} [options={}] see construcTree API
 * @returns {Tree} a (simple) tree representation of a domain
 */
export function treeFromDomain(domain, options = {}) {
    domain = new Domain(domain);
    const domainAST = domain.ast;
    const tree = construcTree(domainAST.value, options); // a simple tree
    return createVirtualOperators(createBetweenOperators(tree), options);
}

/**
 * @param {DomainRepr} domain a string representation of a domain
 * @param {Options} [options={}]
 * @returns {string} an expression
 */
export function expressionFromDomain(domain, options = {}) {
    const tree = treeFromDomain(domain, options);
    return expressionFromTree(tree, options);
}

/**
 * @param {string} expression an expression
 * @param {Options} [options={}]
 * @returns {string} a string representation of a domain
 */
export function domainFromExpression(expression, options = {}) {
    const tree = treeFromExpression(expression, options);
    return domainFromTree(tree);
}
