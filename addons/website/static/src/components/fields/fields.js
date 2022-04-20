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
            redirectOldUrl: false,
            url: this.value,
            redirectType: '301',
        });

        this.serverUrl = window.location.origin;
        this.pageUrl = this.value;
    }

    get enableRedirect() {
        return this.state.url !== this.pageUrl;
    }

    onChangeRedirectOldUrl(value) {
        this.state.redirectOldUrl = value;
    }

    /**
     * @override
     */
    commitChanges() {
        if (this.enableRedirect) {
            this._setValue(this.state.url);
            if (this.state.redirectOldUrl) {
                return this.rpc({
                    model: 'website.rewrite',
                    method: 'create',
                    args: [{
                        'name': this.recordData.name,
                        'redirect_type': this.state.redirectType,
                        'url_from': this.pageUrl,
                        'url_to': this.state.url,
                        'website_id': this.recordData.website_id.res_id,
                    }],
                });
            }
        }
        return super.commitChanges();
    }
}
FieldPageUrl.components = {Switch, PageDependencies};
FieldPageUrl.supportedFieldTypes = ['char'];
FieldPageUrl.template = 'website.FieldPageUrl';

fieldRegistry.add('page_url', FieldPageUrl);
