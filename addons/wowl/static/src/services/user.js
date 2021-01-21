/** @odoo-module **/
import { SwitchCompanyMenu } from '../switch_company_menu/switch_company_menu';

export function computeAllowedCompanyIds(cidsFromHash) {
  const { user_companies } = odoo.session_info;

  let allowedCompanies = cidsFromHash || [];
  const allowedCompaniesFromSession = user_companies.allowed_companies.map(([id, name]) => id);
  const notReallyAllowedCompanies = allowedCompanies.filter(
    (id) => !allowedCompaniesFromSession.includes(id)
  );
  if (!allowedCompanies.length || notReallyAllowedCompanies.length) {
    allowedCompanies = [user_companies.current_company[0]];
  }
  return allowedCompanies;
}

function makeSwitchCompanies(env, reloadFn) {
  const { cookie, router, user } = env.services;
  let reloadTimeout;
  function doReload() {
    odoo.browser.clearTimeout(reloadTimeout);
    reloadTimeout = odoo.browser.setTimeout(() => {
      reloadTimeout = undefined;
      reloadFn();
    });
  }
  return (mode, companyId) => {
    let currentCompanies = user.context.allowed_company_ids.slice();
    if (mode === 'toggle') {
      if (currentCompanies.includes(companyId)) {
        currentCompanies = currentCompanies.filter(id => id !== companyId);
      } else {
        currentCompanies.push(companyId);
      }
    } else if (mode === 'loginto') {
      if (currentCompanies.includes(companyId)) {
        currentCompanies = currentCompanies.filter(id => id !== companyId);
      }
      currentCompanies.unshift(companyId);
    }
    const newCompanyIds = currentCompanies.join(',');
    router.pushState({
      'lock cids': newCompanyIds,
    });
    cookie.setCookie('cids', newCompanyIds);
    doReload();
  };
}

export function makeSwitchCompaniesSystray(reloadFn) {
  class SwitchCompanySystrayItem extends owl.Component {
    constructor() {
      super(...arguments);
      this.switchCompanies = makeSwitchCompanies(this.env, reloadFn);
    }
  }
  SwitchCompanySystrayItem.template = owl.tags.xml`
    <t t-component="props.Item" switchCompanies="switchCompanies"/>
  `;
  return {
    name: 'SwitchCompanyMenu',
    Component: SwitchCompanySystrayItem,
    sequence: 1,
    props: { Item: SwitchCompanyMenu },
  };
}

export const userService = {
  name: "user",
  dependencies: ["router", "cookie"],
  deploy(env) {
    const {router, cookie} = env.services;
    const info = odoo.session_info;
    const {
      user_context,
      username,
      name,
      is_admin,
      partner_id,
      user_companies,
      home_action_id,
      db,
      show_effect: showEffect,
    } = info;

    let cids;
    if ("cids" in router.current.hash) {
      cids = router.current.hash.cids;
    } else if ("cids" in cookie.current) {
      cids = cookie.current.cids;
    }
    const allowedCompanies = computeAllowedCompanyIds(cids && cids.split(",").map((id) => parseInt(id, 10)));
    let context = {
      lang: user_context.lang,
      tz: user_context.tz,
      uid: info.uid,
      allowed_company_ids: allowedCompanies,
    };

    cids = allowedCompanies.join(",");
    router.replaceState({ "lock cids": cids });
    cookie.setCookie("cids", cids);
    if (user_companies.allowed_companies.length > 1) {
      const systrayItem = makeSwitchCompaniesSystray(() => window.location.reload());
      odoo.systrayRegistry.add(systrayItem.name, systrayItem);
    }
    return {
      context,
      get userId() {
        return context.uid;
      },
      name,
      userName: username,
      isAdmin: is_admin,
      partnerId: partner_id,
      allowed_companies: user_companies.allowed_companies,
      current_company: user_companies.allowed_companies.find(([id]) => id === allowedCompanies[0]),
      get lang() {
        return context.lang;
      },
      get tz() {
        return context.tz;
      },
      home_action_id,
      db,
      showEffect,
    };
  },
};
