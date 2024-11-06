import {
    ComboConfiguratorDialog
} from '@sale/js/combo_configurator_dialog/combo_configurator_dialog';
import { ProductCombo } from '@sale/js/models/product_combo';
import {
    ProductConfiguratorDialog
} from '@sale/js/product_configurator_dialog/product_configurator_dialog';
import { serializeComboItem } from '@sale/js/sale_utils';
import { browser } from '@web/core/browser/browser';
//import { getCurrency } from '@web/core/currency';
import { serializeDateTime } from '@web/core/l10n/dates';
import { _t } from '@web/core/l10n/translation';
import { rpc } from '@web/core/network/rpc';
import { registry } from '@web/core/registry';
import { session } from '@web/session';

const { DateTime } = luxon;

/**
 * Manages product addition via the `addToCart` function.
 *
 * This function handles the process of adding products to the cart, including:
 * - Opening configurators if needed.
 * - Updating the cart with the selected products.
 * - Tracking added products.
 * - Notifying the customer of successful additions.
 * - Updating the cart count in the navbar.
 *
 * Override this class to implement additional checks or
 * provide relevant information before adding a product to the cart.
 */
export class WebsiteSaleService {
    static dependencies = ['cartNotificationService', 'dialog'];

    /**
     * The service is initialized in `setup` to allow patching, as constructors can't be patched.
     */
    constructor() {
        return this.setup(...arguments);
    }

    setup(_env, dependencies) {
        this.cartNotificationService = dependencies.cartNotificationService;
        this.dialog = dependencies.dialog;
        this.rpc = rpc;  // To be overridable in tests.

        // Only expose `addToCart` in the service registry.
        let self = this;
        return {
            addToCart: function() {
                self.addToCart(...arguments);
            }
        }
    }

    //--------------------------------------------------------------------------
    // Public methods
    //--------------------------------------------------------------------------

    /**
     * Asynchronously adds a product to the shopping cart.
     *
     * @async
     * @param {Object} product - The product details to add to the cart.
     * @param {Number} product.productTemplateId - The product template's id, as a
     *      `product.template` id.
     * @param {Number} [product.productId=undefined] - The product's id, as a `product.product` id.
     *      If not provided, selects the first available product or creates one if any attribute is
     *      dynamic.
     * @param {Number} [product.quantity=1] - The quantity of the product to add to the cart.
     *      Defaults to 1.
     * @param {Number[]} [product.ptavs=[]] - The selected stored attribute(s), as a list of
     *      `product.template.attribute.value` ids.
     * @param {{id: Number, value: String}[]} [product.productCustomAttributeValues=[]] - An
     *      array of objects representing custom attribute values for the product. Each object
     *      contains:
     *      - `custom_product_template_attribute_value_id`: The custom attribute's id.
     *      - `custom_value`: The custom attribute's value.
     * @param {Number[]} [product.noVariantAttributeValues=[]] - The selected non-stored
     *      attribute(s), as a list of `product.template.attribute.value` ids.
     * @param {Object} [product.additionalTrackingInformation={}] - Various information used for
     *      products' tracking.
     * @param {String} [product.additionalTrackingInformation.categoryName] - The product's category
     *      name.
     * @param {String} [product.additionalTrackingInformation.currencyId] - The product's currency
     *      id, as a `res.currency` id.
     * @param {String} [product.additionalTrackingInformation.name] - The product's name.
     * @param {Number} [product.additionalTrackingInformation.price] - The product's price.
     * @param {Boolean} [product.isCombo=false] - Whether the product is part of a combo template.
     *      Defaults to false.
     * @param {...*} [product.rest] - Locally unused data sent to the controller.
     * @param {Boolean} [isBuyNow=false] - Whether the product should be added immediately,
     *      bypassing optional configurations. Defaults to false.
     *
     * @returns {Void}
     */
    async addToCart({
            productTemplateId,
            productId = undefined,
            quantity = 1,
            ptavs = [],
            productCustomAttributeValues = [],
            noVariantAttributeValues = [],
            additionalTrackingInformation = {}, // TODO VCR: use tracking
            isCombo = false,
            ...rest
        },
        isBuyNow=false
    ) {
        if (!productId) {
            productId = await this.rpc('/sale/create_product_variant', {
                product_template_id: productTemplateId,
                product_template_attribute_value_ids: ptavs,
            })
        }

        if(isCombo) {
            const { combos, ...remainingData } = await this.rpc(
                '/website_sale/combo_configurator/get_data',
                {
                    product_tmpl_id: productTemplateId,
                    quantity: quantity,
                    date: serializeDateTime(DateTime.now()),
                }
            );
            return this._openComboConfigurator(
                productId,
                combos.map(combo => new ProductCombo(combo)),
                remainingData,
            );
        }

        if (isBuyNow) {
            return await this._addToCart(
                productTemplateId,
                productId,
                quantity,
                productCustomAttributeValues,
                noVariantAttributeValues,
                additionalTrackingInformation,
                isBuyNow,
                rest
            );
        }

        const shouldShowProductConfigurator = await this.rpc(
            '/website_sale/should_show_product_configurator',
            {
                product_template_id: productTemplateId,
                ptav_ids: ptavs,
                is_product_configured: this.isOnProductPage,
            }
        );
        if (shouldShowProductConfigurator) {
            return this._openProductConfigurator(
                productTemplateId,
                quantity,
                ptavs.concat(noVariantAttributeValues),
                productCustomAttributeValues,
                additionalTrackingInformation,
            );
        }

        return await this._addToCart(
            productTemplateId,
            productId,
            quantity,
            productCustomAttributeValues,
            noVariantAttributeValues,
            additionalTrackingInformation,
            isBuyNow,
            rest
        );
    }

