/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { ThreadService } from "@mail/core/thread_service";
import { patch } from "web.utils";

/** @type {import("@mail/core/thread_service").ThreadService} */
const threadServicePatch = {
    async getChat(person) {
        const { employeeId } = person;
        const _super = this._super.bind(this);
        if (!employeeId) {
            return _super(person);
        }
        let employee = this.store.employees[employeeId];
        if (!employee) {
            this.store.employees[employeeId] = { id: employeeId };
            employee = this.store.employees[employeeId];
        }
        if (!employee.user_id && !employee.hasCheckedUser) {
            employee.hasCheckedUser = true;
            const [employeeData] = await this.orm.silent.read(
                "hr.employee.public",
                [employee.id],
                ["user_id", "user_partner_id"],
                {
                    context: { active_test: false },
                }
            );
            if (employeeData) {
                employee.user_id = employeeData.user_id[0];
                let user = this.store.users[employee.user_id];
                if (!user) {
                    this.store.users[employee.user_id] = { id: employee.user_id };
                    user = this.store.users[employee.user_id];
                }
                user.partner_id = employeeData.user_partner_id[0];
                this.personaService.insert({
                    displayName: employeeData.user_partner_id[1],
                    id: employeeData.user_partner_id[0],
                    type: "partner",
                });
            }
        }
        if (!employee.user_id) {
            this.notificationService.add(
                _t("You can only chat with employees that have a dedicated user."),
                { type: "info" }
            );
            return;
        }
        return _super({ userId: employee.user_id });
    },
};

patch(ThreadService.prototype, "hr", threadServicePatch);
