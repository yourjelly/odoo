import { WebClient } from "../../src/components/WebClient/WebClient";
import * as QUnit from "qunit";
import { makeTestEnv } from "../test_env";

QUnit.module("Web Client", () => {
  QUnit.test("can be rendered", async (assert) => {
    assert.expect(1);
    const env = await makeTestEnv();
    WebClient.env = env;
    const webClient = new WebClient(null);
    const fixture = document.querySelector("#qunit-fixture") as HTMLElement;
    await webClient.mount(fixture);
    assert.strictEqual(fixture.innerText, "NavBar\nHello WebClient\nHello Action");
  });
});
