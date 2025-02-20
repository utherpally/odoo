/** @odoo-module */
import { TicketScreen } from "@point_of_sale/js/Screens/TicketScreen/TicketScreen";
import { useAutofocus } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { parseFloat } from "@web/views/fields/parsers";
import { ConfirmPopup } from "@point_of_sale/js/Popups/ConfirmPopup";
import { Component, useState } from "@odoo/owl";

patch(TicketScreen.prototype, "pos_restaurant.TicketScreen", {
    _getScreenToStatusMap() {
        return Object.assign(this._super(...arguments), {
            PaymentScreen: this.pos.globalState.config.set_tip_after_payment
                ? "OPEN"
                : this._super(...arguments).PaymentScreen,
            TipScreen: "TIPPING",
        });
    },
    getTable(order) {
        if (order.getTable()) {
            return `${order.getTable().floor.name} (${order.getTable().name})`;
        }
    },
    //@override
    _getSearchFields() {
        if (!this.pos.globalState.config.module_pos_restaurant) {
            return this._super(...arguments);
        }
        return Object.assign({}, this._super(...arguments), {
            TABLE: {
                repr: this.getTable.bind(this),
                displayName: this.env._t("Table"),
                modelField: "table_id.name",
            },
        });
    },
    async _setOrder(order) {
        const { globalState } = this.pos;
        if (!globalState.config.module_pos_restaurant || globalState.table) {
            return this._super(...arguments);
        }
        // we came from the FloorScreen
        const orderTable = order.getTable();
        await globalState.setTable(orderTable, order.uid);
        this.close();
    },
    get allowNewOrders() {
        return this.pos.globalState.config.module_pos_restaurant
            ? Boolean(this.pos.globalState.table)
            : this._super(...arguments);
    },
    _getOrderList() {
        if (this.pos.globalState.table) {
            return this.pos.globalState.getTableOrders(this.pos.globalState.table.id);
        }
        return this._super(...arguments);
    },
    async settleTips() {
        // set tip in each order
        for (const order of this.getFilteredOrderList()) {
            const tipAmount = parseFloat(order.uiState.TipScreen.inputTipAmount || "0");
            const serverId = this.pos.globalState.validated_orders_name_server_id_map[order.name];
            if (!serverId) {
                console.warn(
                    `${order.name} is not yet sync. Sync it to server before setting a tip.`
                );
            } else {
                const result = await this.setTip(order, serverId, tipAmount);
                if (!result) {
                    break;
                }
            }
        }
    },
    //@override
    _selectNextOrder(currentOrder) {
        if (this.pos.globalState.config.module_pos_restaurant && this.pos.globalState.table) {
            return this._super(...arguments);
        }
    },
    //@override
    async onDeleteOrder(order) {
        const _super = this._super;
        const { globalState } = this.pos;
        if (globalState.config.module_pos_restaurant) {
            globalState.setOrderToRemove(order);
            await _super(...arguments);
            if (!globalState.table) {
                await globalState._removeOrdersFromServer();
            }
        } else {
            await _super(...arguments);
        }
    },
    async setTip(order, serverId, amount) {
        const { globalState } = this.pos;
        try {
            const paymentline = order.get_paymentlines()[0];
            if (paymentline.payment_method.payment_terminal) {
                paymentline.amount += amount;
                globalState.set_order(order, { silent: true });
                await paymentline.payment_method.payment_terminal.send_payment_adjust(
                    paymentline.cid
                );
            }

            if (!amount) {
                await this.setNoTip(serverId);
            } else {
                order.finalized = false;
                order.set_tip(amount);
                order.finalized = true;
                const tip_line = order.selected_orderline;
                await this.orm.call("pos.order", "set_tip", [serverId, tip_line.export_as_JSON()]);
            }
            if (order === globalState.get_order()) {
                this._selectNextOrder(order);
            }
            globalState.removeOrder(order);
            return true;
        } catch {
            const { confirmed } = await this.popup.add(ConfirmPopup, {
                title: "Failed to set tip",
                body: `Failed to set tip to ${order.name}. Do you want to proceed on setting the tips of the remaining?`,
            });
            return confirmed;
        }
    },
    async setNoTip(serverId) {
        await this.orm.call("set_no_tip", "pos.order", [serverId]);
    },
    _getOrderStates() {
        const result = this._super(...arguments);
        if (this.pos.globalState.config.set_tip_after_payment) {
            result.delete("PAYMENT");
            result.set("OPEN", { text: this.env._t("Open"), indented: true });
            result.set("TIPPING", { text: this.env._t("Tipping"), indented: true });
        }
        return result;
    },
    async onDoRefund() {
        const order = this.getSelectedSyncedOrder();
        if (this.pos.globalState.config.module_pos_restaurant && order) {
            this.pos.globalState.setTable(
                order.table ? order.table : Object.values(this.pos.globalState.tables_by_id)[0]
            );
        }
        this._super(...arguments);
    },
    isDefaultOrderEmpty(order) {
        if (this.pos.globalState.config.module_pos_restaurant) {
            return false;
        }
        return this._super(...arguments);
    },
});

export class TipCell extends Component {
    static template = "TipCell";

    setup() {
        super.setup();
        this.state = useState({ isEditing: false });
        this.orderUiState = this.props.order.uiState.TipScreen;
        useAutofocus();
    }
    get tipAmountStr() {
        return this.env.utils.formatCurrency(parseFloat(this.orderUiState.inputTipAmount || "0"));
    }
    onBlur() {
        this.state.isEditing = false;
    }
    onKeydown(event) {
        if (event.key === "Enter") {
            this.state.isEditing = false;
        }
    }
    editTip() {
        this.state.isEditing = true;
    }
}

patch(TicketScreen, "pos_restaurant.TicketScreen.components", {
    components: { ...TicketScreen.components, TipCell },
});
