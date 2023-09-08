/** @odoo-module **/

import { Component, onMounted, useRef, useState, useSubEnv } from "@odoo/owl";
import { createURL } from "../core/url";
import { document, matchMedia, navigator } from "../globals";
import { config as domConfig } from "../helpers/dom";
import { compactXML, storage } from "../utils";
import { HootConfigDropdown } from "./hoot_config_dropdown";
import { HootReporting } from "./hoot_reporting";
import { HootRunAllButton } from "./hoot_run_all_button";
import { HootRunButton } from "./hoot_run_button";
import { HootRunFailedButton } from "./hoot_run_failed_button";
import { HootSearch } from "./hoot_search";
import { HootStatusPanel } from "./hoot_status_panel";

let imported = false;
function importIcons() {
    if (imported) {
        return;
    }
    imported = true;
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute(
        "href",
        "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css"
    );
    link.setAttribute("data-no-import", true);
    document.head.appendChild(link);
}

/**
 * @param {string} storageKey
 */
function useColorScheme(storageKey) {
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
}

function updateTitle(failed) {
    const toAdd = failed ? TITLE_PREFIX.fail : TITLE_PREFIX.success;
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
}

const COLOR_SCHEMES = ["dark", "light"];

const TITLE_PREFIX = {
    fail: "✖",
    success: "✔",
};

/** @extends Component<{}, import("../setup").Environment> */
export class HootMain extends Component {
    static components = {
        HootConfigDropdown,
        HootRunAllButton,
        HootRunButton,
        HootRunFailedButton,
        HootSearch,
        HootStatusPanel,
        HootReporting,
    };

    static template = compactXML/* xml */ `
        <t t-if="env.runner.config.headless">
            Running in headless mode
            <a t-att-href="createURL({ headless: null })">
                Run with UI
            </a>
        </t>
        <main t-else="" class="hoot-runner" t-att-class="color.scheme">
            <header class="hoot-panel hoot-col">
                <div class="hoot-panel-top hoot-gap-2 hoot-row">
                    <h1 class="hoot-logo hoot-text-primary hoot-w-full hoot-text-xl hoot-select-none" title="Hierarchically Organized Odoo Tests">
                        HOOT
                    </h1>
                    <span class="hoot-text-muted hoot-truncate hoot-row hoot-text-sm">${navigator.userAgent}</span>
                    <button t-on-click="color.toggle" title="Toggle color scheme">
                        <i t-attf-class="bi bi-{{ color.scheme === 'light' ? 'moon' : 'sun' }}-fill" />
                    </button>
                </div>
                <nav class="hoot-controls hoot-gap-4">
                    <div class="hoot-buttons hoot-row">
                        <HootRunButton />
                        <HootRunFailedButton />
                        <HootRunAllButton />
                    </div>
                    <HootSearch />
                    <HootConfigDropdown />
                </nav>
                <HootStatusPanel />
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
        this.color = useColorScheme("hoot-color-scheme");
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
        runner.afterAnyTest((test) => {
            if (!test.lastResults.pass) {
                failed = true;
            }
            this.fixtureRef.el.classList.remove("hoot-debug");
        });
        runner.afterAll(() => {
            updateTitle(failed);
            // cleanupDOM();
        });

        onMounted(async () => {
            if (!runner.config.headless) {
                importIcons();
            }

            if (domConfig.defaultRoot === null) {
                domConfig.defaultRoot = this.fixtureDocument.body;
            }

            if (runner.config.autostart) {
                runner.start();
            }
        });
    }
}
