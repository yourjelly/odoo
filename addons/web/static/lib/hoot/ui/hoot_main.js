/** @odoo-module */

import { Component, onMounted, onWillStart, useRef, useState, useSubEnv } from "@odoo/owl";
import { createURL } from "../core/url";
import { Promise, document, matchMedia } from "../globals";
import { config as domConfig } from "../helpers/dom";
import { compactXML, storage } from "../utils";
import { HootConfigDropdown } from "./hoot_config_dropdown";
import { HootReporting } from "./hoot_reporting";
import { HootRunAllButton } from "./hoot_run_all_button";
import { HootRunButton } from "./hoot_run_button";
import { HootRunFailedButton } from "./hoot_run_failed_button";
import { HootSearch } from "./hoot_search";

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {{
 *  crossorigin?: string;
 *  integrity?: string;
 *  url: string;
 *  type: "script" | "link";
 * }} params
 */
const importURL = async ({ crossorigin, integrity, type, url }) => {
    if (imported.has(url)) {
        return;
    }
    imported.add(url);
    const element = document.createElement(type);
    switch (type) {
        case "link": {
            element.setAttribute("rel", "stylesheet");
            element.setAttribute("href", url);
            break;
        }
        case "script": {
            element.setAttribute("src", url);
            break;
        }
    }

    if (integrity) {
        element.setAttribute("integrity", integrity);
    }
    if (crossorigin) {
        element.setAttribute("crossorigin", crossorigin);
    }

    element.setAttribute("data-no-import", true);

    return new Promise((resolve, reject) => {
        element.addEventListener("load", resolve);
        element.addEventListener("error", reject);

        document.head.appendChild(element);
    });
};

/**
 * @param {string} storageKey
 */
const useColorScheme = (storageKey) => {
    function toggle() {
        color.scheme = color.scheme === "dark" ? "light" : "dark";
        set(storageKey, color.scheme);
    }

    const { get, set } = storage("local");

    let defaultScheme = get(storageKey);
    if (!COLOR_SCHEMES.includes(defaultScheme)) {
        defaultScheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        set(storageKey, defaultScheme);
    }

    const color = useState({ scheme: defaultScheme, toggle });

    return color;
};

const updateTitle = (failed) => {
    const toAdd = failed ? TITLE_PREFIX.fail : TITLE_PREFIX.pass;
    if (document.title.startsWith(toAdd)) {
        return;
    }
    let title = document.title;
    for (const prefix of Object.values(TITLE_PREFIX)) {
        if (title.startsWith(prefix)) {
            title = title.slice(prefix.length);
            break;
        }
    }
    document.title = `${toAdd} ${title}`;
};

const COLOR_SCHEMES = ["dark", "light"];

const TITLE_PREFIX = {
    fail: "✖",
    pass: "✔",
};

const imported = new Set();

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/** @extends Component<{}, import("../hoot").Environment> */
export class HootMain extends Component {
    static components = {
        HootConfigDropdown,
        HootRunAllButton,
        HootRunButton,
        HootRunFailedButton,
        HootSearch,
        HootReporting,
    };

    static template = compactXML/* xml */ `
        <t t-if="env.runner.config.headless">
            Running in headless mode
            <a t-att-href="createURL({ headless: null })">
                Run with UI
            </a>
        </t>
        <main t-else="" class="hoot" t-attf-class="hoot-{{ color.scheme }}">
            <header class="hoot-panel d-flex flex-column">
                <nav class="hoot-controls d-flex flex-row align-items-center py-1 px-2 gap-4">
                    <h1 class="hoot-logo hoot-text-primary fw-bolder fs-4 user-select-none" title="Hierarchically Organized Odoo Tests">
                        HOOT
                    </h1>
                    <div class="hoot-buttons d-flex flex-row align-items-center overflow-hidden">
                        <HootRunButton />
                        <HootRunFailedButton />
                        <HootRunAllButton />
                    </div>
                    <HootSearch />
                    <HootConfigDropdown colorScheme="color.scheme" colorToggle="color.toggle" />
                </nav>
            </header>
            <HootReporting />
        </main>
        <iframe t-ref="fixture" class="hoot-fixture" />
    `;

    createURL = createURL;

    get fixtureDocument() {
        return this.fixtureRef.el?.contentDocument;
    }

    setup() {
        const { runner } = this.env;

        useSubEnv({ runner, url: runner.url });

        let failed = false;
        this.color = useColorScheme("color-scheme");
        this.fixtureRef = useRef("fixture");

        // Event listeners

        runner.beforeAll(() => {
            const { head } = this.fixtureDocument;
            const selectors = ["link", "script", "style"].map((s) => `${s}:not([data-no-import])`);
            for (const el of document.head.querySelectorAll(selectors.join(","))) {
                head.appendChild(el.cloneNode(true));
            }
        });
        runner.beforeAnyTest(() => {
            this.fixtureDocument.body.innerHTML = "";
            if (runner.debug) {
                this.fixtureRef.el.classList.add("hoot-debug");
            }
        });
        runner.afterAnyTest(({ lastResults }) => {
            if (!lastResults.pass) {
                failed = true;
            }
            this.fixtureRef.el.classList.remove("hoot-debug");
        });
        runner.afterAll(() => {
            updateTitle(failed);
        });

        onWillStart(async () => {
            if (!runner.config.headless) {
                await Promise.all([
                    importURL({
                        type: "link",
                        url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
                        integrity:
                            "sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN",
                        crossorigin: "anonymous",
                    }),
                    importURL({
                        type: "link",
                        url: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css",
                    }),
                ]);
            }
        });
        onMounted(async () => {
            if (domConfig.defaultRoot === null) {
                domConfig.defaultRoot = this.fixtureDocument.body;
            }

            if (!runner.config.manual) {
                // Allows DOM to be fully rendered before starting
                requestAnimationFrame(() => runner.start());
            }
        });
    }
}
