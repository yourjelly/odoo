import { opendirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parse as babelParser, ParseResult } from "@babel/parser";
import { NodePath } from "@babel/traverse";
import { cloneNode, File, Program } from "@babel/types";
import { parse, print } from "recast"; // https://github.com/benjamn/recast

import { remove_odoo_module_comment } from "../operations/remove_odoo_module_comment";
import { view_object_to_controller } from "../operations/view_object_to_controller";
import { Env, PartialEnv } from "./env";
import { group_imports, remove_unused_imports } from "./imports";
import { getProgramPath } from "./node_path";
import { ODOO_PATH } from "./file_path";

const parser = {
    parse(data: string) {
        return babelParser(data, { sourceType: "module" });
    },
};

const cacheFileContent: Record<string, string> = {};
export function getFileContent(filePath: string): string | null {
    if (!(filePath in cacheFileContent)) {
        let content;
        try {
            content = readFileSync(filePath, { encoding: "utf-8" });
        } catch {
            /* empty */
        }
        if (typeof content === "string") {
            cacheFileContent[filePath] = content;
        }
    }
    return cacheFileContent[filePath] || null;
}

const cacheAST: Record<string, File> = {};
function getAST(filePath: string): File | null {
    if (!cacheAST[filePath]) {
        const fileContent = getFileContent(filePath);
        if (!fileContent) {
            return null;
        }
        let ast;
        try {
            ast = parse(fileContent, { parser });
        } catch {
            /* empty */
        }
        if (ast) {
            cacheAST[filePath] = ast;
        }
    }
    const ast = cacheAST[filePath];
    if (ast) {
        return cloneNode(ast);
    }
    return null;
}

export function getNodePath(filePath: string): NodePath<Program> | null {
    return getProgramPath(getAST(filePath));
}

export function makeGetAST() {
    const cacheAST: Record<string, ParseResult<File>> = {};
    const modifiedAST: Set<string> = new Set();
    return {
        cacheAST,
        modifiedAST,
        getAST(filePath: string) {
            if (!path.isAbsolute(filePath)) {
                throw new Error("absolute expected");
            }
            if (!cacheAST[filePath]) {
                const fileContent = readFileSync(filePath, "utf-8");
                let ast;
                try {
                    ast = parse(fileContent, { parser });
                } catch {
                    console.log(`Error while parsing ${filePath}`);
                    ast = null;
                }
                cacheAST[filePath] = ast;
            }
            return cacheAST[filePath];
        },
        tagAsModified(...filePaths: string[]) {
            for (const filePath of filePaths) {
                modifiedAST.add(filePath);
            }
        },
        isModified(filePath: string) {
            return modifiedAST.has(filePath);
        },
    };
}

export function executeOnJsFilesInDir(
    dirPath: string,
    env: PartialEnv,
    operation: (env: Env) => void,
) {
    const fsDir = opendirSync(dirPath);
    let fsDirent;
    while ((fsDirent = fsDir.readSync())) {
        const direntPath = path.join(dirPath, fsDirent.name);
        if (fsDirent.isFile() /*&& direntPath.includes("/static/") **/) {
            operation({ ...env, filePath: direntPath });
        } else if (
            fsDirent.isDirectory() &&
            fsDirent.name !== "node_modules" &&
            !direntPath.includes("/static/lib") &&
            !direntPath.includes("/.git/") //&& !direntPath.includes("/tests/") // remove
        ) {
            executeOnJsFilesInDir(direntPath, env, operation);
        }
    }
    fsDir.closeSync();
}

const OPERATIONS: Record<string, (env: Env) => void> = {
    view_object_to_controller,
    remove_odoo_module_comment,
    group_imports,
    remove_unused_imports,
};

export function processOperation(operation: string) {
    const operations: ((env: Env) => void)[] = [];
    for (const op of operation.split(",")) {
        if (!OPERATIONS[op]) {
            throw new Error(`Operation: ${op} not known`);
        }
        operations.push(OPERATIONS[op]);
    }
    return operations;
}

// TO IMPROVE
export function processAddonsPath(addonsPath: string) {
    return addonsPath.split(",").map((dirPath) => {
        if (path.isAbsolute(dirPath)) {
            return dirPath;
        }
        return path.join(ODOO_PATH, dirPath);
    });
}

const SEP =
    "\n=====================================================================================================\n";
export function execute(
    operations: ((env: Env) => void)[],
    directoriesToProcess: string[],
    write = false,
) {
    const { cacheAST, modifiedAST, isModified, getAST, tagAsModified } = makeGetAST();
    for (const operation of operations) {
        const cleaning: Set<() => void> = new Set();
        const env = { getAST, tagAsModified, cleaning };
        for (const dirPath of directoriesToProcess) {
            executeOnJsFilesInDir(dirPath, env, operation);
        }
        for (const fn of cleaning) {
            fn();
        }
        let count = 1;
        for (const filePath in cacheAST) {
            if (!isModified(filePath)) {
                continue;
            }
            const ast = cacheAST[filePath];
            delete cacheAST[filePath];
            const result = print(ast);
            if (write) {
                writeFileSync(filePath, result.code);
            } else {
                console.log(SEP, `(${count}) `, filePath, SEP);
                console.log(result.code);
                count++;
            }
        }
        modifiedAST.clear();
    }
}
