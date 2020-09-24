import { WebClient } from "../../src/components/WebClient/WebClient";
import * as QUnit from "qunit";

QUnit.module("Web Client", () => {
  QUnit.test("can be rendered", async (assert) => {
    assert.expect(1);
    const webClient = new WebClient(null);
    const fixture = document.querySelector("#qunit-fixture") as HTMLElement;
    await webClient.mount(fixture);
    assert.strictEqual(fixture.innerText, "Hello World");
  });
});
