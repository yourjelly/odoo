/** @odoo-module **/

import { getFixture, nextTick } from "../../helpers/utils";
import { makeFakeUserService } from "../../helpers/mock_services";
import { makeTestEnv } from "../../helpers/mock_env";
import { ormService } from "@web/services/orm_service";
import { viewService } from "@web/views/view_service";
import { WithSearch } from "@web/views/search/with_search/with_search";
import { hotkeyService } from "@web/hotkeys/hotkey_service";
import { toggleFilterMenu, toggleGroupByMenu, toggleMenuItem } from "../../helpers/control_panel";
import { findItem } from "../../helpers/dom";
import { makeWithSearch } from "./helpers";
import { serviceRegistry } from "@web/webclient/service_registry";

const { Component, hooks, mount, tags } = owl;
const { useState } = hooks;
const { xml } = tags;

let testConfig;

QUnit.module("Search", (hooks) => {
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
        "animal,false,search": `<search/>`,
        "animal,1,search": `
          <search>
            <filter name="filter" string="True domain" domain="[(1, '=', 1)]"/>
            <filter name="group_by" context="{ 'group_by': 'name' }"/>
          </search>
        `,
      },
    };

    const fakeUserService = makeFakeUserService();

    serviceRegistry.add("hotkey", hotkeyService);
    serviceRegistry.add("orm", ormService)
    serviceRegistry.add("user", fakeUserService)
    serviceRegistry.add("view", viewService);

    testConfig = { serverData, serviceRegistry };
  });

  QUnit.module("WithSearch component");

  QUnit.test("simple rendering", async function (assert) {
    assert.expect(2);

    class TestComponent extends Component {}
    TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

    const component = await makeWithSearch(
      { testConfig },
      {
        modelName: "animal",
        Component: TestComponent,
      }
    );
    assert.hasClass(component.el, "o_test_component");
    assert.strictEqual(component.el.innerText, "Test component content");
  });

  QUnit.test("simple rendering with loadSearchPanel='true'", async function (assert) {
    assert.expect(1);

    class TestComponent extends Component {}
    TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

    const component = await makeWithSearch(
      { testConfig },
      {
        modelName: "animal",
        Component: TestComponent,
        loadSearchPanel: true,
      }
    );
    assert.hasClass(component.el, "o_test_component");
  });

  QUnit.test("search model in sub env", async function (assert) {
    assert.expect(1);

    class TestComponent extends Component {}
    TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

    const component = await makeWithSearch(
      { testConfig },
      {
        modelName: "animal",
        Component: TestComponent,
      }
    );
    assert.ok(component.env.searchModel);
  });

  QUnit.test(
    "search query props are passed as props to concrete component",
    async function (assert) {
      assert.expect(4);

      class TestComponent extends Component {
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
      TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

      await makeWithSearch(
        { testConfig },
        {
          modelName: "animal",
          Component: TestComponent,
          domain: [[0, "=", 1]],
          groupBy: ["birthday"],
          context: { key: "val" },
          orderBy: ["bar"],
        }
      );
    }
  );

  QUnit.test("do not load search view description by default", async function (assert) {
    assert.expect(1);

    class TestComponent extends Component {}
    TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

    await makeWithSearch(
      {
        testConfig,
        mockRPC: function (_, args) {
          if (args.method === "load_views") {
            throw new Error("No load_views should be done");
          }
        },
      },
      {
        modelName: "animal",
        Component: TestComponent,
      }
    );

    assert.ok(true);
  });

  QUnit.test(
    "load search view description if not provided and loadSearchView=true",
    async function (assert) {
      assert.expect(1);

      class TestComponent extends Component {}
      TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

      await makeWithSearch(
        {
          testConfig,
          mockRPC: function (_, args) {
            if (args.method === "load_views") {
              assert.deepEqual(args.kwargs, {
                context: {
                  allowed_company_ids: [1],
                  lang: "en",
                  tz: "taht",
                  uid: 7,
                },
                options: {
                  action_id: false,
                  load_filters: false,
                  toolbar: false,
                },
                views: [[false, "search"]],
              });
            }
          },
        },
        {
          modelName: "animal",
          Component: TestComponent,
          loadSearchView: true,
        }
      );
    }
  );

  QUnit.test(
    "do not load the search view description if provided even if loadSearchView=true",
    async function (assert) {
      assert.expect(1);

      class TestComponent extends Component {}
      TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

      await makeWithSearch(
        {
          testConfig,
          mockRPC: function (_, args) {
            if (args.method === "load_views") {
              throw new Error("No load_views should be done");
            }
          },
        },
        {
          modelName: "animal",
          Component: TestComponent,
          arch: "<search/>",
          fields: {},
          loadSearchView: true,
        }
      );
      assert.ok(true);
    }
  );

  QUnit.test(
    "load view description if it is not complete and loadSearchView=true",
    async function (assert) {
      assert.expect(1);

      class TestComponent extends Component {}
      TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

      await makeWithSearch(
        {
          testConfig,
          mockRPC: function (_, args) {
            if (args.method === "load_views") {
              assert.deepEqual(args.kwargs.options, {
                action_id: false,
                load_filters: true,
                toolbar: false,
              });
            }
          },
        },
        {
          modelName: "animal",
          Component: TestComponent,
          arch: "<search/>",
          fields: {},
          loadSearchView: true,
          loadFavorites: true,
        }
      );
    }
  );

  QUnit.test(
    "load view description with given id if it is not provided and loadSearchView=true",
    async function (assert) {
      assert.expect(3);

      class TestComponent extends Component {}
      TestComponent.template = xml`
      <div class="o_test_component">
        <FilterMenu/>
        <GroupByMenu/>
      </div>
    `;

      const component = await makeWithSearch(
        {
          testConfig,
          mockRPC: function (_, args) {
            if (args.method === "load_views") {
              assert.deepEqual(args.kwargs.views, [[1, "search"]]);
            }
          },
        },
        {
          modelName: "animal",
          Component: TestComponent,
          viewId: 1,
          loadSearchView: true,
        }
      );
      await toggleFilterMenu(component);
      await assert.ok(findItem(component, ".o_menu_item", "True Domain"));

      await toggleGroupByMenu(component);
      await assert.ok(findItem(component, ".o_menu_item", "Name"));
    }
  );

  QUnit.test(
    "toggle a filter render the underlying component with an updated domain",
    async function (assert) {
      assert.expect(2);

      class TestComponent extends Component {
        async willStart() {
          assert.deepEqual(this.props.domain, []);
        }
        async willUpdateProps(nextProps) {
          assert.deepEqual(nextProps.domain, [[1, "=", 1]]);
        }
      }
      TestComponent.template = xml`
      <div class="o_test_component">
        <FilterMenu/>
      </div>
    `;

      const component = await makeWithSearch(
        { testConfig },
        {
          modelName: "animal",
          Component: TestComponent,
          viewId: 1,
          loadSearchView: true,
        }
      );
      await toggleFilterMenu(component);
      await toggleMenuItem(component, "True Domain");
    }
  );

  QUnit.test("react to prop 'domain' changes", async function (assert) {
    assert.expect(2);

    class TestComponent extends Component {
      willStart() {
        assert.deepEqual(this.props.domain, [["type", "=", "carnivorous"]]);
      }
      willUpdateProps(nextProps) {
        assert.deepEqual(nextProps.domain, [["type", "=", "herbivorous"]]);
      }
    }
    TestComponent.template = xml`<div class="o_test_component">Test component content</div>`;

    const env = await makeTestEnv(testConfig);
    const target = getFixture();

    class Parent extends Component {
      setup() {
        this.state = useState({
          modelName: "animal",
          Component: TestComponent,
          domain: [["type", "=", "carnivorous"]],
        });
      }
    }
    Parent.template = xml`<WithSearch t-props="state"/>`;
    Parent.components = { WithSearch };

    const parent = await mount(Parent, { env, target });

    parent.state.domain = [["type", "=", "herbivorous"]];

    await nextTick();

    parent.destroy();
  });
});
