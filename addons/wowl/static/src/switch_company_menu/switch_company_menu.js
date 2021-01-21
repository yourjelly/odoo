/** @odoo-module **/
import { useService } from '../core/hooks';
import { Dropdown } from '../components/dropdown/dropdown';
import { DropdownItem } from '../components/dropdown/dropdown_item';

export class SwitchCompanyMenu extends owl.Component {
  constructor() {
    super(...arguments);
    this.device = useService('device');
    this.user = useService('user');
  }
  toggleCompany(companyId) {
    this.trigger('switch-companies', {
      mode: 'toggle',
      companyId
    });
  }
  logIntoCompany(companyId) {
    this.trigger('switch-companies', {
      mode: 'loginto',
      companyId
    });
  }
}
SwitchCompanyMenu.template = "wowl.SwitchCompanyMenu";
SwitchCompanyMenu.components = { Dropdown , DropdownItem };
