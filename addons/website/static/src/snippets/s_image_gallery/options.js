/** @odoo-module **/

import { MediaDialogWrapper } from "@web_editor/components/media_dialog/media_dialog";
import { ComponentWrapper } from "web.OwlCompatibility";
import core from "web.core";
import options from "web_editor.snippets.options";

var _t = core._t;
var qweb = core.qweb;

options.registry.gallery = options.Class.extend({
    /**
     * @override
     */
    start: function () {
        var self = this;

        // Make sure image previews are updated if images are changed
        this.$target.on('image_changed.gallery', 'img', function (ev) {
            var $img = $(ev.currentTarget);
            var index = self.$target.find('.carousel-item.active').index();
            self.$('.carousel:first li[data-bs-target]:eq(' + index + ')')
                .css('background-image', 'url(' + $img.attr('src') + ')');
        });

        // When the snippet is empty, an edition button is the default content
        // TODO find a nicer way to do that to have editor style
        this.$target.on('click.gallery', '.o_add_images', function (e) {
            e.stopImmediatePropagation();
            self.addImages(false);
        });

        this.$target.on('dropped.gallery', 'img', function (ev) {
            self.mode(null, self.getMode());
            if (!ev.target.height) {
                $(ev.target).one('load', function () {
                    setTimeout(function () {
                        self.trigger_up('cover_update');
                    });
                });
            }
        });

        const $container = this.$('> .container, > .container-fluid, > .o_container_small');
        if ($container.find('> *:not(div)').length) {
            self.mode(null, self.getMode());
        }

        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    onBuilt: function () {
        if (this.$target.find('.o_add_images').length) {
            this.addImages(false);
        }
        // TODO should consider the async parts
        this._adaptNavigationIDs();
    },
    /**
     * @override
     */
    onClone: function () {
        this._adaptNavigationIDs();
    },
    /**
     * @override
     */
    cleanForSave: function () {
        if (this.$target.hasClass('slideshow')) {
            this.$target.removeAttr('style');
        }
    },
    /**
     * @override
     */
    destroy() {
        this._super(...arguments);
        this.$target.off('.gallery');
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Allows to select images to add as part of the snippet.
     *
     * @see this.selectClass for parameters
     */
    addImages: function (previewMode) {
        const $images = this.$('img');
        var $container = this.$('> .container, > .container-fluid, > .o_container_small');
        const lastImage = this._getImages().at(-1);
        let index = lastImage ? this._getIndex(lastImage) : -1;
        const dialog = new ComponentWrapper(this, MediaDialogWrapper, {
            multiImages: true,
            onlyImages: true,
            save: images => {
                let $newImageToSelect;
                for (const image of images) {
                    const $img = $('<img/>', {
                        class: $images.length > 0 ? $images[0].className : 'img img-fluid d-block ',
                        src: image.src,
                        'data-index': ++index,
                        alt: image.alt || '',
                        'data-name': _t('Image'),
                        style: $images.length > 0 ? $images[0].style.cssText : '',
                    }).appendTo($container);
                    if (!$newImageToSelect) {
                        $newImageToSelect = $img;
                    }
                }
                if (images.length > 0) {
                    this.mode('reset', this.getMode());
                    this.trigger_up('cover_update');
                    // Triggers the re-rendering of the thumbnail
                    $newImageToSelect.trigger('image_changed');

                }
            },
        });
        dialog.mount(this.el);
    },
    /**
     * Allows to change the number of columns when displaying images with a
     * grid-like layout.
     *
     * @see this.selectClass for parameters
     */
    columns: function (previewMode, widgetValue, params) {
        const nbColumns = parseInt(widgetValue || '1');
        this.$target.attr('data-columns', nbColumns);

        this.mode(previewMode, this.getMode(), {}); // TODO improve
    },
    /**
     * Get the image target's layout mode (slideshow, masonry, grid or nomode).
     *
     * @returns {String('slideshow'|'masonry'|'grid'|'nomode')}
     */
    getMode: function () {
        var mode = 'slideshow';
        if (this.$target.hasClass('o_masonry')) {
            mode = 'masonry';
        }
        if (this.$target.hasClass('o_grid')) {
            mode = 'grid';
        }
        if (this.$target.hasClass('o_nomode')) {
            mode = 'nomode';
        }
        return mode;
    },
    /**
     * Displays the images with the "grid" layout.
     */
    grid: function () {
        var imgs = this._getImages();
        var $row = $('<div/>', {class: 'row s_nb_column_fixed'});
        var columns = this._getColumns();
        var colClass = 'col-lg-' + (12 / columns);
        var $container = this._replaceContent($row);

        imgs.forEach((img, index) => {
            var $img = $(img);
            var $col = $('<div/>', {class: colClass});
            $col.append($img).appendTo($row);
            if ((index + 1) % columns === 0) {
                $row = $('<div/>', {class: 'row s_nb_column_fixed'});
                $row.appendTo($container);
            }
        });
        this.$target.css('height', '');
    },
    /**
     * Displays the images with the "masonry" layout.
     */
    masonry: function () {
        var self = this;
        var imgs = this._getImages();
        var columns = this._getColumns();
        var colClass = 'col-lg-' + (12 / columns);
        var cols = [];

        var $row = $('<div/>', {class: 'row s_nb_column_fixed'});
        this._replaceContent($row);

        // Create columns
        for (var c = 0; c < columns; c++) {
            var $col = $('<div/>', {class: 'o_masonry_col o_snippet_not_selectable ' + colClass});
            $row.append($col);
            cols.push($col[0]);
        }

        // Dispatch images in columns by always putting the next one in the
        // smallest-height column
        while (imgs.length) {
            var min = Infinity;
            var $lowest;
            cols.forEach((col) => {
                var $col = $(col);
                var height = $col.is(':empty') ? 0 : $col.find('img').last().offset().top + $col.find('img').last().height() - self.$target.offset().top;
                if (height < min) {
                    min = height;
                    $lowest = $col;
                }
            });
            // Only on Chrome: appended images are sometimes invisible and not
            // correctly loaded from cache, we use a clone of the image to force
            // the loading.
            $lowest.append(imgs.shift().cloneNode());
        }
    },
    /**
     * Allows to change the images layout. @see grid, masonry, nomode, slideshow
     *
     * @see this.selectClass for parameters
     */
    mode: function (previewMode, widgetValue, params) {
        widgetValue = widgetValue || 'slideshow'; // FIXME should not be needed
        this.$target.css('height', '');
        this.$target
            .removeClass('o_nomode o_masonry o_grid o_slideshow')
            .addClass('o_' + widgetValue);
        // Used to prevent the editor's "unbreakable protection mechanism" from
        // restoring Image Wall adaptations (images removed > new images added
        // to the container & layout updates) when adding new images to the
        // snippet.
        if (this.options.wysiwyg) {
            this.options.wysiwyg.odooEditor.unbreakableStepUnactive();
        }
        this[widgetValue]();
        this.trigger_up('cover_update');
        this._refreshPublicWidgets();
    },
    /**
     * Displays the images with the standard layout: floating images.
     */
    nomode: function () {
        var $row = $('<div/>', {class: 'row s_nb_column_fixed'});
        var imgs = this._getImages();

        this._replaceContent($row);

        imgs.forEach((img) => {
            var wrapClass = 'col-lg-3';
            if (img.width >= img.height * 2 || img.width > 600) {
                wrapClass = 'col-lg-6';
            }
            var $wrap = $('<div/>', {class: wrapClass}).append(img);
            $row.append($wrap);
        });
    },
    /**
     * Allows to remove all images. Restores the snippet to the way it was when
     * it was added in the page.
     *
     * @see this.selectClass for parameters
     */
    removeAllImages: function (previewMode) {
        var $addImg = $('<div>', {
            class: 'alert alert-info css_non_editable_mode_hidden text-center',
        });
        var $text = $('<span>', {
            class: 'o_add_images',
            style: 'cursor: pointer;',
            text: _t(" Add Images"),
        });
        var $icon = $('<i>', {
            class: ' fa fa-plus-circle',
        });
        this._replaceContent($addImg.append($icon).append($text));
    },
    /**
     * Displays the images with a "slideshow" layout.
     */
    slideshow: function () {
        const imageEls = this._getImages();
        const images = imageEls.map((img) => ({
            // Use getAttribute to get the attribute value otherwise .src
            // returns the absolute url.
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
        }));
        var currentInterval = this.$target.find('.carousel:first').attr('data-bs-interval');
        var params = {
            images: images,
            index: 0,
            title: "",
            interval: currentInterval || 0,
            id: 'slideshow_' + new Date().getTime(),
            attrClass: imageEls.length > 0 ? imageEls[0].className : '',
            attrStyle: imageEls.length > 0 ? imageEls[0].style.cssText : '',
        },
        $slideshow = $(qweb.render('website.gallery.slideshow', params));
        this._replaceContent($slideshow);
        this.$("img").toArray().forEach((img, index) => {
            $(img).attr({contenteditable: true, 'data-index': index});
        });
        this.$target.css('height', Math.round(window.innerHeight * 0.7));

        // Apply layout animation
        this.$target.off('slide.bs.carousel').off('slid.bs.carousel');
        this.$('li.fa').off('click');
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Handles image removals and image index updates.
     *
     * @override
     */
    notify: function (name, data) {
        this._super(...arguments);
        if (name === 'image_removed') {
            data.$image.remove(); // Force the removal of the image before reset
            this.mode('reset', this.getMode());
        } else if (name === 'image_index_request') {
            var imgs = this._getImages();
            var position = imgs.indexOf(data.$image[0]);
            imgs.splice(position, 1);
            switch (data.position) {
                case 'first':
                    imgs.unshift(data.$image[0]);
                    break;
                case 'prev':
                    imgs.splice(position - 1, 0, data.$image[0]);
                    break;
                case 'next':
                    imgs.splice(position + 1, 0, data.$image[0]);
                    break;
                case 'last':
                    imgs.push(data.$image[0]);
                    break;
            }
            position = imgs.indexOf(data.$image[0]);
            imgs.forEach((img, index) => {
                // Note: there might be more efficient ways to do that but it is
                // more simple this way and allows compatibility with 10.0 where
                // indexes were not the same as positions.
                $(img).attr('data-index', index);
            });
            const currentMode = this.getMode();
            this.mode('reset', currentMode);
            if (currentMode === 'slideshow') {
                const $carousel = this.$target.find('.carousel');
                $carousel.removeClass('slide');
                $carousel.carousel(position);
                this.$target.find('.carousel-indicators li').removeClass('active');
                this.$target.find('.carousel-indicators li[data-bs-slide-to="' + position + '"]').addClass('active');
                this.trigger_up('activate_snippet', {
                    $snippet: this.$target.find('.carousel-item.active img'),
                    ifInactiveOptions: true,
                });
                $carousel.addClass('slide');
            } else {
                this.trigger_up('activate_snippet', {
                    $snippet: data.$image,
                    ifInactiveOptions: true,
                });
            }
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _adaptNavigationIDs: function () {
        var uuid = new Date().getTime();
        this.$target.find('.carousel').attr('id', 'slideshow_' + uuid);
        this.$target.find('[data-bs-slide], [data-bs-slide-to]').toArray().forEach((el) => {
            var $el = $(el);
            if ($el.attr('data-bs-target')) {
                $el.attr('data-bs-target', '#slideshow_' + uuid);
            } else if ($el.attr('href')) {
                $el.attr('href', '#slideshow_' + uuid);
            }
        });
    },
    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'mode': {
                let activeModeName = 'slideshow';
                for (const modeName of params.possibleValues) {
                    if (this.$target.hasClass(`o_${modeName}`)) {
                        activeModeName = modeName;
                        break;
                    }
                }
                this.activeMode = activeModeName;
                return activeModeName;
            }
            case 'columns': {
                return `${this._getColumns()}`;
            }
        }
        return this._super(...arguments);
    },
    /**
     * @private
     */
    async _computeWidgetVisibility(widgetName, params) {
        if (widgetName === 'slideshow_mode_opt') {
            return false;
        }
        return this._super(...arguments);
    },
    /**
     * Returns the images, sorted by index.
     *
     * @private
     * @returns {DOMElement[]}
     */
    _getImages: function () {
        var imgs = this.$('img').get();
        var self = this;
        imgs.sort(function (a, b) {
            return self._getIndex(a) - self._getIndex(b);
        });
        return imgs;
    },
    /**
     * Returns the index associated to a given image.
     *
     * @private
     * @param {DOMElement} img
     * @returns {integer}
     */
    _getIndex: function (img) {
        return img.dataset.index || 0;
    },
    /**
     * Returns the currently selected column option.
     *
     * @private
     * @returns {integer}
     */
    _getColumns: function () {
        return parseInt(this.$target.attr('data-columns')) || 3;
    },
    /**
     * Empties the container, adds the given content and returns the container.
     *
     * @private
     * @param {jQuery} $content
     * @returns {jQuery} the main container of the snippet
     */
    _replaceContent: function ($content) {
        var $container = this.$('> .container, > .container-fluid, > .o_container_small');
        $container.empty().append($content);
        return $container;
    },
});

options.registry.gallery_img = options.Class.extend({
    /**
     * Rebuilds the whole gallery when one image is removed.
     *
     * @override
     */
    onRemove: function () {
        this.trigger_up('option_update', {
            optionName: 'gallery',
            name: 'image_removed',
            data: {
                $image: this.$target,
            },
        });
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Allows to change the position of an image (its order in the image set).
     *
     * @see this.selectClass for parameters
     */
    position: function (previewMode, widgetValue, params) {
        this.trigger_up('option_update', {
            optionName: 'gallery',
            name: 'image_index_request',
            data: {
                $image: this.$target,
                position: widgetValue,
            },
        });
    },
});
