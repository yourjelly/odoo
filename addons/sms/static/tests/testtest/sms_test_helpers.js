import { busModels } from "@bus/../tests/bus_test_helpers";
import { mailModels } from "@mail/../tests/mail_test_helpers";
// import { defineParams } from "@web/../tests/_framework/mock_server/mock_server";
import { defineModels, webModels } from "@web/../tests/web_test_helpers";

export function defineSMSModels() {
    return defineModels({ ...busModels, ...webModels ,...mailModels });
}
