/** @odoo-module */

import { Component, useRef, useState, xml } from "@odoo/owl";
import { defineRootNode } from "../../hoot-dom/helpers/dom";
import { createUrl } from "../core/url";
import { useTrustedListener } from "../hoot_utils";
import { HootButtons } from "./hoot_buttons";
import { HootConfigDropdown } from "./hoot_config_dropdown";
import { HootDebugToolBar } from "./hoot_debug_toolbar";
import { HootPresets } from "./hoot_presets";
import { HootReporting } from "./hoot_reporting";
import { HootSearch } from "./hoot_search";
import { HootSideBar } from "./hoot_side_bar";
import { HootStatusPanel } from "./hoot_status_panel";

/**
 * @typedef {{
 * }} HootMainProps
 */

//-----------------------------------------------------------------------------
// Global
//-----------------------------------------------------------------------------

const { setTimeout } = globalThis;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/** @extends {Component<HootMainProps, import("../hoot").Environment>} */
export class HootMain extends Component {
    static components = {
        HootButtons,
        HootConfigDropdown,
        HootDebugToolBar,
        HootPresets,
        HootReporting,
        HootSearch,
        HootSideBar,
        HootStatusPanel,
    };

    static props = {};

    static template = xml`
        <t t-if="env.runner.config.headless">
            <div class="absolute bottom-0 start-1/2 -translate-x-1/2
                flex z-4 mb-4 px-4 py-2 gap-2 whitespace-nowrap
                text-xl rounded-full shadow bg-gray-200 dark:bg-gray-800"
            >
                Running in headless mode
                <a class="text-primary hoot-link" t-att-href="createUrl({ headless: null })">
                    Run with UI
                </a>
            </div>
        </t>
        <t t-else="">
            <main
                class="${HootMain.name} flex flex-col w-full h-full bg-base relative"
                t-att-class="{ 'hoot-animations': env.runner.config.fun }"
            >
                <header class="flex flex-col bg-gray-200 dark:bg-gray-800">
                    <nav class="hoot-controls py-1 px-2">
                        <h1
                            class="hoot-logo m-0 select-none"
                            title="Hierarchically Organized Odoo Tests"
                        >
                            <strong class="flex">HOOT</strong>
                        </h1>
                        <HootButtons />
                        <HootSearch />
                        <div class="flex gap-1">
                            <HootPresets />
                            <HootConfigDropdown />
                        </div>
                    </nav>
                </header>
                <HootStatusPanel />
                <div class="flex h-full overflow-y-auto">
                    <HootSideBar />
                    <HootReporting />
                </div>
            </main>
            <t t-if="state.debugTest">
                <HootDebugToolBar test="state.debugTest" />
            </t>
        </t>
        <t t-if="!state.iframeLoaded">
            <div class="absolute w-full h-full top-0 flex flex-col gap-4 justify-center items-center backdrop-blur">
                <h3>
                    <t t-if="env.runner.state.url">
                        Loading tests from
                        <span class="text-primary" t-esc="env.runner.state.url" />
                    </t>
                    <t t-else="">
                        <span class="text-fail">No URL given</span>
                    </t>
                </h3>
                <div
                    class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
                    role="status"
                    title="Loading"
                />
            </div>
        </t>
        <iframe
            t-ref="iframe"
            class="hoot-fixture"
            t-att-class="{ 'z-1': state.debugTest }"
            t-att-src="env.runner.state.url"
            t-on-load="() => (this.state.iframeLoaded = true)"
        />
    `;

    createUrl = createUrl;
    escapeKeyPresses = 0;

    setup() {
        const { runner } = this.env;
        this.iframeRef = useRef("iframe");
        this.state = useState({
            debugTest: null,
            iframeLoaded: false,
        });

        defineRootNode(() => this.iframeRef.el?.contentDocument);

        runner.beforeEach(() => {
            this.withIframeWindow((win) => {
                win.getSelection().removeAllRanges();
                win.document.body?.remove();
                win.document.body = win.document.createElement("body");
            });
        });

        runner.beforeAll(() => {
            if (runner.debug) {
                if (runner.debug === true) {
                    this.state.debugTest = runner.state.tests[0];
                } else {
                    this.state.debugTest = runner.debug;
                }
            }
            const onError = runner._handleError.bind(runner);
            this.withIframeWindow((win) => {
                win.addEventListener("error", onError);
                win.addEventListener("unhandledrejection", onError);
                win.addEventListener("keydown", (ev) => ev.isTrusted && this.onWindowKeyDown(ev));
            });
        });
        runner.afterAll(() => {
            this.state.debugTest = null;
        });

        useTrustedListener(window, "keydown", (ev) => this.onWindowKeyDown(ev), { capture: true });
        useTrustedListener(window, "resize", (ev) => this.onWindowResize(ev));
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onWindowKeyDown(ev) {
        const { runner } = this.env;
        switch (ev.key) {
            case "d": {
                if (ev.altKey) {
                    ev.preventDefault();
                    runner.config.debugTest = !runner.config.debugTest;
                }
                break;
            }
            case "Enter": {
                if (runner.state.status === "ready") {
                    ev.preventDefault();
                    runner.start();
                }
                break;
            }
            case "Escape": {
                this.escapeKeyPresses++;
                setTimeout(() => this.escapeKeyPresses--, 500);

                if (ev.ctrlKey && runner.config.debugTest) {
                    runner.config.debugTest = false;
                }
                if (runner.state.status === "running" && this.escapeKeyPresses >= 2) {
                    ev.preventDefault();
                    runner.stop();
                }
                break;
            }
        }
    }

    onWindowResize() {
        this.env.runner.checkPresetForViewPort();
    }

    /**
     * @param {(iframeWindow: Window) => any} callback
     */
    withIframeWindow(callback) {
        const iframeWindow = this.iframeRef.el?.contentWindow;
        if (iframeWindow) {
            callback(iframeWindow);
        }
    }
}
