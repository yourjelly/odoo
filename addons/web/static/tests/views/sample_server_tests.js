odoo.define('web.sample_server_tests', function (require) {
    "use strict";

    const SampleServer = require('web.SampleServer');
    const session = require('web.session');
    const { mock } = require('web.test_utils');

    const EXPECTED_RECORDSET_SIZE = SampleServer.MAIN_RECORDSET_SIZE;
    const EXPECTED_SEARCH_READ_LIMIT = SampleServer.SEARCH_READ_LIMIT;
    const EXPECTED_COUNTRIES = SampleServer.SAMPLE_COUNTRIES;
    const EXPECTED_PEOPLE = SampleServer.SAMPLE_PEOPLE;
    const EXPECTED_TEXTS = SampleServer.SAMPLE_TEXTS;

    QUnit.module("Sample Server", {
        beforeEach() {
            this.fields = {
                'res.users': {
                    display_name: { string: "Name", type: 'char' },
                    name: { string: "Reference", type: 'char' },
                    email: { string: "Email", type: 'char' },
                    phone: { string: "Phone number", type: 'char' },
                    url: { string: "URL", type: 'char' },
                    alias: { string: "Alias", type: 'char' },
                    active: { string: "Active", type: 'boolean' },
                    is_alive: { string: "Is alive", type: 'boolean' },
                    description: { string: "Description", type: 'text' },
                    birthday: { string: "Birthday", type: 'date' },
                    arrival_date: { string: "Date of arrival", type: 'datetime' },
                    height: { string: "Height", type: 'float' },
                    color: { string: "Color", type: 'integer' },
                    age: { string: "Age", type: 'integer' },
                    salary: { string: "Salary", type: 'monetary' },
                    currency: { string: "Currency", type: 'many2one', relation: 'res.currency' },
                    manager_id: { string: "Manager", type: 'many2one', relation: 'res.users' },
                    managed_ids: { string: "Managing", type: 'one2many', relation: 'res.users' },
                    tag_ids: { string: "Tags", type: 'many2many', relation: 'tag' },
                    type: { string: "Type", type: 'selection', selection: [
                        ['client', "Client"], ['partner', "Partner"], ['employee', "Employee"]
                    ] },
                },
                'res.country': {
                    display_name: { string: "Name", type: 'char' },
                },
                'hobbit': {
                    display_name: { string: "Name", type: 'char' },
                    profession: { string: "Profession", type: 'selection', selection: [
                        ['gardener', "Gardener"], ['brewer', "Brewer"], ['adventurer', "Adventurer"]
                    ] },
                    age: { string: "Age", type: 'integer' },
                },
            };
        },
    }, function () {

        QUnit.module("Basic behaviour");

        QUnit.test("Basic instantiation", async function (assert) {
            assert.expect(2);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            // Data should not be generated yet
            assert.deepEqual(server.data.hobbit.fields, this.fields.hobbit);
            assert.deepEqual(server.data.hobbit.records, []);
        });

        QUnit.test("Sample data: people type + all field names", async function (assert) {
            assert.expect(24);

            mock.patch(session, {
                company_currency_id: 4,
            });

            const allFieldNames = Object.keys(this.fields['res.users']);
            const server = new SampleServer('res.users', this.fields['res.users']);
            const { records } = await server.mockRpc({
                method: '/web/dataset/search_read',
                model: 'res.users',
                fields: allFieldNames,
            });
            const rec = records[0];

            function assertFormat(fieldName, regex) {
                if (regex instanceof RegExp) {
                    assert.ok(
                        regex.test(rec[fieldName].toString()),
                        `Field "${fieldName}" has the correct format`
                    );
                } else {
                    assert.strictEqual(
                        typeof rec[fieldName], regex,
                        `Field "${fieldName}" is of type ${regex}`
                    );
                }
            }
            function assertBetween(fieldName, min, max, decimal = 1) {
                assert.ok(
                    min <= rec[fieldName] && rec[fieldName] < max &&
                    rec[fieldName].toString().split(".").length === decimal,
                    `Field "${fieldName}" is between ${min} and ${max} and is ${
                        decimal === 1 ? "an integer" : "a float number"
                    }`
                );
            }

            // Basic fields
            assert.ok(EXPECTED_PEOPLE.includes(rec.display_name));
            assert.ok(EXPECTED_PEOPLE.includes(rec.name));
            assertFormat('email', /sample\d@sample\.demo/);
            assertFormat('phone', /\+1 555 754 000\d/);
            assertFormat('url', /http:\/\/sample\d\.com/);
            assert.strictEqual(rec.alias, false);
            assert.strictEqual(rec.active, true);
            assertFormat('is_alive', 'boolean');
            assert.ok(EXPECTED_TEXTS.includes(rec.description));
            assertFormat('birthday', /\d{4}-\d{2}-\d{2}/);
            assertFormat('arrival_date', /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
            assertBetween('height', 0, 100, 2);
            assertBetween('color', 0, 8);
            assertBetween('age', 0, 100);
            assertBetween('salary', 0, 100000);

            const selectionValues = this.fields['res.users'].type.selection.map(
                (sel) => sel[0]
            );
            assert.ok(selectionValues.includes(rec.type));

            // Relational fields
            assert.strictEqual(rec.currency[0], 4);
            // Currently we expect the currency name to be a latin string, which
            // is not important; in most case we only need the ID. The following
            // assertion can be removed if needed.
            assert.ok(EXPECTED_TEXTS.includes(rec.currency[1]));

            assert.strictEqual(typeof rec.manager_id[0], 'number');
            assert.ok(EXPECTED_PEOPLE.includes(rec.manager_id[1]));

            assert.ok([1, 2].includes(rec.managed_ids.length));
            assert.ok(rec.managed_ids.every(
                (id) => typeof id === 'number')
            );

            assert.ok([1, 2].includes(rec.tag_ids.length));
            assert.ok(rec.tag_ids.every(
                (id) => typeof id === 'number')
            );

            mock.unpatch(session);
        });

        QUnit.test("Sample data: country type", async function (assert) {
            assert.expect(1);

            const server = new SampleServer('res.country', this.fields['res.country']);
            const { records } = await server.mockRpc({
                method: '/web/dataset/search_read',
                model: 'res.country',
                fields: ['display_name'],
            });

            assert.ok(EXPECTED_COUNTRIES.includes(records[0].display_name));
        });

        QUnit.test("Sample data: any type", async function (assert) {
            assert.expect(1);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const { records } = await server.mockRpc({
                method: '/web/dataset/search_read',
                model: 'hobbit',
                fields: ['display_name'],
            });

            assert.ok(EXPECTED_TEXTS.includes(records[0].display_name));
        });

        QUnit.test("Can mock", async function (assert) {
            assert.expect(4);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            assert.ok(server.canMock({ model: 'hobbit', route: '/web/dataset/search_read' }));
            assert.ok(server.canMock({ model: 'hobbit', method: 'read_group' }));
            assert.notOk(server.canMock({ model: 'hobbit', method: 'write' }));
            assert.notOk(server.canMock({ model: 'res.users', method: 'read_group' }));
        });

        QUnit.test("Is empty", async function (assert) {
            assert.expect(9);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            assert.strictEqual(server.isEmpty({ method: 'write' }, {}), false);

            // search read
            assert.strictEqual(
                server.isEmpty(
                    { route: '/web/dataset/search_read' },
                    { records: [{}], length: 1 }
                ),
                false
            );
            assert.strictEqual(
                server.isEmpty(
                    { route: '/web/dataset/search_read' },
                    { records: [], length: 0 }
                ),
                true
            );

            // web read group
            assert.strictEqual(
                server.isEmpty(
                    {
                        method: 'web_read_group',
                        model: 'hobbit',
                        groupBy: ['profession'],
                    },
                    { groups: [{ profession: 'adventurer', profession_count: 1 }] }
                ),
                false
            );
            assert.strictEqual(
                server.isEmpty(
                    {
                        method: 'web_read_group',
                        model: 'hobbit',
                        groupBy: ['profession'],
                    },
                    { groups: [{ profession: 'adventurer', profession_count: 0 }] }
                ),
                true
            );

            // read group
            assert.strictEqual(
                server.isEmpty(
                    {
                        method: 'read_group',
                        model: 'hobbit',
                        groupBy: ['profession'],
                    },
                    [{ __count: 1 }]
                ),
                false
            );
            assert.strictEqual(
                server.isEmpty(
                    {
                        method: 'read_group',
                        model: 'hobbit',
                        groupBy: ['profession'],
                    },
                    [{ __count: 0 }]
                ),
                true
            );

            // read progress bar
            assert.strictEqual(
                server.isEmpty({ method: 'read_progress_bar' }, { whatever: true }),
                false
            );
            assert.strictEqual(
                server.isEmpty({ method: 'read_progress_bar' }, {}),
                true
            );
        });

        QUnit.module("RPC calls");

        QUnit.test("Send 'search_read' RPC: valid field names", async function (assert) {
            assert.expect(3);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: '/web/dataset/search_read',
                model: 'hobbit',
                fields: ['display_name'],
            });

            assert.deepEqual(
                Object.keys(result.records[0]),
                ['id', 'display_name']
            );
            assert.strictEqual(result.length, EXPECTED_SEARCH_READ_LIMIT);
            assert.ok(/\w+/.test(result.records[0].display_name),
                "Display name has been mocked"
            );
        });

        QUnit.test("Send 'search_read' RPC: invalid field names", async function (assert) {
            assert.expect(3);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: '/web/dataset/search_read',
                model: 'hobbit',
                fields: ['name'],
            });

            assert.deepEqual(
                Object.keys(result.records[0]),
                ['id', 'name']
            );
            assert.strictEqual(result.length, EXPECTED_SEARCH_READ_LIMIT);
            assert.strictEqual(result.records[0].name, false,
                `Field "name" doesn't exist => returns false`
            );
        });

        QUnit.test("Send 'web_read_group' RPC: no group", async function (assert) {
            assert.expect(1);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'web_read_group',
                model: 'hobbit',
                groupBy: ['profession'],
            });

            assert.deepEqual(result, { groups: [], length: 0 });
        });

        QUnit.test("Send 'web_read_group' RPC: 2 groups", async function (assert) {
            assert.expect(6);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'web_read_group',
                model: 'hobbit',
                groupBy: ['profession'],
                fields: [],
            }, {
                groups: [
                    { profession: 'gardener', profession_count: 0 },
                    { profession: 'adventurer', profession_count: 0 },
                ],
            });

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result.groups.length, 2);

            const professions = result.groups.map((g) => g.profession);
            assert.ok(professions.includes("gardener"));
            assert.ok(professions.includes("adventurer"));

            assert.strictEqual(
                result.groups.reduce((acc, g) => acc + g.profession_count, 0),
                EXPECTED_RECORDSET_SIZE
            );
            assert.ok(
                result.groups.every((g) => g.profession_count === g.__data.length)
            );
        });

        QUnit.test("Send 'web_read_group' RPC: all groups", async function (assert) {
            assert.expect(7);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'web_read_group',
                model: 'hobbit',
                groupBy: ['profession'],
                fields: [],
            }, {
                groups: [
                    { profession: 'gardener', profession_count: 0 },
                    { profession: 'brewer', profession_count: 0 },
                    { profession: 'adventurer', profession_count: 0 },
                ],
            });

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result.groups.length, 3);

            const professions = result.groups.map((g) => g.profession);
            assert.ok(professions.includes("gardener"));
            assert.ok(professions.includes("brewer"));
            assert.ok(professions.includes("adventurer"));

            assert.strictEqual(
                result.groups.reduce((acc, g) => acc + g.profession_count, 0),
                EXPECTED_RECORDSET_SIZE
            );
            assert.ok(
                result.groups.every((g) => g.profession_count === g.__data.length)
            );
        });

        QUnit.test("Send 'read_group' RPC: no group", async function (assert) {
            assert.expect(1);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'read_group',
                model: 'hobbit',
                fields: [],
                groupBy: [],
            });

            assert.deepEqual(result, [{
                __count: EXPECTED_RECORDSET_SIZE,
                __domain: [],
            }]);
        });

        QUnit.test("Send 'read_group' RPC: groupBy", async function (assert) {
            assert.expect(5);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'read_group',
                model: 'hobbit',
                fields: [],
                groupBy: ['profession'],
            });

            assert.strictEqual(result.length, 3);

            const professions = result.map((g) => g.profession);
            assert.ok(professions.includes("gardener"));
            assert.ok(professions.includes("brewer"));
            assert.ok(professions.includes("adventurer"));

            assert.strictEqual(
                result.reduce((acc, g) => acc + g.profession_count, 0),
                EXPECTED_RECORDSET_SIZE,
            );
        });

        QUnit.test("Send 'read_group' RPC: groupBy and field", async function (assert) {
            assert.expect(6);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'read_group',
                model: 'hobbit',
                fields: ['age'],
                groupBy: ['profession'],
            });

            assert.strictEqual(result.length, 3);

            const professions = result.map((g) => g.profession);
            assert.ok(professions.includes("gardener"));
            assert.ok(professions.includes("brewer"));
            assert.ok(professions.includes("adventurer"));

            assert.strictEqual(
                result.reduce((acc, g) => acc + g.profession_count, 0),
                EXPECTED_RECORDSET_SIZE,
            );

            assert.strictEqual(
                result.reduce((acc, g) => acc + g.age, 0),
                server.data.hobbit.records.reduce((acc, g) => acc + g.age, 0)
            );

            console.log({ result, server });
        });

        QUnit.test("Send 'read_group' RPC: multiple groupBys and lazy", async function (assert) {
            assert.expect(2);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'read_group',
                model: 'hobbit',
                fields: [],
                groupBy: ['profession', 'age'],
            });

            assert.ok('profession' in result[0]);
            assert.notOk('age' in result[0]);
        });

        QUnit.test("Send 'read_group' RPC: multiple groupBys and not lazy", async function (assert) {
            assert.expect(2);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'read_group',
                model: 'hobbit',
                fields: [],
                groupBy: ['profession', 'age'],
                lazy: false,
            });

            assert.ok('profession' in result[0]);
            assert.ok('age' in result[0]);
        });

        QUnit.test("Send 'read' RPC: no id", async function (assert) {
            assert.expect(1);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'read',
                model: 'hobbit',
                args: [
                    [], ['display_name']
                ],
            });

            assert.deepEqual(result, []);
        });

        QUnit.test("Send 'read' RPC: one id", async function (assert) {
            assert.expect(3);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const result = await server.mockRpc({
                method: 'read',
                model: 'hobbit',
                args: [
                    [1], ['display_name']
                ],
            });

            assert.strictEqual(result.length, 1);
            assert.ok(
                /\w+/.test(result[0].display_name),
                "Display name has been mocked"
            );
            assert.strictEqual(result[0].id, 1);
        });

        QUnit.test("Send 'read' RPC: more than all available ids", async function (assert) {
            assert.expect(1);

            const server = new SampleServer('hobbit', this.fields.hobbit);

            const amount = EXPECTED_RECORDSET_SIZE + 3;
            const ids = new Array(amount).fill().map((_, i) => i + 1);
            const result = await server.mockRpc({
                method: 'read',
                model: 'hobbit',
                args: [
                    ids, ['display_name']
                ],
            });

            assert.strictEqual(result.length, EXPECTED_RECORDSET_SIZE);
        });

        // To be implemented if needed
        // QUnit.test("Send 'read_progress_bar' RPC", async function (assert) { ... });
    });
});
