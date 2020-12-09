import { Registries } from "../../../src/types";
import * as QUnit from "qunit";
import { ViewDescription } from "../../../src/services/view_manager";
import { SearchModel } from "../../../src/views/view_utils/search_model";
import { Fields } from "../../../src/views/graph/view";
import { makeFakeUserService, makeTestEnv, OdooEnv } from "../../helpers/index";
import { Domain } from "../../../src/core/domain";
import { Registry } from "../../../src/core/registry";
import { Context } from "../../../src/core/context";
import { GroupBy as GroupByObject } from "../../../src/views/view_utils/group_by";

let serviceRegistry: Registries["serviceRegistry"];

let env: OdooEnv;
let fields: Fields;

async function getLoadedModel(
  env: OdooEnv,
  modelParams?: Partial<{
    context: Context;
    domain: Domain;
    modelName: string;
    searchViewDescription: Partial<ViewDescription>;
  }>
) {
  let { context, domain, modelName, searchViewDescription } = modelParams || {};
  let { arch, fields, irFilters, view_id } = searchViewDescription || {};
  const model = new SearchModel(env);
  await model.load({
    context: context || {},
    domain: domain || new Domain([]),
    modelName: modelName || "",
    searchViewDescription: {
      arch: arch || `<search/>`,
      fields: fields || {},
      irFilters: irFilters || [],
      type: "search",
      view_id: view_id || 1,
    },
  });
  return model;
}

function sanitizeSearchItems(model: SearchModel) {
  const searchItems = Object.values(model.searchItems);
  return searchItems.map((searchItem) => {
    const copy = Object.assign({}, searchItem);
    delete copy.groupId;
    delete copy.groupNumber;
    delete copy.id;
    if (searchItem.type === "favorite") {
      copy.groupBys = (searchItem.groupBys as GroupByObject[]).map((g) => g.toJSON());
    }
    return copy;
  });
}

