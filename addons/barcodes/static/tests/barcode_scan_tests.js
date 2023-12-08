/** @odoo-module */

import { browser } from "@web/core/browser/browser";
import { makeTestEnv, clearRegistryWithCleanup } from "@web/../tests/helpers/mock_env";
import { dialogService } from "@web/core/dialog/dialog_service";
import { uiService } from "@web/core/ui/ui_service";
import { getFixture, mount, patchWithCleanup } from "@web/../tests/helpers/utils";
import { BarcodeScanner } from "@barcodes/components/barcode_scanner";
import { BarcodeDialog } from "@web/webclient/barcode/barcode_scanner";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { xml, Component, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { notificationService } from "@web/core/notifications/notification_service";

let target;
let env;
const serviceRegistry = registry.category("services");

QUnit.module("unit tests for scan barcode", {

    async beforeEach() {
        target = getFixture();
        serviceRegistry.add("dialog", dialogService);
        serviceRegistry.add("ui", uiService);
        serviceRegistry.add("notification", notificationService);
        clearRegistryWithCleanup(registry.category("main_components"));;

    },

});
QUnit.only("scan barcode fail or success", async function (assert) {
    env = await makeTestEnv();
    assert.expect(0);

    patchWithCleanup(browser, {
        navigator: {
            mediaDevices: {
                getUserMedia: [],
            },
        }
    });
    const facingMode = 'environment'
    patchWithCleanup(env.services.dialog, {
        add(component) {
            if (component === BarcodeDialog) {
                debugger
                facingMode
                onResult: (result) => res(result)
                onError: (error) => rej(error)
            }
        },
    });

class BarcodeScan extends Component {
    setup(){
        super.setup()

    
    }
    onBarcodeScanned(ev){    // onMounted(() => {
        //     debugger;
        // })
    }
}

BarcodeScan.components = { BarcodeScanner, BarcodeDialog, MainComponentsContainer};
BarcodeScan.template = xml`
<div>
<MainComponentsContainer/>
    <BarcodeScanner onBarcodeScanned="(ev) => this.onBarcodeScanned(ev)"/>
    <!-- <a role="button" class="btn btn-primary o_mobile_barcode" t-on-click="open"/> -->
</div>
`;
// await mount(MainComponentsContainer, target, { env });
await mount(BarcodeScan, target, { env });

})