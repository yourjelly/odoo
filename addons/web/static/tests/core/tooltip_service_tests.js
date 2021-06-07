/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { PopoverContainer } from "@web/core/popover/popover_container";
import { popoverService } from "@web/core/popover/popover_service";
import { registry } from "@web/core/registry";
import { tooltipService } from "@web/core/tooltip_service";
import { registerCleanup } from "../helpers/cleanup";
import { clearRegistryWithCleanup, makeTestEnv } from "../helpers/mock_env";
import { getFixture, nextTick, patchWithCleanup } from "../helpers/utils";

const { Component, mount } = owl;
const { xml } = owl.tags;

let fixture;
let mouseEnter = null;
let mouseLeave = null;

const mainComponents = registry.category("main_components");

class PseudoWebClient extends Component {
    setup() {
        this.Components = mainComponents.getEntries();
    }
}
PseudoWebClient.template = xml`
    <div>
        <div class="titled" title="a tooltip">Tooltiped</div>
        <t t-foreach="Components" t-as="Component" t-key="Component[0]">
            <t t-component="Component[1]"/>
        </t>
    </div>
`;

QUnit.module("Tooltip service", {
    async beforeEach() {
        registry.category("services").add("popover", popoverService);
        registry.category("services").add("tooltip", tooltipService);
        clearRegistryWithCleanup(mainComponents);
        mainComponents.add("PopoverContainer", PopoverContainer);

        patchWithCleanup(browser, {
            setTimeout: (handler, _, ...args) => handler(...args),
            clearTimeout: () => {},
        });
        patchWithCleanup(document, {
            addEventListener(name, handler) {
                if (name === "mouseenter") {
                    mouseEnter = (ev) => {
                        handler(ev);
                        return nextTick();
                    };
                } else if (name === "mouseleave") {
                    mouseLeave = (ev) => {
                        handler(ev);
                        return nextTick();
                    };
                }
            },
        });

        fixture = getFixture();
        const pseudoWebClient = await mount(PseudoWebClient, {
            env: await makeTestEnv(),
            target: fixture,
        });
        registerCleanup(() => {
            pseudoWebClient.destroy();
        });
    },
});

QUnit.test("hovering el with title attr opens tooltip", async (assert) => {
    assert.containsNone(fixture, ".o_custom_tooltip");

    const tooltiped = fixture.querySelector(".titled");
    assert.hasAttrValue(tooltiped, "title", "a tooltip");

    await mouseEnter({ target: tooltiped });
    assert.containsOnce(fixture, ".o_custom_tooltip");

    const tooltip = fixture.querySelector(".o_custom_tooltip");
    assert.strictEqual(tooltip.textContent, "a tooltip");
    assert.hasAttrValue(tooltiped, "title", undefined);

    await mouseLeave({ target: tooltiped });
    assert.containsNone(fixture, ".o_custom_tooltip");
    assert.hasAttrValue(tooltiped, "title", "a tooltip");
});
