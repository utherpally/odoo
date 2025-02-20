/** @odoo-module */

import { registry } from "@web/core/registry";
import { odooExceptionTitleMap } from "@web/core/errors/error_dialogs";
import { ConnectionLostError, RPCError } from "@web/core/network/rpc_service";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";
import { ErrorTracebackPopup } from "@point_of_sale/js/Popups/ErrorTracebackPopup";
import { OfflineErrorPopup } from "@point_of_sale/js/Popups/OfflineErrorPopup";
import { _t } from "@web/core/l10n/translation";

export function identifyError(error) {
    return error && error.legacy ? error.message : error;
}

function rpcErrorHandler(env, error, originalError) {
    error = identifyError(originalError);
    if (error instanceof RPCError) {
        const { message, data } = error;
        if (odooExceptionTitleMap.has(error.exceptionName)) {
            const title = odooExceptionTitleMap.get(error.exceptionName).toString();
            env.services.popup.add(ErrorPopup, { title, body: data.message });
        } else {
            env.services.popup.add(ErrorTracebackPopup, {
                title: message,
                body: data.message + "\n" + data.debug + "\n",
            });
        }
        return true;
    }
}
registry.category("error_handlers").add("rpcErrorHandler", rpcErrorHandler);

function offlineErrorHandler(env, error, originalError) {
    error = identifyError(originalError);
    if (error instanceof ConnectionLostError) {
        env.services.popup.add(OfflineErrorPopup);
        return true;
    }
}
registry.category("error_handlers").add("offlineErrorHandler", offlineErrorHandler);

function defaultErrorHandler(env, error, originalError) {
    originalError = identifyError(originalError);
    if (error instanceof Error) {
        env.services.popup.add(ErrorTracebackPopup, {
            title: `${originalError.name}: ${originalError.message}`,
            body: error.traceback,
        });
    } else {
        env.services.popup.add(ErrorPopup, {
            title: _t("Unknown Error"),
            body: _t("Unable to show information about this error."),
        });
    }
    return true;
}
registry
    .category("error_handlers")
    .add("defaultErrorHandler", defaultErrorHandler, { sequence: 99 });
