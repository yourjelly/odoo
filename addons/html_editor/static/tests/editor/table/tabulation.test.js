/** @odoo-module */

import { describe, test } from "@odoo/hoot";
import { dispatch } from "@odoo/hoot-dom";
import { testEditor } from "../../helpers";
import { unformat } from "../../utils";

describe("move selection with tab/shift+tab", () => {
    describe("tab", () => {
        test("should move cursor to next cell and select its content", async () => {
            await testEditor({
                contentBefore: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>[]ab</td>
                                <td>cd</td>
                                <td>ef</td>
                            </tr>
                        </tbody>
                    </table>
                `),
                stepFunction: async (editor) =>
                    dispatch(editor.editable, "keydown", { key: "Tab" }),
                contentAfter: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>ab</td>
                                <td>[cd]</td>
                                <td>ef</td>
                            </tr>
                        </tbody>
                    </table>
                `),
            });
        });
        test("should move cursor to next cell in the row below and select its content", async () => {
            await testEditor({
                contentBefore: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>ab</td>
                                <td>[cd]</td>
                            </tr>
                            <tr>
                                <td>ef</td>
                                <td>gh</td>
                            </tr>
                        </tbody>
                    </table>
                `),
                stepFunction: async (editor) =>
                    dispatch(editor.editable, "keydown", { key: "Tab" }),
                contentAfter: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>ab</td>
                                <td>cd</td>
                            </tr>
                            <tr>
                                <td>[ef]</td>
                                <td>gh</td>
                            </tr>
                        </tbody>
                    </table>
                `),
            });
        });
    });
    describe("shift+tab", () => {
        test("should move cursor to previous cell and select its content", async () => {
            await testEditor({
                contentBefore: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>ab</td>
                                <td>[]cd</td>
                                <td>ef</td>
                            </tr>
                        </tbody>
                    </table>
                `),
                stepFunction: async (editor) =>
                    dispatch(editor.editable, "keydown", { key: "Tab", shiftKey: true }),
                contentAfter: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>[ab]</td>
                                <td>cd</td>
                                <td>ef</td>
                            </tr>
                        </tbody>
                    </table>
                `),
            });
        });
        test("should move cursor to previous cell in the row above and select its content", async () => {
            await testEditor({
                contentBefore: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>ab</td>
                                <td>cd</td>
                            </tr>
                            <tr>
                                <td>[ef]</td>
                                <td>gh</td>
                            </tr>
                        </tbody>
                    </table>
                `),
                stepFunction: async (editor) =>
                    dispatch(editor.editable, "keydown", { key: "Tab", shiftKey: true }),
                contentAfter: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>ab</td>
                                <td>[cd]</td>
                            </tr>
                            <tr>
                                <td>ef</td>
                                <td>gh</td>
                            </tr>
                        </tbody>
                    </table>
                `),
            });
        });
        test("should not cursor if there is not previous cell", async () => {
            await testEditor({
                contentBefore: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>[ab]</td>
                                <td>cd</td>
                                <td>ef</td>
                            </tr>
                        </tbody>
                    </table>
                `),
                stepFunction: async (editor) =>
                    dispatch(editor.editable, "keydown", { key: "Tab", shiftKey: true }),
                contentAfter: unformat(`
                    <table>
                        <tbody>
                            <tr>
                                <td>[ab]</td>
                                <td>cd</td>
                                <td>ef</td>
                            </tr>
                        </tbody>
                    </table>
                `),
            });
        });
    });
});
