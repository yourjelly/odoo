/** @odoo-module alias=web.legacySetup default=false **/

// in tests, there's nothing to setup globally (we don't want to deploy services),
// but this module must exist has it is required by other modules
export const legacySetupProm = Promise.resolve();
