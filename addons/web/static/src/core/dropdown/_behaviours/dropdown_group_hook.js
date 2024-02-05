import { useComponent, useEffect, useEnv } from "@odoo/owl";
import { DROPDOWN_GROUP } from "@web/core/dropdown/dropdown_group";

export function useDropdownGroup() {
    const env = useEnv();

    const group = {
        isInGroup: DROPDOWN_GROUP in env,
        get isOpen() {
            return this.isInGroup && [...env[DROPDOWN_GROUP]].some((dropdown) => dropdown.isOpen);
        },
    };

    if (group.isInGroup) {
        const dropdown = useComponent();
        useEffect(() => {
            env[DROPDOWN_GROUP].add(dropdown.state);
            return () => env[DROPDOWN_GROUP].delete(dropdown.state);
        });
    }

    return group;
}
