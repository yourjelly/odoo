/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

import { Component, onMounted, useRef, useState } from "@odoo/owl";

class ServiceSelection extends Component {
    static props = {
        ...standardFieldProps,
    };
    static template = "account_peppol.ServiceSelection";

    setup() {
        super.setup();
        this.state = useState({
            services: {},
        });

        /*
        if the verification code was previously filled in and the user saved the page,
        pre-fill the input fields with the stored value.
        */
        onMounted(async () => {
            console.log(this.props.record.data)
            const peppol_services = await this.env.services.orm.call(
                "account_edi_proxy_client.user",
                "get_peppol_services",
                [
                    [this.props.record.data.account_peppol_edi_user[0]],
                ]
            );
            this.state.services = peppol_services.services;
        });
    }

    _save() {
        console.log("savey save");
    }
}

registry.category("fields").add("service_selection", {
    component: ServiceSelection,
    supportedTypes: ["jsonb"],
});
