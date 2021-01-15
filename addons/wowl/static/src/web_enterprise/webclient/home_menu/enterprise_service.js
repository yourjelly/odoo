/** @odoo-module **/

export const enterpriseService = {
  name: "enterprise",
  dependencies: [],
  deploy() {
    const { session_info } = odoo;

    // session_info.warning = "admin";
    // session_info.expiration_date = "2021-02-11 11:27:02";
    // session_info.expiration_reason = "trial";
    return {
      warning: session_info.warning,
      expirationDate: session_info.expiration_date,
      expirationReason: session_info.expiration_reason,
    };
  },
};