    //--------------------------------------------------------------------------
    // Configurators
    //--------------------------------------------------------------------------

    /**
     * Opens the combo configurator dialog.
     *
     * @private
     * @param {Number} productId - The product's id, as a `product.product` id.
     * @param {ProductCombo[]} combos - The combos of the product.
     * @param {Object} remainingData - Other data needed to open the combo configurator.
     * @param {String} remainingData.category_name - The category's name of the combo.
     * @param {Number} remainingData.currency_id - The currency's id, as a `res.currency` id.
     * @param {String} remainingData.currency_name - The name of the currency.
     * @param {String} remainingData.display_name - The name of the combo.
     * @param {Number} remainingData.price - The price of the combo.
     * @param {Number} remainingData.product_tmpl_id - The product template's id, as a
     *      `product.template` id.
     * @param {Number} remainingData.quantity - The quantity of the combo.
     *
     * @returns {Void}
     */
    _openComboConfigurator(productId, combos, remainingData) {
        this.dialog.add(ComboConfiguratorDialog, {
            combos: combos,
            ...remainingData,
            date: serializeDateTime(DateTime.now()),
            edit: false,
            isFrontend: true,
            save: async (comboProductData, selectedComboItems, options) => {
                this._trackProducts([{
                    'id': productId,
                    'display_name': remainingData.display_name,
                    'category_name': remainingData.category_name,
                    'currency_name': remainingData.currency_name,
                    'price': comboProductData.price,
                    'quantity': comboProductData.quantity,
                }]);

                const values = await this.rpc('/website_sale/combo_configurator/update_cart', {
                    combo_product_id: productId,
                    quantity: comboProductData.quantity,
                    selected_combo_items: selectedComboItems.map(serializeComboItem),
                    // ...this._getAdditionalRpcParams(),
                });
                this._onConfigured(options, values);
            },
            discard: () => {},
            // ...this._getAdditionalDialogProps(),
        });
    }

    /**
     * Opens the product configurator dialog.
     *
     * @private
     * @param {Number} productTemplateId - The product template id, as a `product.template` id.
     * @param {Number} quantity - The quantity to add to the cart.
     * @param {Number[]} combination - The combination of the product, as a list of
     *      `product.template.attribute.value` ids.
     * @param {{id: Number, value: String}[]} [productCustomAttributeValues=[]] - An array of
     *      objects representing custom attribute values for the product. Each object contains:
     *      - `custom_product_template_attribute_value_id`: The custom attribute's id.
     *      - `custom_value`: The custom attribute's value.
     *
     * @returns {Void}
     */
    _openProductConfigurator(
        productTemplateId,
        quantity,
        combination,
        productCustomAttributeValues,
        additionalTrackingInformation,
    ) {
        this.dialog.add(ProductConfiguratorDialog, {
            productTemplateId: productTemplateId,
            ptavIds: combination,
            customPtavs: productCustomAttributeValues.map(customPtav => ({
                id: customPtav.custom_product_template_attribute_value_id,
                value: customPtav.custom_value,
            })),
            quantity: quantity,
            soDate: serializeDateTime(DateTime.now()),
            edit: false,
            isFrontend: true,
            options: { isMainProductConfigurable: !this.isOnProductPage },
            save: async (mainProduct, optionalProducts) => {
                const product = this._serializeProduct(mainProduct);
                return await this._addToCart(
                    product.product_template_id,
                    product.product_id,
                    product.quantity,
                    product.product_custom_attribute_values,
                    product.no_variant_attribute_value_ids,
                    additionalTrackingInformation,
                    false,
                    {optional_products: optionalProducts.map(this._serializeProduct)},
                );
            },
            discard: () => {},
            // ...this._getAdditionalDialogProps(),
        });
    }

