/** @odoo-module */

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";

import { HotkeyCommandItem } from "@web/core/commands/default_providers";

const { Component } = owl;

export class EmployeeCommand extends Component {}
EmployeeCommand.template = "hr.EmployeeCommand";

export class EmployeeAdvancedSearchCommand extends HotkeyCommandItem {}
EmployeeAdvancedSearchCommand.template = "hr.EmployeeAdvancedSearchCommand";

const commandSetupRegistry = registry.category("command_setup");
commandSetupRegistry.add("$", {
    debounceDelay: 300,
    emptyMessage: _lt("No employee found"),
    name: _lt("employees"),
    placeholder: _lt("Search for an employee..."),
});

const commandProviderRegistry = registry.category("command_provider");
commandProviderRegistry.add("employees", {
    namespace: "$",
    async provide(env, options) {
        const employeesData = await Component.env.services.rpc({
            model: 'hr.employee.public',
            method: 'search_read',
            kwargs: {
                domain: [['name', 'ilike', options.searchValue]],
                fields: ['name', 'id', 'write_date', 'job_title', 'job_id'],
                limit: 10,
            },
        });

        const isOfficer = await env.services.user.hasGroup('hr.group_hr_user');
        const resModel = isOfficer ? 'hr.employee' : 'hr.employee.public';

        const result = employeesData.map((employee) => ({
            Component: EmployeeCommand,
            category: "employees",
            name: employee.name,
            action() {
                env.services.action.doAction({
                    type: 'ir.actions.act_window',
                    name: employee.name,
                    res_id: employee.id,
                    res_model: resModel,
                    views: [[false, 'form']],
                });
            },
            href: `/web#id=${employee.id}&model=${resModel}&view_type=form`,
            props: {
                job: employee.job_title || employee.job_id && employee.job_id[1],
                avatar_url: `/web/image?model=${resModel}&id=${employee.id}&field=avatar_128`,
            },
        }));

        result.push({
            Component: EmployeeAdvancedSearchCommand,
            category: "employees",
            name: _lt("Advanced Search"),
            action() {
                env.services.action.doAction('hr.hr_employee_public_action', {
                    additionalContext: {
                        search_default_name: options.searchValue,
                    }
                });
            },
            props: {
                hotkey: "alt+B",
            },
        });

        return result;
    },
});
