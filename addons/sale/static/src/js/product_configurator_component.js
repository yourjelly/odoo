/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Many2OneField } from "@web/fields/many2one";
import { core } from "@web/core";
import { _t } from "@web/core/l10n/translation";

const { onWillStart, onWillUpdateProps } = owl;

/**
 * The sale.product_configurator is a simple component extending FieldMany2One
 * It allows the development of configuration strategies in other modules through
 * extensions.
 *
 *
 * !!! WARNING !!!
 *
 * This class is only designed for sale_order_line creation/updates.
 * !!! It should only be used on a product_product or product_template field !!!
 */
export class ProductConfiguratorComponent extends Many2OneField {
    setup() {
        super.setup()

        onWillStart(async () => {
            if (this.mode === 'edit' && this.value &&
            (this.isConfigurableProduct() || this.isConfigurableLine())) {
                this.addProductLinkButton();
                this.addConfigurationEditButton();
            } else if (this.mode === 'edit' && this.value) {
                this.addProductLinkButton();
                this.$('.o_edit_product_configuration').hide();
            } else {
                this.$('.o_external_button').hide();
                this.$('.o_edit_product_configuration').hide();
            }
        });

        onWillUpdateProps((nextProps) => {
            super.willUpdateProps(nextProps);

            let record = nextProps.record;
            let ev = nextProps.ev;

            if (ev && ev.target === this) {
                if (ev.data.changes && !ev.data.preventProductIdCheck && ev.data.changes.product_template_id) {
                    this.onTemplateChange(record.data.product_template_id.data.id, ev.data.dataPointID);
                } else if (ev.data.changes && ev.data.changes.product_id) {
                    this.onProductChange(record.data.product_id.data && record.data.product_id.data.id, ev.data.dataPointID)
                        .then(wizardOpened => {
                            if (!wizardOpened) {
                                this.onLineConfigured();
                            }
                        }
                    );
                }
            }
        });
    }

    addProductLinkButton() {
        if (this.$('.o_external_button').length === 0) {
            let text = 'External Link';

            let $productLinkButton = $('<button>', {
                type: 'button',
                class: 'fa fa-external-link btn btn-secondary o_external_button',
                tabindex: '-1',
                draggable: false,
                'aria-label': _t(text),
                title: _t(text)
            });

            let $inputDropdown = this.$('.o_input_dropdown');
            $inputDropdown.after($productLinkButton);
        }
    }

    addConfigurationEditButton() {
        var $inputDropdown = this.$('.o_input_dropdown');

        if ($inputDropdown.length !== 0 &&
            this.$('.o_edit_product_configuration').length === 0) {
            let text ='Edit Configuration';

            let $editConfigurationButton = $('<button>', {
                type: 'button',
                class: 'fa fa-pencil btn btn-secondary o_edit_product_configuration',
                tabindex: '-1',
                draggable: false,
                'aria-label': _t(text),
                title: _t(text)
            });

            $inputDropdown.after($editConfigurationButton);
        }
    }

    onEditConfiguration() {
        if (this.isConfigurableLine()) {
            this.onEditLineConfiguration();
        } else if (this.isConfigurableProduct()) {
            this.onEditProductConfiguration();
        }
    }

    convertFromMany2Many(recordData) {
        if (recordData) {
            let convertedValues = [];
            _.each(recordData.res_ids, function (resId) {
                convertedValues.push([4, parseInt(retId)]) ;
            });

            return convertedValues;
        }

        return null
    }

    convertFromOne2Many(recordData) {
        if (recordData) {
            let convertedValues = [];
            _.each(recordData.res_ids, function (resId) {
                if (isNaN(resId)) {
                    _.each(recordData.data, function (record) {
                        if (record.ref === resId) {
                            convertedValues.push([0, 0, {
                                custom_product_template_attribute_value_id: record.data.custom_product_template_attribute_value_id.data.id,
                                custom_value: record.data.custom_value
                            }]);
                        }
                    });
                } else {
                    convertedValues.push([4, resId]);
                }
            });

            return convertedValues;
        }

        return null;
    }

    /**
     * Hooks to be overridden by different configurators extending the product configurator
    **/

    isConfigurableProduct() {
        return false;
    }

    isConfigurableLine() {
        return false;
    }

    onTemplateChange(productTemplateId, dataPointId) {
        // come back to this
        return Promise.resolve(false);
    }

    onProductChange(productId, dataPointId) {
        // same here, not sure of this
        return Promise.resolve(false);
    }

    onLineConfigured() {}

    onEditLineConfiguration() {}

    onEditProductConfiguration() {}
}

registry.category('fields').add('product_configurator', ProductConfiguratorComponent);
