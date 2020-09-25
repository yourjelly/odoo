import { NavBar } from "../../src/components/NavBar/NavBar";
import * as QUnit from "qunit";
import { makeTestEnv } from "../test_env";

QUnit.module("NavBar", () => {
  QUnit.test("can be rendered", async (assert) => {
    assert.expect(1);
    const env = await makeTestEnv();
    NavBar.env = env;

    const webClient = new NavBar(null);
    const fixture = document.querySelector("#qunit-fixture") as HTMLElement;
    await webClient.mount(fixture);
    assert.strictEqual(fixture.innerText, "NavBar");
  });
});
