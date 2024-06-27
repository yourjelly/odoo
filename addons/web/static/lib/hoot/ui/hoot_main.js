/** @odoo-module */

import { Component, onMounted, useRef, useState, xml } from "@odoo/owl";
import { defineRootNode } from "../../hoot-dom/helpers/dom";
import { createURL } from "../core/url";
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
            Running in headless mode
            <a class="text-primary hoot-link" t-att-href="createURL({ headless: null })">
                Run with UI
            </a>
        </t>
        <t t-else="">
            <main
                t-ref="root"
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
            t-att-class="{ debug: state.debugTest }"
            t-att-src="env.runner.state.url"
            t-on-load="() => (this.state.iframeLoaded = true)"
        />
    `;

    createURL = createURL;
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

        if (!runner.config.headless) {
            // Since Chrome 125 and for God knows why the "pointer" event listeners
            // are all ignored in the HOOT UI, so the buttons appearing on hover
            // are never displayed.
            //
            // Now for some reason adding a SINGLE listener on ANY button seems
            // to solve this issue. I've looked into it for hours already and this
            // is as far as I'll go on this matter. Good luck to anyone trying to
            // debug this mess.
            const unstuckListeners = () => {
                if (listenersUnstuck || !rootRef.el) {
                    return;
                }
                listenersUnstuck = true;
                rootRef.el.querySelector("button").addEventListener(
                    "pointerenter",
                    () => {
                        // Leave this empty (CALLBACK CANNOT BE NULL OR UNDEFINED)
                    },
                    { once: true }
                );
            };

            const rootRef = useRef("root");
            let listenersUnstuck = false;

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
                    win.addEventListener(
                        "keydown",
                        (ev) => ev.isTrusted && this.onWindowKeyDown(ev)
                    );
                });
            });
            runner.afterAll(() => {
                this.state.debugTest = null;

                unstuckListeners();
            });

            onMounted(unstuckListeners);
            useTrustedListener(window, "keydown", (ev) => this.onWindowKeyDown(ev));
        }
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
