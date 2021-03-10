/** @odoo-module **/

import { makeView } from "../helpers";
import { getFixture, nextTick } from "../../helpers/utils";
import { makeTestEnv } from "../../helpers/mock_env";
import { View } from "@web/views/view_utils/view/view";
import { serviceRegistry } from "@web/webclient/service_registry";
import { viewRegistry } from "@web/views/view_registry";
import { makeFakeLocalizationService, makeFakeRouterService, makeFakeUIService, makeFakeUserService } from "../../helpers/mock_services";
import { actionService } from "@web/actions/action_service";
import { viewService } from "@web/views/view_service";
import { hotkeyService } from "@web/hotkeys/hotkey_service";
import { ormService } from "@web/services/orm_service";
import { effectService } from "@web/effects/effect_service";
import { notificationService } from "@web/notifications/notification_service";

const { Component, mount, hooks, tags } = owl;
const { useState } = hooks;
const { xml } = tags;

let testConfig;

QUnit.module("Views", (hooks) => {
  hooks.beforeEach(async () => {
    const serverData = {
      models: {
        animal: {
          fields: {
            id: { string: "Id", type: "integer" },
            name: { string: "Name", type: "char", store: true },
            birthday: { string: "Birthday", type: "date", store: true },
            type: {
              string: "Type",
              type: "selection",
              selection: [
                ["omnivorous", "Omnivorous"],
                ["herbivorous", "Herbivorous"],
                ["carnivorous", "Carnivorous"],
              ],
              store: true,
            },
          },
          records: [
            { id: 1, name: "Cat", birthday: "2021-05-26", type: "carnivorous" },
            { id: 2, name: "Dog", birthday: "2021-01-29", type: "carnivorous" },
            { id: 3, name: "Cow", birthday: "2021-07-15", type: "herbivorous" },
          ],
        },
      },
      views: {
        "animal,false,graph": `<graph/>`,
        "animal,1,graph": `<graph js_class="toy"/>`,
        "animal,false,toy": `<toy/>`,
        "animal,false,search": `<search/>`,
        "animal,1,search": `
          <search>
            <filter name="filter" domain="[(1, '=', 1)]"/>
            <filter name="group_by" context="{ 'group_by': 'name' }"/>
          </search>
        `,
      },
    };

    const fakeLocalizationService = makeFakeLocalizationService();
    const fakeUserService = makeFakeUserService();
    const fakeUIService = makeFakeUIService();
    const fakeRouterService = makeFakeRouterService();

    serviceRegistry.add("action", actionService);
    serviceRegistry.add("hotkey", hotkeyService);
    serviceRegistry.add("localization", fakeLocalizationService);
    serviceRegistry.add("orm", ormService);
    serviceRegistry.add("user", fakeUserService);
    serviceRegistry.add("view", viewService);
    serviceRegistry.add("effect", effectService);
    serviceRegistry.add("notification", notificationService);
    serviceRegistry.add("router", fakeRouterService);
    serviceRegistry.add("ui", fakeUIService);

    class ToyView extends Component {}
    ToyView.template = xml`<div class='o_toy_view'>Toy View content</div>`;
    ToyView.type = "toy";
    viewRegistry.add("toy", ToyView);

    testConfig = { serverData, serviceRegistry, viewRegistry };
  });

  QUnit.module("View component");

  QUnit.test("simple rendering", async function (assert) {
    assert.expect(1);
    const view = await makeView({ testConfig }, { modelName: "animal", type: "graph" });
    assert.hasClass(view.el, "o_action o_view_controller o_graph_view");
  });

  QUnit.test("simple rendering with given arch", async function (assert) {
    assert.expect(1);
    const view = await makeView(
      { testConfig },
      {
        modelName: "animal",
        type: "graph",
        arch: "<graph type='line'/>",
      }
    );
    assert.hasClass(view.el.querySelector(`.o_graph_button[data-mode="line"`), "active");
  });

  QUnit.test("simple rendering with given prop", async function (assert) {
    assert.expect(1);
    const view = await makeView({ testConfig }, { modelName: "animal", type: "graph", mode: "line" });
    assert.hasClass(view.el.querySelector(`.o_graph_button[data-mode="line"`), "active");
  });

  QUnit.test("simple rendering with given jsClass", async function (assert) {
    assert.expect(1);
    const view = await makeView({ testConfig }, { modelName: "animal", jsClass: "toy" });
    assert.strictEqual(view.el.innerText, "Toy View content");
  });

  QUnit.test("simple rendering with arch attribute 'js_class'", async function (assert) {
    assert.expect(1);
    const view = await makeView(
      { testConfig },
      {
        modelName: "animal",
        type: "graph",
        views: [[1, "graph"]],
      }
    );
    assert.strictEqual(view.el.innerText, "Toy View content");
  });

  QUnit.test(
    "search query props are passed as props to concrete view (default search arch)",
    async function (assert) {
      assert.expect(4);

      class ToyView extends Component {
        setup() {
          const { context, domain, groupBy, orderBy } = this.props;
          assert.deepEqual(context, {
            allowed_company_ids: [1],
            lang: "en",
            tz: "taht",
            uid: 7,
            key: "val",
          });
          assert.deepEqual(domain, [[0, "=", 1]]);
          assert.deepEqual(groupBy, ["birthday"]);
          assert.deepEqual(orderBy, ["bar"]);
        }
      }
      ToyView.template = xml`<div class="o_toy_view"/>`;
      ToyView.type = "toy";

      testConfig.viewRegistry.add("toy", ToyView, { force: true });

      await makeView(
        { testConfig },
        {
          modelName: "animal",
          jsClass: "toy",
          domain: [[0, "=", 1]],
          groupBy: ["birthday"],
          context: { key: "val" },
          orderBy: ["bar"],
        }
      );
    }
  );

  QUnit.test(
    "search query props are passed as props to concrete view (specific search arch)",
    async function (assert) {
      assert.expect(4);

      class ToyView extends Component {
        setup() {
          const { context, domain, groupBy, orderBy } = this.props;
          assert.deepEqual(context, {
            allowed_company_ids: [1],
            lang: "en",
            tz: "taht",
            uid: 7,
          });
          assert.deepEqual(domain, ["&", [0, "=", 1], [1, "=", 1]]);
          assert.deepEqual(groupBy, ["name"]);
          assert.deepEqual(orderBy, ["bar"]);
        }
      }
      ToyView.template = xml`<div class="o_toy_view"/>`;
      ToyView.type = "toy";

      testConfig.viewRegistry.add("toy", ToyView, { force: true });

      await makeView(
        { testConfig },
        {
          jsClass: "toy",
          modelName: "animal",
          views: [[1, "search"]],
          domain: [[0, "=", 1]],
          groupBy: ["birthday"],
          context: { search_default_filter: 1, search_default_group_by: 1 },
          orderBy: ["bar"],
        }
      );
    }
  );

  QUnit.test("react to prop 'domain' changes", async function (assert) {
    assert.expect(2);

    class ToyView extends Component {
      willStart() {
        assert.deepEqual(this.props.domain, [["type", "=", "carnivorous"]]);
      }
      willUpdateProps(nextProps) {
        assert.deepEqual(nextProps.domain, [["type", "=", "herbivorous"]]);
      }
    }
    ToyView.template = xml`<div class="o_toy_view"/>`;
    ToyView.type = "toy";

    testConfig.viewRegistry.add("toy", ToyView, { force: true });

    const env = await makeTestEnv(testConfig);
    const target = getFixture();

    class Parent extends Component {
      setup() {
        this.state = useState({
          type: "toy",
          modelName: "animal",
          domain: [["type", "=", "carnivorous"]],
        });
      }
    }
    Parent.template = xml`<View t-props="state"/>`;
    Parent.components = { View };

    const parent = await mount(Parent, { env, target });

    parent.state.domain = [["type", "=", "herbivorous"]];

    await nextTick();

    parent.destroy();
  });
});
