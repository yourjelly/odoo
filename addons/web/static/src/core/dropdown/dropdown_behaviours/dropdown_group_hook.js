/** @odoo-module **/
import { useEnv, useEffect, useComponent } from "@odoo/owl";

export function useDropdownGroup() {
    const env = useEnv();

    const group = {
        isInGroup: "dropdownGroup" in env,
        get isOpen() {
            return this.isInGroup && [...env.dropdownGroup].some((dropdown) => dropdown.isOpen);
        },
    };

    if (group.isInGroup) {
        const dropdown = useComponent();
        useEffect(() => {
            env.dropdownGroup.add(dropdown.state);
            return () => env.dropdownGroup.delete(dropdown.state);
        });
    }

    return group;
}
