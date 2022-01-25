/* @odoo-module */

import { getFixture } from "@web/../tests/helpers/utils";

import { Transition } from "@web/core/transition";
import { makeDeferred, nextTick, patchWithCleanup } from "../helpers/utils";
import { browser } from "@web/core/browser/browser";

const { mount, Component, xml, useState } = owl;

QUnit.module("Transition Component", hooks => {

  const defaultTemplate = xml`<div id="node_1"/><div id="node_2"/>`;

  class Parent extends Component {
    setup() {
      this.state = useState({
        isVisible: this.props.isVisible,
        hasTransition: this.props.hasTransition,
      });
      this.calledTemplate = defaultTemplate;
    }
  }
  Parent.template = xml`
    <div>
      <Transition t-if="state.hasTransition" name="props.transitionName" isVisible="state.isVisible">
        <t t-call="{{ calledTemplate }}" />
      </Transition>
    </div>`;
  Parent.components = { Transition };

  let target;
  hooks.beforeEach(() => {
    target = getFixture();
  });

  QUnit.test("basic entering", async (assert) => {
    assert.expect(11);

    patchWithCleanup(browser, {
      async setTimeout(fn) {
        fn();
      }
    });
    const parent = await mount(Parent, target, {
      props: {
        transitionName: "basic",
      }
    });
    assert.containsNone(parent, "#node_1");
    parent.state.hasTransition = true;
    parent.state.isVisible = true;
    await nextTick();
    assert.containsOnce(parent, "#node_1");

    const nodes = target.querySelectorAll("#node_1, #node_2");
    assert.strictEqual(nodes.length, 2);
    for (const n of nodes) {
      assert.hasClass(n, "basic-enter basic-enter-active");
    }

    await nextTick();
    for (const n of nodes) {
      assert.doesNotHaveClass(n, "basic-enter");
      assert.hasClass(n, "basic-enter-to basic-enter-active");
    }

    nodes.forEach(el => el.dispatchEvent(new Event("transitionend", {bubbles: true})));
    for (const n of nodes) {
      assert.doesNotHaveClass(n, "basic-enter-to basic-enter-active basic-enter");
    }
  });

  QUnit.test("basic closing -- await transitionend", async (assert) => {
    assert.expect(13);

    let def;
    patchWithCleanup(browser, {
      async setTimeout(fn) {
        await def;
        fn();
      }
    });
    const parent = await mount(Parent, target, {
      props: {
        transitionName: "basic",
        isVisible: true,
        hasTransition: true,
      }
    });

    const nodes = target.querySelectorAll("#node_1, #node_2");
    assert.strictEqual(nodes.length, 2);

    nodes.forEach(el => el.dispatchEvent(new Event("transitionend", {bubbles: true})));
    await Promise.resolve();
    assert.containsOnce(parent, "#node_1");

    for (const n of nodes) {
      assert.deepEqual(Array.from(n.classList), []);
    }

    parent.state.isVisible = false;

    // Block the leaving timeout
    def = makeDeferred();
    await nextTick();

    console.log("ASSERT CLASSEs")
    for (const n of nodes) {
      assert.hasClass(n, "basic-leave basic-leave-active");
    }

    await nextTick();
    for (const n of nodes) {
      assert.ok(target.contains(n));
      assert.doesNotHaveClass(n, "basic-leave");
      assert.hasClass(n, "basic-leave-to basic-leave-active");
    }

    // unblock the setTimeout
    def = null;
    nodes.forEach(el => el.dispatchEvent(new Event("transitionend", {bubbles: true})));
    await nextTick();

    assert.containsNone(parent, "#node_1");
  });

  QUnit.test("basic closing -- do not await transitionend", async (assert) => {
    assert.expect(13);

    let def;
    patchWithCleanup(browser, {
      async setTimeout(fn) {
        await def;
        fn();
      }
    });
    const parent = await mount(Parent, target, {
      props: {
        transitionName: "basic",
        isVisible: true,
        hasTransition: true,
      }
    });

    const nodes = target.querySelectorAll("#node_1, #node_2");
    assert.strictEqual(nodes.length, 2);

    nodes.forEach(el => el.dispatchEvent(new Event("transitionend", {bubbles: true})));
    await Promise.resolve();
    assert.containsOnce(parent, "#node_1");

    for (const n of nodes) {
      assert.deepEqual(Array.from(n.classList), []);
    }

    parent.state.isVisible = false;

    // Block the leaving timeout
    def = makeDeferred();
    await nextTick();

    for (const n of nodes) {
      assert.hasClass(n, "basic-leave basic-leave-active");
    }

    await nextTick();
    for (const n of nodes) {
      assert.ok(target.contains(n));
      assert.doesNotHaveClass(n, "basic-leave");
      assert.hasClass(n, "basic-leave-to basic-leave-active");
    }

    def.resolve();
    await nextTick();

    assert.containsNone(parent, "#node_1");
  });

  QUnit.skip("concurrency: visible to not visible", async () => {});

});
