import { expect, test } from "@odoo/hoot";
import { click, queryAll } from "@odoo/hoot-dom";
import { getService, mountWithCleanup } from "@web/../tests/web_test_helpers";

import { Breadcrumbs } from "@web/webclient/breadcrumbs/breadcrumbs";

test("rendering with previous and current", async () => {
    await mountWithCleanup(Breadcrumbs, {
        props: {
            breadcrumbs: [
                { jsId: "controller_7", name: "Previous" },
                { jsId: "controller_9", name: "Current" },
            ],
        },
    });

    const breadcrumbItems = queryAll(`.o_breadcrumb li.breadcrumb-item, .o_breadcrumb .active`);
    expect(breadcrumbItems).toHaveCount(2);
    expect(breadcrumbItems[0]).toHaveText("Previous");
    expect(breadcrumbItems[1]).toHaveText("Current");
    expect(breadcrumbItems[1]).toHaveClass("active");

    getService("action").restore = (jsId) => expect.step(jsId);
    click(breadcrumbItems[0]);
    expect.verifySteps(["controller_7"]);
});
