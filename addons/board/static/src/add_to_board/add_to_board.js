/** @odoo-module **/

import { Dropdown } from "@web/core/dropdown/dropdown";
import { registry } from "@web/core/registry";
import { useAutofocus, useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";

const { Component, useState } = owl;
const cogMenuRegistry = registry.category("cogMenu");

/**
 * 'Add to board' menu
 *
 * Component consisiting of a toggle button, a text input and an 'Add' button.
 * The first button is simply used to toggle the component and will determine
 * whether the other elements should be rendered.
 * The input will be given the name (or title) of the view that will be added.
 * Finally, the last button will send the name as well as some of the action
 * properties to the server to add the current view (and its context) to the
 * user's dashboard.
 * This component is only available in actions of type 'ir.actions.act_window'.
 * @extends Component
 */
export class AddToBoard extends Component {
    setup() {
        this.notification = useService("notification");
        this.rpc = useService("rpc");
        this.state = useState({ name: this.env.config.getDisplayName() });

        useAutofocus();
    }

    //---------------------------------------------------------------------
    // Protected
    //---------------------------------------------------------------------

    async addToBoard() {
        const { domain, globalContext } = this.env.searchModel;
        const {
            comparison,
            context,
            groupBys,
            orderBy,
        } = this.env.searchModel.getPreFavoriteValues();
        const contextToSave = {
            ...globalContext,
            ...context,
            comparison,
            orderedBy: orderBy,
            group_by: groupBys,
            dashboard_merge_domains_contexts: false,
        };

        const result = await this.rpc("/board/add_to_dashboard", {
            action_id: this.env.config.actionId || false,
            context_to_save: contextToSave,
            domain,
            name: this.state.name,
            view_mode: this.env.config.viewType,
        });

        if (result) {
            this.notification.add(
                this.env._t("Please refresh your browser for the changes to take effect."),
                {
                    title: sprintf(this.env._t(`"%s" added to dashboard`), this.state.name),
                    type: "warning",
                }
            );
            this.state.name = this.env.config.getDisplayName();
        } else {
            this.notification.add(this.env._t("Could not add filter to dashboard"), {
                type: "danger",
            });
        }
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * @param {KeyboardEvent} ev
     */
    onInputKeydown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.addToBoard();
        }
    }
}

AddToBoard.template = "board.AddToBoard";
AddToBoard.components = { Dropdown };

export const addToBoardItem = {
    Component: AddToBoard,
    groupNumber: 4,
    isDisplayed: ({ config }) => config.actionType === "ir.actions.act_window" && config.actionId,
};

cogMenuRegistry.add("add-to-board", addToBoardItem, { sequence: 10 });
