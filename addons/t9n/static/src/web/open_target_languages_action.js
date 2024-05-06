import { Component, xml } from "@odoo/owl";

import { LanguageList } from "@t9n/core/language_list";
import { registry } from "@web/core/registry";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";

export class OpenTargetLanguages extends Component {
    static components = { LanguageList };
    static props = { ...standardActionServiceProps };
    static template = xml`<LanguageList/>`;
}

registry.category("actions").add("t9n.open_target_langs", OpenTargetLanguages);
