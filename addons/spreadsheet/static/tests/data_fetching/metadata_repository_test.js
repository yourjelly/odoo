import { nextTick } from "@web/../tests/helpers/utils";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { registry } from "@web/core/registry";
import { ormService } from "@web/core/orm_service";
import { nameService } from "@web/core/name_service";
import { MetadataRepository } from "@spreadsheet/data_sources/metadata_repository";
import { LoadingDataError } from "@spreadsheet/o_spreadsheet/errors";

function beforeEach() {
    registry
        .category("services")
        .add("name", nameService, { force: true })
        .add("orm", ormService, { force: true });
}

QUnit.module("spreadsheet > Metadata Repository", { beforeEach }, () => {
    QUnit.test("Register label correctly memorize labels", async function (assert) {
        assert.expect(2);
        const env = await makeTestEnv();
        const metadataRepository = new MetadataRepository(env);

        assert.strictEqual(metadataRepository.getLabel("model", "field", "value"), undefined);
        const label = "label";
        metadataRepository.registerLabel("model", "field", "value", label);
        assert.strictEqual(metadataRepository.getLabel("model", "field", "value"), label);
    });

    QUnit.test("names are collected and executed once by clock", async function (assert) {
        const env = await makeTestEnv({
            mockRPC: function (route, { method, model, kwargs }) {
                const ids = kwargs.domain[0][2];
                assert.step(`${method}-${model}-[${ids.join(",")}]`);
                return {
                    records: ids.map((id) => ({ id, display_name: id.toString() })),
                };
            },
        });

        const metadataRepository = new MetadataRepository(env);
        metadataRepository.addEventListener("labels-fetched", () => {
            assert.step("labels-fetched");
        });

        assert.throws(() => metadataRepository.getRecordDisplayName("A", 1), LoadingDataError);
        assert.throws(() => metadataRepository.getRecordDisplayName("A", 1), LoadingDataError);
        assert.throws(() => metadataRepository.getRecordDisplayName("A", 2), LoadingDataError);
        assert.throws(() => metadataRepository.getRecordDisplayName("B", 1), LoadingDataError);
        assert.verifySteps([]);

        await nextTick();
        assert.verifySteps(["web_search_read-A-[1,2]", "web_search_read-B-[1]", "labels-fetched"]);

        assert.strictEqual(metadataRepository.getRecordDisplayName("A", 1), "1");
        assert.strictEqual(metadataRepository.getRecordDisplayName("A", 2), "2");
        assert.strictEqual(metadataRepository.getRecordDisplayName("B", 1), "1");
    });

    QUnit.test("names to fetch are cleared after being fetched", async function (assert) {
        const env = await makeTestEnv({
            mockRPC: function (route, { method, model, kwargs }) {
                const ids = kwargs.domain[0][2];
                assert.step(`${method}-${model}-[${ids.join(",")}]`);
                return {
                    records: ids.map((id) => ({ id, display_name: id.toString() })),
                };
            },
        });
        const metadataRepository = new MetadataRepository(env);

        assert.throws(() => metadataRepository.getRecordDisplayName("A", 1));
        assert.verifySteps([]);

        await nextTick();
        assert.verifySteps(["web_search_read-A-[1]"]);

        assert.throws(() => metadataRepository.getRecordDisplayName("A", 2));
        await nextTick();
        assert.verifySteps(["web_search_read-A-[2]"]);
    });

    QUnit.test(
        "Assigning a result after triggering the request should not crash",
        async function (assert) {
            const env = await makeTestEnv({
                mockRPC: function (route, { method, model, kwargs }) {
                    const ids = kwargs.domain[0][2];
                    assert.step(`${method}-${model}-[${ids.join(",")}]`);
                    return {
                        records: ids.map((id) => ({ id, display_name: id.toString() })),
                    };
                },
            });
            const metadataRepository = new MetadataRepository(env);

            assert.throws(() => metadataRepository.getRecordDisplayName("A", 1));
            assert.verifySteps([]);
            metadataRepository.setDisplayName("A", 1, "test");
            assert.strictEqual(metadataRepository.getRecordDisplayName("A", 1), "test");

            await nextTick();
            assert.verifySteps(["web_search_read-A-[1]"]);
            assert.strictEqual(metadataRepository.getRecordDisplayName("A", 1), "test");
        }
    );

    QUnit.test(
        "names will retry with one id by request in case of failure",
        async function (assert) {
            const env = await makeTestEnv({
                mockRPC: function (route, { method, model, kwargs }) {
                    let ids = kwargs.domain[0][2];
                    assert.step(`${method}-${model}-[${ids.join(",")}]`);
                    if (model === "B" && ids.includes(1)) {
                        // let's pretend id 1 doesn't exist
                        // search_read will not return it
                        ids = ids.filter((id) => id !== 1);
                    }
                    return {
                        records: ids.map((id) => ({ id, display_name: id.toString() })),
                    };
                },
            });

            const metadataRepository = new MetadataRepository(env);

            assert.throws(() => metadataRepository.getRecordDisplayName("A", 1), LoadingDataError);
            assert.throws(() => metadataRepository.getRecordDisplayName("B", 1), LoadingDataError);
            assert.throws(() => metadataRepository.getRecordDisplayName("B", 2), LoadingDataError);
            assert.verifySteps([]);

            await nextTick();
            assert.verifySteps(["web_search_read-A-[1]", "web_search_read-B-[1,2]"]);

            assert.strictEqual(metadataRepository.getRecordDisplayName("A", 1), "1");
            assert.throws(
                () => metadataRepository.getRecordDisplayName("B", 1),
                /Unable to fetch the label of 1 of model B/
            );
            assert.strictEqual(metadataRepository.getRecordDisplayName("B", 2), "2");
        }
    );
});
