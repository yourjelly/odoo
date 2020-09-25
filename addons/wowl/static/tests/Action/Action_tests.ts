import { Action } from "../../src/components/Action/Action";
import * as QUnit from "qunit";

QUnit.module("Action", () => {
  QUnit.test("can be rendered", async (assert) => {
    assert.expect(1);
    const webClient = new Action(null);
    const fixture = document.querySelector("#qunit-fixture") as HTMLElement;
    await webClient.mount(fixture);
    assert.strictEqual(fixture.innerText, "Hello Action");
  });
});
