import { NavBar } from "../../src/components/NavBar/NavBar";
import * as QUnit from "qunit";

QUnit.module("NavBar", () => {
  QUnit.test("can be rendered", async (assert) => {
    assert.expect(1);
    const webClient = new NavBar(null);
    const fixture = document.querySelector("#qunit-fixture") as HTMLElement;
    await webClient.mount(fixture);
    assert.strictEqual(fixture.innerText, "NavBar");
  });
});
