/** @odoo-module **/

    import tour from 'web_tour.tour';

    tour.register('crm_rainbowman', {
        test: true,
        url: "/web",
    }, [
        tour.stepUtils.showAppsMenuItem(),
        {
            trigger: ".o_app[data-menu-xmlid='crm.crm_menu_root']",
            content: "open crm app",
        }, {
            trigger: ".o-kanban-button-new",
            content: "click create",
        }, {
            trigger: ".o_field_widget[name=name] input",
            content: "complete name",
            run: "text Test Lead 1",
        }, {
            trigger: ".o_field_widget[name=expected_revenue] input",
            content: "complete expected revenue",
            run: "text 999999997",
        }, {
            trigger: "button.o_kanban_add",
            content: "create lead",
        }, { //OWL BUG: can not move a newly created record directly, go to lead's form view and back.
            trigger: ".o_kanban_record .o_kanban_record_title:contains('Test Lead 1')",
            content: "open lead",
        }, {
            trigger: '.o_back_button',
            content: 'navigate back to the kanban view',
            position: "bottom",
            run: "click",
        }, {
            trigger: ".o_kanban_record .o_kanban_record_title:contains('Test Lead 1')",
            content: "move to won stage",
            run: function () {
                // OWL BUG: current implementation of drag_and_drop does not work with owl views
                const from = this.$anchor[0];
                const to = $(`.o_opportunity_kanban .o_kanban_group:eq(3)`)[0];
                from.dispatchEvent(new Event("mouseenter", { bubbles: true }));
                from.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, which: 1, button: 0, clientX: 0, clientY: 0}));
                from.dispatchEvent(new Event("mousemove", { bubbles: true }));
                to.dispatchEvent(new Event("mouseenter", { bubbles: true }));
                from.dispatchEvent(new Event("mouseup", { bubbles: true }));
            },
        }, {
            trigger: ".o_reward_rainbow",
            extra_trigger: ".o_reward_rainbow",
            run: function () {} // check rainbowman is properly displayed
        }, {
            trigger: ".o-kanban-button-new",
            content: "create second lead",
        }, {
            trigger: ".o_field_widget[name=name] input",
            content: "complete name",
            run: "text Test Lead 2",
        }, {
            trigger: ".o_field_widget[name=expected_revenue] input",
            content: "complete expected revenue",
            run: "text 999999998",
        }, {
            trigger: "button.o_kanban_add",
            content: "create lead",
        }, {
            trigger: ".o_kanban_record .o_kanban_record_title:contains('Test Lead 2')",
            run: function () {} // wait for the record to be properly created
        }, {
            // move first test back to new stage to be able to test rainbowman a second time
            trigger: ".o_kanban_record .o_kanban_record_title:contains('Test Lead 1')",
            content: "move back to new stage",
            run: "drag_and_drop .o_opportunity_kanban .o_kanban_group:eq(0) "
        }, {
            trigger: ".o_kanban_record .o_kanban_record_title:contains('Test Lead 2')",
            content: "click on second lead",
        }, {
            trigger: ".o_statusbar_status button[data-value='4']",
            content: "move lead to won stage",
        }, {
            trigger: ".o_statusbar_status button[data-value='1']",
            extra_trigger: ".o_reward_rainbow",
            content: "move lead to previous stage & rainbowman appears",
        }, {
            trigger: "button[name=action_set_won_rainbowman]",
            content: "click button mark won",
        }, {
            trigger: ".o_menu_brand",
            extra_trigger: ".o_reward_rainbow",
            content: "last rainbowman appears",
        }
    ]);
