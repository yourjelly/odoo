/** @odoo-module **/

import {PageDependencies} from '@website/components/dialog/page_properties';
import {Switch} from '@website/components/switch/switch';
import AbstractFieldOwl from 'web.AbstractFieldOwl';
import fieldRegistry from 'web.field_registry_owl';

const {useState} = owl;

class FieldPageUrl extends AbstractFieldOwl {
    setup() {
        super.setup();

        this.state = useState({
            redirect_old_url: false,
            url: this.value,
            redirect_type: '301',
        });

        this.serverUrl = window.location.origin;
        this.pageUrl = this.value;
    }

    get enableRedirect() {
        return this.state.url !== this.pageUrl;
    }

    onChangeRedirectOldUrl(value) {
        this.state.redirect_old_url = value;
    }

    /**
     * @override
     */
    commitChanges() {
        if (this.enableRedirect) {
            this._setValue(this.state);
        }
        return super.commitChanges();
    }
}
FieldPageUrl.components = {Switch, PageDependencies};
FieldPageUrl.supportedFieldTypes = ['char'];
FieldPageUrl.template = 'website.FieldPageUrl';

fieldRegistry.add('page_url', FieldPageUrl);
