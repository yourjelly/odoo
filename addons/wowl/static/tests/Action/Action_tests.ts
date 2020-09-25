import { Action } from "../../src/components/Action/Action";
import * as QUnit from "qunit";
import { makeTestEnv } from "../test_env";

QUnit.module("Action", () => {
  QUnit.test("can be rendered", async (assert) => {
    assert.expect(1);
    const env = await makeTestEnv();
    Action.env = env;
    const action = new Action(null);
    const fixture = document.querySelector("#qunit-fixture") as HTMLElement;
    await action.mount(fixture);
    assert.strictEqual(fixture.innerText, "Hello Action");
  });
});
