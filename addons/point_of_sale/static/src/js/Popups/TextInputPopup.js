/** @odoo-module */

import { AbstractAwaitablePopup } from "@point_of_sale/js/Popups/AbstractAwaitablePopup";
import { _lt } from "@web/core/l10n/translation";
import { onMounted, useRef, useState } from "@odoo/owl";

// formerly TextInputPopupWidget
export class TextInputPopup extends AbstractAwaitablePopup {
    static template = "TextInputPopup";
    static defaultProps = {
        confirmText: _lt("Confirm"),
        cancelText: _lt("Discard"),
        confirmKey: "Enter",
        title: "",
        body: "",
        startingValue: "",
        placeholder: "",
    };

    setup() {
        super.setup();
        this.state = useState({ inputValue: this.props.startingValue });
        this.inputRef = useRef("input");
        onMounted(this.onMounted);
    }
    _onWindowKeyup(event) {
        if (event.key === this.props.confirmKey) {
            this.confirm();
        } else {
            super._onWindowKeyup(...arguments);
        }
    }
    onMounted() {
        this.inputRef.el.focus();
    }
    getPayload() {
        return this.state.inputValue;
    }
}
