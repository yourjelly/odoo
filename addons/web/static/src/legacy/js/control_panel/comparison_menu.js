/** @odoo-module **/
    
    import { Dropdown } from "@web/core/dropdown/dropdown";
    import { SearchDropdownItem } from "@web/search/search_dropdown_item/search_dropdown_item";
    import { FACET_ICONS } from "./search_utils";
    import { useModel } from "@web/legacy/js/model";
    import { LegacyComponent } from "@web/legacy/legacy_component";

    class ComparisonMenu extends LegacyComponent {
        setup() {
            this.icon = FACET_ICONS.comparison;
            this.model = useModel('searchModel');
        }

        /**
         * @override
         */
        get items() {
            return this.model.get('filters', f => f.type === 'comparison');
        }

        /**
         * @private
         * @param {number} itemId
         */
        onComparisonSelected(itemId) {
            this.model.dispatch("toggleComparison", itemId);
        }
    }
    ComparisonMenu.template = "web.ComparisonMenu";
    ComparisonMenu.components = { Dropdown, SearchDropdownItem };

    export default ComparisonMenu;
