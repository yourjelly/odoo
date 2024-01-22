/** @odoo-module */

export function handleShortcuts(dispatch, shortcuts, event) {
    for (const [command, shortcut] of Object.entries(shortcuts)) {
        if (shortcut(event)) {
            event.preventDefault();
            dispatch(command);
        }
    }
}