QUnit.module(
  "Model",
  {
    async beforeEach() {
      fields = {
        display_name: { string: "Displayed name", type: "char" },
        foo: {
          string: "Foo",
          type: "char",
          default: "My little Foo Value",
          store: true,
          sortable: true,
        },
        date_field: { string: "Date", type: "date", store: true, sortable: true },
        float_field: { string: "Float", type: "float" },
        bar: { string: "Bar", type: "many2one", relation: "partner" },
      };

      env = await makeTestEnv({});
    },
  },
  () => {
    QUnit.module("Arch parsing");

    QUnit.test("empty arch", async function (assert) {
      assert.expect(1);
      const model = await getLoadedModel(env);
      assert.deepEqual(sanitizeSearchItems(model), []);
    });

    QUnit.test("one field tag", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <field name="bar"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Bar",
          fieldName: "bar",
          fieldType: "many2one",
          type: "field",
        },
      ]);
    });

    QUnit.test("one separator tag", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <separator/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), []);
    });

    QUnit.test("one separator tag and one field tag", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <separator/>
                <field name="bar"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Bar",
          fieldName: "bar",
          fieldType: "many2one",
          type: "field",
        },
      ]);
    });

    QUnit.test("one filter tag", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <filter name="filter" string="Hello" domain="[]"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Hello",
          domain: new Domain("[]"),
          type: "filter",
        },
      ]);
    });

    QUnit.test("one filter tag with date attribute", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <filter name="date_filter" string="Date" date="date_field"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      const dateFilterId = model.getSearchItems((f) => f.type === "dateFilter")[0].id!;
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          defaultGeneratorId: "this_month",
          description: "Date",
          fieldName: "date_field",
          fieldType: "date",
          type: "dateFilter",
        },
        {
          comparisonOptionId: "previous_period",
          dateFilterId,
          description: "Date: Previous Period",
          type: "comparison",
        },
        {
          comparisonOptionId: "previous_year",
          dateFilterId,
          description: "Date: Previous Year",
          type: "comparison",
        },
      ]);
    });

    QUnit.test("one groupBy tag", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <filter name="groupby" string="Hi" context="{ 'group_by': 'date_field:day'}"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          defaultIntervalId: "day",
          description: "Hi",
          fieldName: "date_field",
          fieldType: "date",
          type: "groupBy",
        },
      ]);
    });

    QUnit.test("two filter tags", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <filter name="filter_1" string="Hello One" domain="[]"/>
                <filter name="filter_2" string="Hello Two" domain="[('bar', '=', 3)]"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Hello One",
          domain: new Domain("[]"),
          type: "filter",
        },
        {
          description: "Hello Two",
          domain: new Domain("[('bar', '=', 3)]"),
          type: "filter",
        },
      ]);
    });

    QUnit.test("two filter tags separated by a separator", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <filter name="filter_1" string="Hello One" domain="[]"/>
                <separator/>
                <filter name="filter_2" string="Hello Two" domain="[('bar', '=', 3)]"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Hello One",
          domain: new Domain("[]"),
          type: "filter",
        },
        {
          description: "Hello Two",
          domain: new Domain("[('bar', '=', 3)]"),
          type: "filter",
        },
      ]);
    });

    QUnit.test("one filter tag and one field", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <filter name="filter" string="Hello" domain="[]"/>
                <field name="bar"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Hello",
          domain: new Domain("[]"),
          type: "filter",
        },
        {
          description: "Bar",
          fieldName: "bar",
          fieldType: "many2one",
          type: "field",
        },
      ]);
    });

    QUnit.test("two field tags", async function (assert) {
      assert.expect(1);
      const arch = `
            <search>
                <field name="foo"/>
                <field name="bar"/>
            </search>`;
      const model = await getLoadedModel(env, { searchViewDescription: { arch, fields } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Foo",
          fieldName: "foo",
          fieldType: "char",
          type: "field",
        },
        {
          description: "Bar",
          fieldName: "bar",
          fieldType: "many2one",
          type: "field",
        },
      ]);
    });

    QUnit.module("Preparing initial state");

    QUnit.test("process favorite filters", async function (assert) {
      assert.expect(1);
      const irFilters = [
        {
          user_id: [2, "Mitchell Admin"] as [number, string],
          name: "Sorted filter",
          id: 5,
          context: `{"group_by":["foo","bar"]}`,
          sort: '["foo", "-bar"]',
          domain: "[('user_id', '=', uid)]",
          is_default: false,
        },
      ];

      serviceRegistry = new Registry();
      const fakeUserService = makeFakeUserService();
      serviceRegistry.add(fakeUserService.name, fakeUserService);
      env = await makeTestEnv({ serviceRegistry });

      const model = await getLoadedModel(env, { searchViewDescription: { irFilters } });
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          context: {},
          description: "Sorted filter",
          domain: new Domain("[('user_id', '=', uid)]"),
          groupBys: ["foo", "bar"],
          orderedBy: [
            {
              asc: true,
              name: "foo",
            },
            {
              asc: false,
              name: "bar",
            },
          ],
          removable: true,
          serverSideId: 5,
          type: "favorite",
          userId: 2,
        },
      ]);
    });

    QUnit.skip("process dynamic filters", async function (assert) {
      // assert.expect(1);
      // const dynamicFilters = [{
      //     description: 'Quick search',
      //     domain: [['id', 'in', [1, 3, 4]]]
      // }];
      // const model = await getLoadedModel(env, { dynamicFilters });
      // assert.deepEqual(sanitizeSearchElements(model), [
      //     {
      //         description: 'Quick search',
      //         domain: new Domain("[[\"id\",\"in\",[1,3,4]]]"),
      //         isDefault: true,
      //         type: 'filter'
      //     },
      // ]);
    });

    QUnit.test("falsy search defaults are not activated", async function (assert) {
      assert.expect(1);

      const context = {
        search_default_filter: false,
        search_default_bar: 0,
        search_default_groupby: 2,
      };
      const arch = `
            <search>
                <filter name="filter" string="Hello" domain="[]"/>
                <filter name="groupby" string="Goodbye" context="{'group_by': 'foo'}"/>
                <field name="bar"/>
            </search>`;
      const model = await getLoadedModel(env, { context, searchViewDescription: { arch, fields } });
      // only the truthy filter 'groupby' has isDefault true
      assert.deepEqual(sanitizeSearchItems(model), [
        {
          description: "Hello",
          domain: new Domain("[]"),
          type: "filter",
        },
        {
          description: "Bar",
          fieldName: "bar",
          fieldType: "many2one",
          type: "field",
        },
        {
          defaultRank: 2,
          description: "Goodbye",
          fieldName: "foo",
          fieldType: "char",
          isDefault: true,
          type: "groupBy",
        },
      ]);
    });
  }
);
