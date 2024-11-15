import { expect, test } from "@odoo/hoot";
import { animationFrame, click } from "@odoo/hoot-dom";
import { defineWebsiteModels, openSnippetsMenu, setupWebsiteBuilder } from "./helpers";

defineWebsiteModels();

test("Toggle the overlays when clicking on a toolbox element", async () => {
    // TODO improve when more toolboxes will be defined.
    await setupWebsiteBuilder(`
        <section>
            <div class="row">
                <div class="col-lg-3">
                    <p>TEST</p>
                </div>
            </div>
        </section>
    `);
    await openSnippetsMenu();
    await click(":iframe section");
    await animationFrame();
    expect(".oe_overlay").toHaveCount(1);
    expect(".oe_overlay").toHaveRect(":iframe section");

    await click(":iframe .col-lg-3");
    await animationFrame();
    expect(".oe_overlay").toHaveCount(2);
    expect(".oe_overlay.oe_active").toHaveCount(1);
    expect(".oe_overlay.oe_active").toHaveRect(":iframe .col-lg-3");
});
