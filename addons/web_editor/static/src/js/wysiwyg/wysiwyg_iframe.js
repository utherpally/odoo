/** @odoo-module **/

import Wysiwyg from "web_editor.wysiwyg";
import ajax from "web.ajax";
import core from "web.core";
import config from "web.config";

var qweb = core.qweb;
var promiseJsAssets;


/**
 * Add option (inIframe) to load Wysiwyg in an iframe.
 **/
Wysiwyg.include({
    /**
     * Add options to load Wysiwyg in an iframe.
     *
     * @override
     * @param {boolean} options.inIframe
     **/
    init: function (parent, options) {
        this._super.apply(this, arguments);
        if (this.options.inIframe) {
            this._onUpdateIframeId = 'onLoad_' + this.id;
        }
    },
    /**
     * Load assets to inject into iframe.
     *
     * @override
     **/
    willStart: async function () {
        if (!this.options.inIframe) {
            return this._super();
        }

        promiseJsAssets = promiseJsAssets || ajax.loadAsset('web_editor.wysiwyg_iframe_editor_assets');
        const assetsPromises = [promiseJsAssets];
        if (this.options.iframeCssAssets) {
            assetsPromises.push(ajax.loadAsset(this.options.iframeCssAssets));
        }
        this.defAsset = Promise.all(assetsPromises);

        const _super = this._super.bind(this);
        await this.defAsset;
        await _super();
    },

    /**
     * @override
     **/
    startEdition: async function () {
        const _super = this._super.bind(this);
        if (!this.options.inIframe) {
            return _super();
        } else {
            await this._loadIframe();
            return _super();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     **/
    _getEditorOptions: function () {
        const options = this._super.apply(this, arguments);
        options.getContextFromParentRect = () => {
            return this.$iframe && this.$iframe.length ? this.$iframe[0].getBoundingClientRect() : { top: 0, left: 0 };
        };
        return options;
    },
    /**
     * Create iframe, inject css and create a link with the content,
     * then inject the target inside.
     *
     * @private
     * @returns {Promise}
     */
    _loadIframe: function () {
        var self = this;
        const isEditableRoot = this.$editable === this.$root;
        this.$editable = $('<div class="note-editable oe_structure odoo-editor-editable"></div>');
        this.$el.removeClass('note-editable oe_structure odoo-editor-editable');
        if (isEditableRoot) {
            this.$root = this.$editable;
        }
        this.$iframe = $('<iframe class="wysiwyg_iframe o_iframe">').css({
            'min-height': '55vh',
            width: '100%'
        });
        var avoidDoubleLoad = 0; // this bug only appears on some configurations.

        // resolve promise on load
        var def = new Promise(function (resolve) {
            window.top[self._onUpdateIframeId] = function (_avoidDoubleLoad) {
                if (_avoidDoubleLoad !== avoidDoubleLoad) {
                    console.warn('Wysiwyg iframe double load detected');
                    return;
                }
                delete window.top[self._onUpdateIframeId];
                var $iframeTarget = self.$iframe.contents().find('#iframe_target');
                // copy the html in itself to have the node prototypes relative
                // to this window rather than the iframe window.
                const $targetClone = $iframeTarget.clone();
                $targetClone.find('script').remove();
                $iframeTarget.html($targetClone.html());
                self.$iframeBody = $iframeTarget;
                $iframeTarget.attr("isMobile", config.device.isMobile);
                const $utilsZone = $('<div class="iframe-utils-zone">');
                self.$utilsZone = $utilsZone;

                const $iframeWrapper = $('<div class="iframe-editor-wrapper odoo-editor">');
                const $codeview = $('<textarea class="o_codeview d-none"/>');
                self.$editable.addClass('o_editable oe_structure');

                $iframeTarget.append($codeview);
                $iframeTarget.append($iframeWrapper);
                $iframeTarget.append($utilsZone);
                $iframeWrapper.append(self.$editable);

                self.options.toolbarHandler = $('#web_editor-top-edit', self.$iframe[0].contentWindow.document);
                $iframeTarget.on('click', '.o_fullscreen_btn', function () {
                    $("body").toggleClass("o_field_widgetTextHtml_fullscreen");
                    var full = $("body").hasClass("o_field_widgetTextHtml_fullscreen");
                    self.$iframe.parents().toggleClass('o_form_fullscreen_ancestor', full);
                    $(window).trigger("resize"); // induce a resize() call and let other backend elements know (the navbar extra items management relies on this)
                });
                resolve();
            };
        });
        this.$iframe.data('loadDef', def); // for unit test

        // inject content in iframe

        this.$iframe.on('load', function onLoad (ev) {
            var _avoidDoubleLoad = ++avoidDoubleLoad;
            self.defAsset.then(function (assets) {
                if (_avoidDoubleLoad !== avoidDoubleLoad) {
                    console.warn('Wysiwyg immediate iframe double load detected');
                    return;
                }

                var iframeContent = qweb.render('wysiwyg.iframeContent', {
                    assets: assets,
                    updateIframeId: self._onUpdateIframeId,
                    avoidDoubleLoad: _avoidDoubleLoad
                });
                self.$iframe[0].contentWindow.document
                    .open("text/html", "replace")
                    .write(`<!DOCTYPE html><html${
                        self.options.iframeHtmlClass ? ' class="' + self.options.iframeHtmlClass +'"' : ''
                    }>${iframeContent}</html>`);
            });
            self.options.document = self.$iframe[0].contentWindow.document;
        });

        this.$el.append(this.$iframe);

        return def.then(() => {
            this.options.onIframeUpdated();
        });
    },

    _insertSnippetMenu: function () {
        if (this.options.inIframe) {
            return this.snippetsMenu.appendTo(this.$utilsZone);
        } else {
            return this._super.apply(this, arguments);
        }
    },

    /**
     * Bind the blur event on the iframe so that it would not blur when using
     * the sidebar.
     *
     * @override
     */
    _bindOnBlur: function () {
        if (!this.options.inIframe) {
            this._super.apply(this, arguments);
        } else {
            this.$iframe[0].contentWindow.addEventListener('blur', this._onBlur);
        }
    },
});
