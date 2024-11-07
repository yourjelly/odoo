import traverse, { Binding, NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { flatMap, fromNullable, none, Option, some, toNullable } from "fp-ts/Option";

import { ExtendedEnv } from "../utils/env";
import { ensureProgramPath, getProgramPath } from "../utils/node_path";
import { areEquivalentUpToHole, DeclarationPattern, ExpressionPattern } from "../utils/pattern";
import { isJsFile, normalizeSource, toAbsolutePath } from "../utils/utils";

// for ast descriptions see https://github.com/babel/babel/blob/master/packages/babel-parser/ast/spec.md

function getLocalIdentifierOfRegistry(
    path: NodePath,
    env: ExtendedEnv,
): Option<NodePath<t.Identifier>> {
    const programPath = ensureProgramPath(path);
    if (!programPath) {
        return none;
    }
    for (const p of programPath.get("body")) {
        if (!p.isImportDeclaration()) {
            continue;
        }
        const s = normalizeSource(p.node.source.value, env);
        if (s !== "@web/core/registry") {
            continue;
        }
        for (const s of p.get("specifiers")) {
            if (s.isImportSpecifier()) {
                const imported = s.get("imported");
                if (imported.isIdentifier({ name: "regsitry " })) {
                    return fromNullable(s.get("local"));
                }
            }
        }
    }
    return none;
}

function getBinding(id: NodePath<t.Identifier>): Option<Binding> {
    return fromNullable(id.scope.getBinding(id.node.name));
}

function getBindingPath(id: NodePath<t.Identifier>): Option<NodePath> {
    return flatMap((b: Binding) => some(b.path))(getBinding(id));
}

const viewRegistryPattern1 = new ExpressionPattern("viewRegistry");
const viewRegistryPattern2 = new ExpressionPattern("registry.category('views')");
function isViewRegistry(path: NodePath) {
    if (!path.isExpression()) {
        return false;
    }
    if (path.isIdentifier()) {
        const valuePath = toNullable(getBindingPath(path))?.get("init");
        if (!valuePath || valuePath instanceof Array) {
            return false;
        }
        if (valuePath.isExpression()) {
            return Boolean(viewRegistryPattern2.detect(valuePath));
        }
        return false;
    }
    return Boolean(viewRegistryPattern1.detect(path) || viewRegistryPattern2.detect(path));
}

function getDeclarationPath(id: NodePath<t.Identifier>): NodePath<t.Declaration> | null {
    const path = toNullable(getBindingPath(id));
    if (path && path.parentPath?.isDeclaration()) {
        return path.parentPath;
    }
    return null;
}

function normalize(
    declarationPath: NodePath<t.ImportDeclaration>,
    env: ExtendedEnv,
): t.ImportDeclaration {
    const s = normalizeSource(declarationPath.node.source.value, env);
    const clone = t.cloneNode(declarationPath.node);
    clone.source = t.stringLiteral(s);
    return clone;
}

function getAbsolutePathFromImportDeclaration(
    declarationPath: NodePath<t.ImportDeclaration>,
    env: ExtendedEnv,
): string {
    let absolutePath = toAbsolutePath(declarationPath.node.source.value, env);
    if (!absolutePath.endsWith(".js")) {
        absolutePath += ".js";
    }
    return absolutePath;
}

export function getDefinitionFor(
    identifier: NodePath<t.Identifier>,
    env: ExtendedEnv,
): { path: NodePath; inFilePath: string } | null {
    const binding = toNullable(getBinding(identifier));
    if (!binding) {
        return null;
    }
    if (binding.kind === "module") {
        const path = binding.path;
        if (path && (path.isImportSpecifier() || path.isImportDefaultSpecifier())) {
            const parentPath = path.parentPath as NodePath<t.ImportDeclaration>;
            const absolutePath = getAbsolutePathFromImportDeclaration(parentPath, env);
            const ast = env.getAST(absolutePath);
            if (!ast) {
                return null;
            }
            const name =
                path.isImportSpecifier() && t.isIdentifier(path.node.imported)
                    ? path.node.imported.name
                    : null;
            let res: NodePath | null = null;
            traverse(ast, {
                Program(path) {
                    if (name) {
                        const b = path.scope.getBinding(name);
                        if (b) {
                            res = b.path;
                        }
                        path.stop();
                    }
                },
                ExportDefaultDeclaration(path) {
                    res = path.get("declaration");
                    path.stop();
                },
            });
            if (!res) {
                return null;
            }
            return { path: res, inFilePath: absolutePath };
        }
    }
    if (["const", "let"].includes(binding.kind)) {
        return { path: binding.path, inFilePath: env.inFilePath };
    }
    return null;
}

function getClassPropertyForProps(
    path: NodePath<t.ArrowFunctionExpression | t.FunctionExpression | t.ObjectMethod>,
    declarations: t.ImportDeclaration[],
    env: ExtendedEnv,
) {
    // remove view param
    const params = [...path.node.params];
    params.splice(1, 1);

    const body = path.get("body");

    const refs = path.scope.getBinding("view")?.referencePaths || [];
    body.traverse({
        Identifier(path) {
            if (refs.includes(path)) {
                // change view in this in body
                path.replaceWith(t.thisExpression());
            }
            const declarationPath = getDeclarationPath(path);
            if (declarationPath && declarationPath.isImportDeclaration()) {
                const declarationNode = normalize(declarationPath, env);
                declarations.push(declarationNode);
            }
        },
    });

    // const body = path.node.body;
    const finalBody = t.isExpression(body.node)
        ? t.blockStatement([t.returnStatement(body.node)])
        : body.node;
    const id = t.identifier("getComponentProps");

    const m = t.classMethod("method", id, params, finalBody);
    m.static = true;
    return m;
}

function getObjectPropertyPath(path: NodePath<t.ObjectExpression>, name: string) {
    for (const p of path.get("properties")) {
        if (p.isObjectProperty() && t.isIdentifier(p.node.key, { name })) {
            return p.get("value");
        }
    }
    return null;
}

function getClassPropertyPath(
    path: NodePath<t.ClassDeclaration | t.ClassExpression>,
    name: string,
) {
    for (const p of path.get("body").get("body")) {
        if (p.isClassProperty() && t.isIdentifier(p.node.key, { name })) {
            return p.get("value");
        }
    }
    return null;
}

function addImport(imp: t.ImportDeclaration, programPath: NodePath<t.Program>, env: ExtendedEnv) {
    const source = normalizeSource(imp.source.value, env);
    for (const p of programPath.get("body")) {
        if (!p.isImportDeclaration()) {
            continue;
        }
        const pSource = normalizeSource(p.node.source.value, env);
        if (source !== pSource) {
            continue;
        }
        for (const specifier of imp.specifiers) {
            if (p.node.specifiers.some((s) => areEquivalentUpToHole(specifier, s))) {
                continue;
            }
            p.node.specifiers.push(specifier);
        }
        return;
    }
    programPath.node.body.unshift(imp);
}

function addImports(path: NodePath, imports: t.ImportDeclaration[], env: ExtendedEnv) {
    if (!imports.length) {
        return;
    }
    const program = path.findParent((path) => path.isProgram()) as NodePath<t.Program> | null;
    if (!program) {
        return;
    }
    for (const imp of imports) {
        addImport(imp, program, env);
    }
    env.tagAsModified(env.inFilePath);
}

function copyKeys(
    objectPath: NodePath<t.ObjectExpression>,
    targetPath: NodePath<t.ClassDeclaration | t.ClassExpression>,
    env: ExtendedEnv,
) {
    const body = targetPath.node.body.body;
    let someThingCopied = false;
    const declarations: t.ImportDeclaration[] = [];
    for (const p of objectPath.get("properties")) {
        if (p.isObjectProperty()) {
            if (!t.isIdentifier(p.node.key)) {
                continue;
            }
            if (["type", "Controller"].includes(p.node.key.name)) {
                continue;
            }
            if (p.node.key.name === "props") {
                const value = p.get("value");
                if (
                    value.isArrowFunctionExpression() ||
                    value.isFunctionExpression() ||
                    value.isObjectMethod()
                ) {
                    body.unshift(getClassPropertyForProps(value, declarations, env));
                    someThingCopied = true;
                }
                continue;
            }
            if (t.isIdentifier(p.node.key) && t.isExpression(p.node.value)) {
                const classProperty = t.classProperty(p.node.key, p.node.value);
                classProperty.static = true;
                body.unshift(classProperty);
                const value = p.get("value");
                if (value.isIdentifier()) {
                    const declarationPath = getDeclarationPath(value);
                    if (declarationPath && declarationPath.isImportDeclaration()) {
                        const declarationNode = normalize(declarationPath, env);
                        declarations.push(declarationNode);
                    }
                }
                someThingCopied = true;
            }
        } else if (p.isObjectMethod() && t.isIdentifier(p.node.key, { name: "props" })) {
            const value = p.get("value");
            if (
                !(value instanceof Array) &&
                (value.isArrowFunctionExpression() ||
                    value.isFunctionExpression() ||
                    value.isObjectMethod())
            ) {
                body.unshift(getClassPropertyForProps(value, declarations, env));
                someThingCopied = true;
            }
        }
    }
    return { someThingCopied, declarations };
}

const addPattern2Args = new ExpressionPattern("__target.add(__key, __added)");
const addPattern3Args = new ExpressionPattern("__target.add(__key, __added, __y)");
const declarationPattern = new DeclarationPattern("const __id = __def");

// function clearProperties(viewDef: NodePath<t.ObjectExpression>) {
//     for (const p of viewDef.get("properties")) {
//         if (p.isObjectProperty() && p.get("key").isIdentifier({ name: "Controller" })) {
//             continue;
//         }
//         p.remove();
//     }
// }

function getViewDef(path: NodePath, env: ExtendedEnv): NodePath<t.ObjectExpression> | null {
    if (path.isObjectExpression()) {
        return path;
    }
    if (path.isIdentifier()) {
        const declarationPath = getDeclarationPath(path);
        if (!declarationPath) {
            return null;
        }
        const { __def: __viewDef } = declarationPattern.detect(declarationPath) || {};
        if (!__viewDef || __viewDef instanceof Array) {
            return null;
        }
        if (__viewDef.isObjectExpression()) {
            env.cleaning.add(() => declarationPath.remove());
            return __viewDef;
        }
    }
    return null;
}

function createController(
    viewDef: NodePath<t.ObjectExpression>,
    controllerValuePath: NodePath<t.Identifier>,
    env: ExtendedEnv,
) {
    const id = viewDef.scope.generateUidIdentifier("Controller");
    const newControllerDeclaration = t.classDeclaration(
        id,
        controllerValuePath.node,
        t.classBody([]),
    );
    viewDef.getStatementParent()?.insertBefore(newControllerDeclaration);
    const newControllerDeclarationPath = viewDef
        .getStatementParent()
        ?.getPrevSibling() as NodePath<t.ClassDeclaration>;
    copyKeys(viewDef, newControllerDeclarationPath, env);
    env.tagAsModified(env.inFilePath);
    return newControllerDeclarationPath.get("id") as NodePath<t.Identifier>;
}

// use recursivity

function getImportForController(id: NodePath<t.Identifier>, env: ExtendedEnv) {
    const d = getDefinitionFor(id, env);
    if (d) {
        const s = normalizeSource(d.inFilePath, { ...env, inFilePath: d.inFilePath });
        const i = t.importDeclaration([t.importSpecifier(id.node, id.node)], t.stringLiteral(s));
        return i;
    }
    return null;
}

function processView(viewDef: NodePath<t.ObjectExpression>, env: ExtendedEnv) {
    const controllerValuePath = getObjectPropertyPath(viewDef, "Controller");
    if (!controllerValuePath) {
        // view is maybe an extension
        const spreadElement = viewDef.get("properties").find((p) => p.isSpreadElement());
        if (spreadElement) {
            const arg = spreadElement.get("argument");
            if (arg.isIdentifier()) {
                const definition = getDefinitionFor(arg, env);
                let controllerValuePath: NodePath<unknown> | null = null;

                if (definition?.path && definition.path.isVariableDeclarator()) {
                    const def = definition.path.get("init");
                    if (def && def.isObjectExpression()) {
                        // we get "super" view (?)
                        controllerValuePath = getObjectPropertyPath(def, "Controller");
                    }
                } else if (definition?.path && definition.path.isClassDeclaration()) {
                    // we get "super" view (?)
                    controllerValuePath = getClassPropertyPath(definition.path, "Controller");
                }
                if (definition && controllerValuePath && controllerValuePath?.isIdentifier()) {
                    const i = getImportForController(controllerValuePath, {
                        ...env,
                        inFilePath: definition.inFilePath,
                    });
                    if (i) {
                        addImports(viewDef, [i], env);
                    }
                    return createController(viewDef, controllerValuePath, env);
                }
                return null;
            }
        }
    } else if (controllerValuePath?.isIdentifier()) {
        const definition = getDefinitionFor(controllerValuePath, env);
        if (definition && definition.path.isClassDeclaration()) {
            const { someThingCopied, declarations } = copyKeys(viewDef, definition.path, env);
            env.tagAsModified(env.inFilePath);
            if (someThingCopied && definition.inFilePath !== env.inFilePath) {
                if (declarations.length) {
                    addImports(definition.path, declarations, {
                        ...env,
                        inFilePath: definition.inFilePath,
                    });
                }
                env.tagAsModified(definition.inFilePath);
            }
            return controllerValuePath;
        }
    } else if (controllerValuePath?.isClassExpression()) {
        copyKeys(viewDef, controllerValuePath, env);
        env.tagAsModified(env.inFilePath);
        return controllerValuePath;
    }
    return null;
}

function viewObjectToController(path: NodePath | null, env: ExtendedEnv) {
    const programPath = ensureProgramPath(path);
    if (!programPath) {
        return;
    }
    const localPath = getLocalIdentifierOfRegistry(programPath, env);
    if (!localPath) {
        return;
    }
    programPath.traverse({
        CallExpression(path) {
            const { __target, __added, __key } =
                addPattern2Args.detect(path) || addPattern3Args.detect(path) || {};
            if (!__target || !__added || __target instanceof Array || __added instanceof Array) {
                return;
            }
            if (!isViewRegistry(__target)) {
                return;
            }
            const viewDef = getViewDef(__added, env);
            if (viewDef && viewDef.isObjectExpression()) {
                const controllerValuePath = processView(viewDef, env);
                if (controllerValuePath) {
                    // clearProperties(viewDef);
                    __added.replaceWith(controllerValuePath);
                    return;
                }
            }
            if (__key instanceof Array) {
                return;
            }
            console.log(
                `Not changed in (${env.inFilePath}): `,
                __key.isStringLiteral() ? __key.node.value : "non identifier key",
            );
        },
    });
}

export function view_object_to_controller(env: ExtendedEnv) {
    if (!isJsFile(env.inFilePath)) {
        return;
    }
    const ast = env.getAST(env.inFilePath);
    if (!ast) {
        return;
    }
    viewObjectToController(getProgramPath(ast), env);
}
