"use strict";

module.exports = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Ensures that the first argument of a call to _t is always a static string.",
        },
        fixable: "code",
        schema: [],
    },
    create(context) {
        return {
            "CallExpression[callee.name='_t']"(node) {
                const [firstArg] = node.arguments;
                if (firstArg) {
                    if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
                        return;
                    }
                    if (firstArg.type === "TemplateLiteral" && firstArg.expressions.length === 0) {
                        return;
                    }
                }
                context.report({
                    node,
                    message: "The first argument of _t must be a static string literal.",
                });
            },
        };
    },
};
