/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { SnippetOption } from '@web_editor/components/snippets_menu/snippets_options';
import { registry } from '@web/core/registry';
import { useService } from "@web/core/utils/hooks";

export class AddToCart extends SnippetOption {
    setup() {
        super.setup();
        this.env.validMethodNames.push(
            "setProductTemplate",
            "setProductVariant",
            "setAction",
            "resetVariantPicker",
            "resetProductPicker",
        );
        this.orm = useService("orm");
    }

    getProductVariantDomain() {
        if (this.target.dataset.productTemplate) {
            return [["product_tmpl_id", "=", parseInt(this.target.dataset.productTemplate)]];
        }
        return [];
    }

    _setButtonDisabled(isDisabled) {
        const buttonEl = this._buttonEl();

        if (isDisabled) {
            buttonEl.classList.add('disabled');
        } else {
            buttonEl.classList.remove('disabled');
        }
    }

    async setProductTemplate(previewMode, widgetValue, params) {
        this.target.dataset.productTemplate = widgetValue;
        this._resetVariantChoice();
        this._resetAction();
        this._setButtonDisabled(false);

        await this._fetchVariants(widgetValue);
        this._updateButton();

    }

    setProductVariant(previewMode, widgetValue, params) {
        this.target.dataset.productVariant = widgetValue;
        this._updateButton();
    }

    setAction(previewMode, widgetValue, params) {
        this.target.dataset.action = widgetValue;
        this._updateButton();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    resetVariantPicker() {
        this._resetVariantChoice();
        this._resetAction();
        this._updateButton();
    }

    resetProductPicker() {
        this._resetProductChoice();
        this._resetVariantChoice();
        this._resetAction();
        this._updateButton();
        this.render(true);
    }

    /**
     * Fetches the variants ids from the server
     */
    async _fetchVariants(productTemplateId) {
        const response = await this.orm.searchRead(
            'product.product',
            [
                ["product_tmpl_id", "=", parseInt(productTemplateId)],
            ],
        );
        this.target.dataset.variants = response.map(variant => variant.id);
    }


    _resetProductChoice() {
        this.target.dataset.productTemplate = '';
        this._buttonEl().classList.add('disabled');
    }


    _resetVariantChoice() {
        this.target.dataset.productVariant = '';
    }

    _resetAction() {
        this.target.dataset.action = "add_to_cart";
    }

    /**
     * Returns an array of variant ids from the dom
     */
    _variantIds() {
        return this.target.dataset.variants.split(',').map(stringId => parseInt(stringId));
    }

    _buttonEl() {
        const buttonEl = this.target.querySelector('.s_add_to_cart_btn');
        // In case the button was deleted somehow, we rebuild it.
        if (!buttonEl) {
            return this._buildButtonEl();
        }
        return buttonEl;
    }

    _buildButtonEl() {
        const buttonEl = document.createElement('button');
        buttonEl.classList.add("s_add_to_cart_btn", "btn", "btn-secondary", "mb-2");
        this.target.append(buttonEl);
        return buttonEl;
    }

    /**
     * Updates the button's html
     */
    _updateButton() {
        const variantIds = this._variantIds();
        const buttonEl = this._buttonEl();

        let productVariantId = variantIds[0];
        buttonEl.dataset.visitorChoice = false;

        if (variantIds.length > 1) {
            // If there is more than 1 variant, that means that there are variants for the product template
            // and we check if there is one selected and assign it. If not, visitorChoice is set to true
            if (this.target.dataset.productVariant) {
                productVariantId = this.target.dataset.productVariant;
            } else {
                buttonEl.dataset.visitorChoice = true;
            }
        }
        buttonEl.dataset.productVariantId = productVariantId;
        buttonEl.dataset.action = this.target.dataset.action;
        this._updateButtonContent();
        this._createHiddenFormInput(productVariantId);
    }

    _updateButtonContent() {
        let iconEl = document.createElement('i');
        const buttonContent = {
            add_to_cart: {classList: "fa fa-cart-plus me-2", text: _t("Add to Cart")},
            buy_now: {classList: "fa fa-credit-card me-2", text: _t("Buy now")},
        };
        let buttonContentElement = buttonContent[this.target.dataset.action];

        iconEl.classList = buttonContentElement.classList;

        this._buttonEl().replaceChildren(iconEl, buttonContentElement.text);
    }
    /**
     * Because sale_product_configurator._handleAdd() requires a hidden input to retrieve the productId,
     * this method creates a hidden input in the form of the button to make the modal behaviour possible.
     */
    _createHiddenFormInput(productVariantId) {
        const inputEl = this._buttonEl().querySelector('input[type="hidden"][name="product_id"]');
        if (inputEl) {
            // If the input already exists, we change its value
            inputEl.setAttribute('value', productVariantId);
        } else {
            // Otherwise, we create the input element
            let inputEl = document.createElement('input');
            inputEl.setAttribute('type', 'hidden');
            inputEl.setAttribute('name', 'product_id');
            inputEl.setAttribute('value', productVariantId);
            this._buttonEl().append(inputEl);
        }
    }

    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        switch (methodName) {
            case 'setProductTemplate': {
                return this.target.dataset.productTemplate || '';
            }
            case 'setProductVariant': {
                return this.target.dataset.productVariant || '';
            }
            case 'setAction': {
                return this.target.dataset.action;
            }
        }
        return super.computeWidgetState(...arguments);
    }

    /**
     * @override
     */
    async computeWidgetVisibility(widgetName, params) {
        switch (widgetName) {
            case 'product_variant_picker_opt': {
                return this.target.dataset.productTemplate && this._variantIds().length > 1;
            }
            case 'product_variant_reset_opt': {
                return this.target.dataset.productVariant;
            }

            case 'product_template_reset_opt': {
                return this.target.dataset.productTemplate;
            }
            case 'action_picker_opt': {
                if (this.target.dataset.productTemplate) {
                    if (this._variantIds().length > 1) {
                        return this.target.dataset.productVariant;
                    }
                    return true;
                }
                return false;
            }
        }
        return super.computeWidgetVisibility(...arguments);
    }
}

registry.category("snippets_options").add("AddToCart", {
    component: AddToCart,
    template: "website_sale.s_add_to_cart_options",
    selector: ".s_add_to_cart",
});
