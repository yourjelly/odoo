/** @odoo-module **/

import {Markup} from 'web.utils';
import { registry } from "@web/core/registry";
import { stepUtils } from "@web_tour/js/tour_step_utils";
import { _t } from "web.core";

registry.category("web_tour.tours").add('calculator_tour', {
    sequence: 110,
    url: "/web",
    steps: [stepUtils.showAppsMenuItem(),
    {
        trigger: '.o_app[data-menu-xmlid="base.menu_administration"]',
        content: Markup(_t('Want a better way to <b>manage your projects</b>? <i>It starts here.</i>')),
        position: 'right',
    }, {
        trigger: 'button[data-menu-xmlid="base.menu_custom"]',
        position: 'bottom',
    }, {
        trigger: 'a[data-menu-xmlid="project.menu_calculator"]',
        position: 'bottom',
    }, {
        trigger: 'button[value="4"]',
        position: 'bottom',
        content: Markup(_t('Please click on 4')),
    }, {
        trigger: 'button[value="+"]',
        position: 'bottom',
        content: Markup(_t('Please click on + operator')),
    }, {
        trigger: 'button[value="5"]',
        position: 'bottom',
        content: Markup(_t('Please click on 5')),
    }, {
        trigger: 'button[value="="]',
        position: 'bottom',
        content: Markup(_t('Please click on = operator')),
    },
]});
