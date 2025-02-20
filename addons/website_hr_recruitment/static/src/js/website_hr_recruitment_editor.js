/** @odoo-module **/

import core from "web.core";
import FormEditorRegistry from "website.form_editor_registry";

var _t = core._t;

FormEditorRegistry.add('apply_job', {
    formFields: [{
        type: 'char',
        modelRequired: true,
        name: 'partner_name',
        fillWith: 'name',
        string: 'Your Name',
    }, {
        type: 'email',
        required: true,
        fillWith: 'email',
        name: 'email_from',
        string: 'Your Email',
    }, {
        type: 'char',
        required: true,
        fillWith: 'phone',
        name: 'partner_mobile',
        string: 'Phone Number',
    }, {
        type: 'char',
        name: 'linkedin_profile',
        string: 'LinkedIn Profile',
    }, {
        type: 'text',
        name: 'description',
        string: 'Short Introduction',
    }, {
        type: 'binary',
        custom: true,
        name: 'Resume',
    }],
    fields: [{
        name: 'job_id',
        type: 'many2one',
        relation: 'hr.job',
        string: _t('Applied Job'),
    }, {
        name: 'department_id',
        type: 'many2one',
        relation: 'hr.department',
        string: _t('Department'),
    }],
    successPage: '/job-thank-you',
});
