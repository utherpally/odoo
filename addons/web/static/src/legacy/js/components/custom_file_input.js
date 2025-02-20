/** @odoo-module alias=web.CustomFileInput **/
    
    import { LegacyComponent } from "@web/legacy/legacy_component";
    const { useRef } = owl;

    /**
     * Custom file input
     *
     * Component representing a customized input of type file. It takes a sub-template
     * in its default t-slot and uses it as the trigger to open the file upload
     * prompt.
     * @extends Component
     */
    class CustomFileInput extends LegacyComponent {
        /**
         * @param {Object} [props]
         * @param {string} [props.accepted_file_extensions='*'] Comma-separated
         *      list of authorized file extensions (default to all).
         * @param {string} [props.action='/web/binary/upload'] Route called when
         *      a file is uploaded in the input.
         * @param {string} [props.id]
         * @param {string} [props.model]
         * @param {string} [props.multi_upload=false] Whether the input should allow
         *      to upload multiple files at once.
         */
        setup() {
            this.fileInputRef = useRef('file-input');
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Upload an attachment to the given action with the given parameters:
         * - ufile: list of files contained in the file input
         * - csrf_token: CSRF token provided by the odoo global object
         * - model: a specific model which will be given when creating the attachment
         * - id: the id of the model target instance
         * @private
         */
        async _onFileInputChange() {
            const { action, model, id } = this.props;
            const params = {
                csrf_token: odoo.csrf_token,
                ufile: [...this.fileInputRef.el.files],
            };
            if (model) {
                params.model = model;
            }
            if (id) {
                params.id = id;
            }
            const fileData = await this.env.services.httpRequest(action, params, 'text');
            const parsedFileData = JSON.parse(fileData);
            if (parsedFileData.error) {
                throw new Error(parsedFileData.error);
            }
            this.trigger('uploaded', { files: parsedFileData });
        }

        /**
         * Redirect clicks from the trigger element to the input.
         * @private
         */
        _onTriggerClicked() {
            this.fileInputRef.el.click();
        }
    }
    CustomFileInput.defaultProps = {
        accepted_file_extensions: '*',
        action: '/web/binary/upload',
        multi_upload: false,
        onUpload: () => {},
    };
    CustomFileInput.props = {
        accepted_file_extensions: { type: String, optional: true },
        action: { type: String, optional: true },
        id: { type: Number, optional: true },
        model: { type: String, optional: true },
        multi_upload: { type: Boolean, optional: true },
        onUpload: { type: Function, optional: true },
        slots: { type: Object, optional: true },
    };
    CustomFileInput.template = 'web.CustomFileInput';

    export default CustomFileInput;