    /**
     * Serialize a product into a format understandable by the server.
     *
     * @private
     * @param {Object} product - The product to serialize.
     * TODO VCR
     *
     * @returns {Object} The serialized product.
     */
    _serializeProduct(product) {
        let serializedProduct = {
            product_id: product.id,
            product_template_id: product.product_tmpl_id,
            parent_product_template_id: product.parent_product_tmpl_id,
            quantity: product.quantity,
        }

        if (!product.attribute_lines) {
            return serializedProduct;
        }

        // Custom attributes.
        serializedProduct.product_custom_attribute_values = [];
        for (const ptal of product.attribute_lines) {
            const selectedPtavIds = new Set(ptal.selected_attribute_value_ids);
            const selectedCustomPtav = ptal.attribute_values.find(
                ptav => ptav.is_custom && selectedPtavIds.has(ptav.id)
            );
            if (selectedCustomPtav) {
                serializedProduct.product_custom_attribute_values.push({
                    custom_product_template_attribute_value_id: selectedCustomPtav.id,
                    custom_value: ptal.customValue ?? '',
                });
            }
        }

        // No variant attributes.
        serializedProduct.no_variant_attribute_value_ids = product.attribute_lines
            .filter(ptal => ptal.create_variant === 'no_variant')
            .flatMap(ptal => ptal.selected_attribute_value_ids);

        return serializedProduct;
    }

    //--------------------------------------------------------------------------
    // Helpers
    //--------------------------------------------------------------------------

    // TODO VCR
    get isOnProductPage() {
        return !!document.getElementsByClassName('o_wsale_product_page').length;
    }

    // TODO VCR
    async _addToCart(
        productTemplateId,
        productId,
        quantity,
        productCustomAttributeValues,
        noVariantAttributeValues,
        additionalTrackingInformation,
        isBuyNow,
        {...rest} = {}
    ) {
        //this._trackProducts([mainProduct, ...optionalProducts]);

        const data = await this.rpc('/shop/cart/update', {
            product_template_id: productTemplateId,
            product_id: productId,
            add_qty: quantity,
            product_custom_attribute_values: productCustomAttributeValues,
            no_variant_attribute_value_ids: noVariantAttributeValues,
            force_create: true,
            ...rest
        });
        if (isBuyNow) {
            window.location = '/shop/cart';
        } else if (session.add_to_cart_action === 'stay') {  // TODO VCR check condition and navbar code
            if (data.cart_quantity && (data.cart_quantity !== parseInt($('.my_cart_quantity').text()))) {
                this._updateCartIcon(data.cart_quantity);
            };
            this._showCartNotification(data.notification_info);
        }
    }

    _trackProducts(products) {
        // TODO VCR do something
        const productsTrackingInfo = []
        for (const product of products) {
            // currency = getCurrency(product.additionalTrackingInformation.currencyId);
            // currency.name
            productsTrackingInfo.push({
                'item_id': product.id,
                'item_name': product.display_name,
                'item_category': product.category_name,
                'currency': product.currency_name,
                'price': product.price,
                'quantity': product.quantity,
            });
        }
        // TODO VCR
        // if (productsTrackingInfo.length) {
        //     this.$el.trigger('add_to_cart_event', productsTrackingInfo);
        // }
    }

    // TODO VCR
    _onConfigured(options, values) {
        if (options.goToCart) {
            window.location.pathname = '/shop/cart';
        } else {
            this._updateCartIcon(values.cart_quantity);
            this._showCartNotification(values.notification_info);
        }
        // Reload the product page after adding items to the cart. This is needed, for
        // example, to update the available stock.
        // this._getCombinationInfo($.Event('click', { target: $('#add_to_cart') }));
    }

    /**
     * Update the quantity on the cart icon in the navbar.
     *
     * @private
     * @param {Number} cartQuantity - The number of items currently in the cart.
     *
     * @returns {void}
     */
    _updateCartIcon(cartQuantity) {
        browser.sessionStorage.setItem('website_sale_cart_quantity', cartQuantity);
        const cartQuantityElement = document.querySelector('.my_cart_quantity');
        if (cartQuantity === 0) {
            cartQuantityElement.classList.add('d-none');
        } else {
            const cartIconElement = document.querySelector('li.o_wsale_my_cart');
            cartIconElement.classList.remove('d-none');
            cartQuantityElement.classList.remove('d-none');
            cartQuantityElement.classList.add('o_mycart_zoom_animation');
            setTimeout(() => {
                cartQuantityElement.textContent = cartQuantity;
                cartQuantityElement.classList.remove('o_mycart_zoom_animation');
            }, 300);
        }
    }

    _showCartNotification(props, options = {}) {
        // TODO VCR docstring
        // Show the notification about the cart
        if (props.lines) {
            this.cartNotificationService.add(_t('Item(s) added to your cart'), {
                lines: props.lines,
                currency_id: props.currency_id,
                ...options,
            });
        }
        if (props.warning) {
            this.cartNotificationService.add(_t('Warning'), {
                warning: props.warning,
                ...options,
            });
        }
    }
}

export const websiteSaleService = {
    dependencies: WebsiteSaleService.dependencies,
    async: ['addToCart'],
    start(env, dependencies) {
        return new WebsiteSaleService(env, dependencies);
    },
}

registry.category('services').add('websiteSale', websiteSaleService);
