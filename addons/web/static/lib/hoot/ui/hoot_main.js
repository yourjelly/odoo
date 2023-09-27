/** @odoo-module */

import { Component, onMounted, useRef, useState, useSubEnv } from "@odoo/owl";
import { createURL } from "../core/url";
import { document, matchMedia } from "../globals";
import { getDocument, getFixture, setFixture } from "../helpers/dom";
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
                <nav class="hoot-controls py-1 px-2">
                    <h1 class="hoot-logo hoot-text-primary m-0 fw-bolder fs-4 user-select-none" title="Hierarchically Organized Odoo Tests">
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
        <div t-ref="fixture" class="hoot-fixture" />
    `;

    createURL = createURL;

    setup() {
        const { runner } = this.env;

        useSubEnv({ runner, url: runner.url });

        let failed = false;
        this.color = useColorScheme("color-scheme");
        this.fixtureRef = useRef("fixture");

        // Event listeners

        runner.beforeAnyTest(() => {
            if (runner.debug) {
                this.fixtureRef.el?.classList.add("hoot-debug");
            }
        });
        runner.afterAnyTest(({ lastResults }) => {
            if (!lastResults.pass) {
                failed = true;
            }
            this.fixtureRef.el?.classList.remove("hoot-debug");
        });
        runner.afterAll(() => {
            updateTitle(failed);
        });

        onMounted(async () => {
            if (!getFixture()) {
                setFixture(this.fixtureRef.el);
            }

            if (!runner.config.manual) {
                // Allows DOM to be fully rendered before starting
                requestAnimationFrame(() => runner.start());
            }
        });
    }
}
