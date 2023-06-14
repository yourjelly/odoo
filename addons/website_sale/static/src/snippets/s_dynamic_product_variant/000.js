/** @odoo-module **/

import publicWidget from 'web.public.widget';
import VariantMixin from "website_sale.VariantMixin";

const ProductVariant = publicWidget.Widget.extend(VariantMixin,{
    selector: '.s_dynamic_product_variant_snippet',
    events:{
        'click .move_to_next': '_switchToNextTab',
        'click .move_to_prev': '_switchToPrevTab',
        'input .js_variant_change': '_onChangeSelectedVariant'
    },
    disabledInEditableMode: false,
    init() {
        this._super(...arguments);
        this.data = [];
    },
    async start(){
        // If we wanna drag N drop snippet
        // this._render();
    },

    /**
     *
     * @override
     */
    destroy: function () {
        this._clearContent();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _render: async function () {
        const currentUrl = new URL(window.location.href);
        this.data  = await this._rpc({
            route: currentUrl.pathname+'/get-attr',
        });
        const $templateArea = this.$el.find('.s_dynamic_product_variant_class');
        $templateArea.html(this.data)
        
    },

    _clearContent: function () {
        const $templateArea = this.$el.find('.s_dynamic_product_variant_class');
        this.trigger_up('widgets_stop_request', {
            $target: $templateArea,
        });
        $templateArea.html('');
    },

    _switchToNextTab: function () {
       const tabEl = $('.nav-link.active');
       if(tabEl.next().is('.nav-link')){
           tabEl.next().tab('show');
        }else{
            tabEl.removeClass('active')
            $('.tab-pane.active').removeClass('active')
        }
        tabEl.find('.fa-check').removeClass('d-none');
       
    },

    _onChangeSelectedVariant(el){
        const tabEl = $('.nav-link.active .selected_variant');
        tabEl.html("(" + $(el)[0].target.getAttribute('data-value_name')+ ")");
    },
    
    _switchToPrevTab: function () {
        const tabEl = $('.nav-link.active');
        if(tabEl.length){
            if(tabEl.prev().is('.nav-link')){
                tabEl.prev().tab('show');
            }
        }else{
            $('#v-pills-tab').find('.nav-link:last').tab('show');
        }
        $('.nav-link.active').find('.fa-check').addClass('d-none');
    }
});

publicWidget.registry.dynamic_snippet_products_variant = ProductVariant;
export default ProductVariant;
