/** @odoo-module **/

import { Component, onMounted, useRef, useState, useSubEnv } from "@odoo/owl";
import { document, matchMedia, navigator } from "../globals";
import { cleanupDOM, config as domConfig } from "../helpers/dom";
import { compactXML, storage } from "../utils";
import { ConfigDropdown } from "./config_dropdown";
import { ICONS } from "./icons";
import { Reporting } from "./reporting";
import { RunAllButton } from "./run_all_button";
import { RunButton } from "./run_button";
import { RunFailedButton } from "./run_failed_button";
import { Search } from "./search";
import { StatusPanel } from "./status_panel";

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
        defaultScheme = matchMedia("prefers-color-scheme: dark") ? "dark" : "light";
        set(storageKey, defaultScheme);
    }

    const color = useState({ scheme: defaultScheme, toggle });

    return color;
}

function updateTitle(failed) {
    for (const prefix of Object.values(TITLE_PREFIX)) {
        if (document.title.startsWith(prefix)) {
            return;
        }
    }
    document.title = `${failed ? TITLE_PREFIX.fail : TITLE_PREFIX.success} ${document.title}`;
}

const COLOR_SCHEMES = ["dark", "light"];

const TITLE_PREFIX = {
    fail: "✖",
    success: "✔",
};

/** @extends Component<{}, import("../setup").Environment> */
export class Main extends Component {
    static components = {
        ConfigDropdown,
        RunAllButton,
        RunButton,
        RunFailedButton,
        Search,
        StatusPanel,
        Reporting,
    };

    static template = compactXML/* xml */ `
        <t t-if="env.runner.config.headless">
            Running in headless mode
        </t>
        <main t-else="" class="hoot-runner" t-att-class="color.scheme">
            <header class="hoot-panel hoot-col">
                <div class="hoot-panel-top hoot-gap-2 hoot-row">
                    <h1 class="hoot-logo hoot-text-primary" title="Hierarchically Organized Odoo Tests">
                        HOOT
                    </h1>
                    <span class="hoot-useragent hoot-truncate hoot-row">${navigator.userAgent}</span>
                    <button t-on-click="color.toggle" title="Toggle color scheme">
                        <t t-if="color.scheme === 'light'">${ICONS.moon}</t>
                        <t t-else="">${ICONS.sun}</t>
                    </button>
                </div>
                <nav class="hoot-controls">
                    <div class="hoot-buttons hoot-gap-1 hoot-row">
                        <RunButton />
                        <RunFailedButton />
                        <RunAllButton />
                    </div>
                    <Search />
                    <ConfigDropdown />
                </nav>
                <StatusPanel />
            </header>
            <Reporting />
        </main>
        <iframe t-ref="fixture" class="hoot-fixture" />
    `;

    setup() {
        const { runner } = this.env;

        useSubEnv({ runner, url: runner.url });

        let failed = false;
        this.color = useColorScheme("hoot-color-scheme");
        this.fixtureRef = useRef("fixture");

        // Event listeners

        runner.beforeAnyTest(() => {
            this.fixtureRef.el.innerHTML = "";
            if (runner.debug) {
                this.fixtureRef.el?.classList.add("hoot-debug");
            }
        });
        runner.afterAnyTest((test) => {
            if (!test.lastResults.pass) {
                failed = true;
            }
            this.fixtureRef.el?.classList.remove("hoot-debug");
        });
        runner.afterAll(() => {
            updateTitle(failed);
            cleanupDOM();
        });

        onMounted(async () => {
            if (domConfig.defaultRoot === null) {
                domConfig.defaultRoot = this.fixtureRef.el.contentDocument.body;
            }

            if (runner.config.autostart) {
                runner.start();
            }
        });
    }
}
