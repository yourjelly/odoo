/** @odoo-module */

import { mount, reactive, whenReady } from "@odoo/owl";
import { getRunner } from "../hoot_globals";
import { generateStyleSheets, setColorRoot } from "./hoot_colors";
import { HootMain } from "./hoot_main";

/**
 * @typedef {"failed" | "passed" | "skipped" | "todo"} StatusFilter
 *
 * @typedef {ReturnType<typeof makeUiState>} UiState
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

const makeUiState = () =>
    reactive({
        resultsPage: 0,
        resultsPerPage: 40,
        /** @type {string | null} */
        selectedSuiteId: null,
        /** @type {"asc" | "desc" | false} */
        sortResults: false,
        /** @type {StatusFilter | null} */
        statusFilter: null,
        totalResults: 0,
    });

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function setupHootUI() {
    // - Mount the main UI component
    whenReady(() => {
        setColorRoot(document.body);

        const colorStyleElement = document.createElement("style");
        let colorStyleContent = "";
        for (const [className, content] of Object.entries(generateStyleSheets())) {
            const selector = className === "default" ? ":root" : `.${className}`;
            colorStyleContent += `${selector}{${content}}`;
        }
        colorStyleElement.innerText = colorStyleContent;
        document.head.appendChild(colorStyleElement);

        mount(HootMain, document.body, {
            // TODO <<< remove when lib is stable
            dev: true,
            warnIfNoStaticProps: true,
            // TODO >>>
            env: {
                runner: getRunner(),
                ui: makeUiState(),
            },
            name: "HOOT",
        });
    });
}
