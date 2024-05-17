/** @odoo-module **/

import {Component, useState} from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

export class KioskManualSelection extends Component {
    static template = "hr_attendance.public_kiosk_manual_selection";
    static components = {
        Dropdown,
        DropdownItem,
    };
    static props = {
        employees: { type: Array },
        displayBackButton: { type: Boolean },
        departments: { type: Array },
        onSelectEmployee: { type: Function },
    };

    setup() {
        this.state = useState({
            displayedEmployees : this.props.employees,
            searchInput: ""
        });
        this.displayedEmployees = this.props.employees
    }
    onDepartementClick(dep_id){
        if (dep_id){
            this.state.displayedEmployees = this.props.employees.filter(item => item.department.id === dep_id)
        }else{
            this.state.displayedEmployees = this.props.employees
        }
    }

    // Changes needed. Can probably be combined with above
    onDepartementClickMobile(dep_id){
        let departmentName = "All departments";
        if (dep_id){
            this.state.displayedEmployees = this.props.employees.filter(item => item.department.id === dep_id);
            
            const selectedDepartment = this.props.departments.find(dep => dep.id === dep_id);
            if (selectedDepartment) {
                departmentName = selectedDepartment.name;
            }
        } else {
            this.state.displayedEmployees = this.props.employees;
        }
        
        document.getElementById('departmentButton').innerHTML = `${departmentName}`;
    }

    onSearchInput(ev) {
        const searchInput = ev.target.value;
        if (searchInput.length){
            this.state.displayedEmployees = this.props.employees.filter(item => item.name.toLowerCase().includes(searchInput.toLowerCase()))
        }else{
            this.state.displayedEmployees = this.props.employees
        }
    }
}
