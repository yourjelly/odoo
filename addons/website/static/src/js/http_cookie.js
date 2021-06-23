/** @odoo-module **/

import cookieUtils from 'web.utils.cookies';

const originFunc = cookieUtils.checkCookie;
cookieUtils.checkCookie = (type, name) => {
    const result = originFunc.apply(cookieUtils, [type, name]);
    if (result && type === 'optional') {
        const consents = JSON.parse(cookieUtils.get_cookie('accepted_cookie_types') || '{}');
        if ('optional' in consents) {
            return consents['optional'];
        }
        return !document.getElementById('cookies-consent-essential');
    }
    // Pass-through if already forbidden for another reason or a type that is
    // not restricted by the website module.
    return result;
};
