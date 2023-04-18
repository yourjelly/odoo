import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import license from "rollup-plugin-license";

export default {
    input: "./src/client.js",
    output: [
        {
            banner: "/* @odoo-module */",
            file: "./bundle/discuss_sfu.js",
            format: "es",
        },
    ],
    plugins: [
        commonjs(),
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        license({
            thirdParty: {
                output: "./bundle/discuss_sfu.licenses.txt",
            },
        }),
    ],
};
