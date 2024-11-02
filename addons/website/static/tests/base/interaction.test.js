import { expect, test } from "@odoo/hoot";

import { startInteraction } from "../base/helpers";
import { Interaction } from "@website/base/interaction";
import { animationFrame, click } from "@odoo/hoot-dom";


test("can add a listener on a single element", async () => {
    let clicked = false;
    class Test extends Interaction {
        static selector=".test";
        static dynamicContent = {
            "span:t-on-click": "doSomething"
        }
        doSomething() {
            clicked = true;
        }
    }
    
    const { el } = await startInteraction(Test, `
      <div class="test">
        <span>coucou</span>
      </div>`);
    expect(clicked).toBe(false);
    await click(el.querySelector("span"));
    expect(clicked).toBe(true);
});

test("can add a listener on a multiple elements", async () => {
    let clicked = 0;
    class Test extends Interaction {
        static selector=".test";
        static dynamicContent = {
            "span:t-on-click": "doSomething"
        }
        doSomething() {
            clicked++;
        }
    }
    
    const { el } = await startInteraction(Test, `
      <div class="test">
        <span>coucou1</span>
        <span>coucou2</span>
      </div>`);
    expect(clicked).toBe(0);
    for (let span of el.querySelectorAll("span")) {
        await click(span);
    }
    expect(clicked).toBe(2);
});
