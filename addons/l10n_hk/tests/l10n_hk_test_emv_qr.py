# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import UserError
from odoo.fields import Command
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged


@tagged('post_install_l10n', 'post_install', '-at_install')
class L10nHkTestEMVQRCode(AccountTestInvoicingCommon):
    """ Test the generation of the EMV QR Code on invoices """

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_hk.l10n_hk_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.company_data['company'].qr_code = True
        cls.company_data['company'].partner_id.update({
            'country_id': cls.env.ref('base.hk').id,
            'city': 'HK',
        })

        cls.acc_emv_hk = cls.env['res.partner.bank'].create({
            'acc_number': '123456789012345678',
            'partner_id': cls.company_data['company'].partner_id.id,
            'l10n_hk_fps_type': 'mobile',
            'l10n_hk_fps_identifier': '+852-67891234',
        })

        cls.acc_emv_hk_without_fps_info = cls.env['res.partner.bank'].create({
            'acc_number': '1234567890',
            'partner_id': cls.company_data['company'].partner_id.id,
        })

        cls.emv_qr_invoice = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'currency_id': cls.env.ref('base.HKD').id,
            'partner_bank_id': cls.acc_emv_hk.id,
            'company_id': cls.company_data['company'].id,
            'invoice_line_ids': [Command.create({'quantity': 1, 'price_unit': 100})],
        })

    def l10n_hk_test_emv_qr_code_generation(self):
        self.emv_qr_invoice.qr_code_method = 'emv_qr'
        self.emv_qr_invoice._generate_qr_code()

        # Using bank account with non Hong Kong Partner should fail
        self.company_data['company'].partner_id.country_id = False
        with self.assertRaises(UserError, msg="The chosen QR-code type is not eligible for this invoice."):
            self.emv_qr_invoice._generate_qr_code()

        # Using invoice currency other than HKD or CNY should fail
        self.company_data['company'].partner_id.country_id = self.env.ref('base.hk')
        self.emv_qr_invoice.currency_id = self.env.ref('base.USD')
        with self.assertRaises(UserError, msg="The chosen QR-code type is not eligible for this invoice."):
            self.emv_qr_invoice._generate_qr_code()

        # Without company partner city should fail
        self.emv_qr_invoice.currency_id = self.env.ref('base.HKD')
        self.company_data['company'].partner_id.city = False
        with self.assertRaises(UserError, msg="Missing Merchant City."):
            self.emv_qr_invoice._generate_qr_code()

        # Without fps infomation should fail
        self.company_data['company'].partner_id.city = 'HK'
        self.emv_qr_invoice.partner_bank_id = self.acc_emv_hk_without_fps_info
        with self.assertRaises(UserError, msg="The account receiving the payment must have a FPS type and a FPS identifier set."):
            self.emv_qr_invoice._generate_qr_code()

    def l10n_hk_test_emv_qr_vals(self):
        self.emv_qr_invoice.qr_code_method = 'emv_qr'
        unstruct_ref = self.emv_qr_invoice.ref or self.emv_qr_invoice.name
        emv_qr_vals = self.emv_qr_invoice.partner_bank_id._get_qr_vals(
            qr_method=self.emv_qr_invoice.qr_code_method,
            amount=self.emv_qr_invoice.amount_residual,
            currency=self.emv_qr_invoice.currency_id,
            debtor_partner=self.emv_qr_invoice.partner_id,
            free_communication=unstruct_ref,
            structured_communication=self.emv_qr_invoice.payment_reference,
        )

        # Check crc16 value
        crc16 = emv_qr_vals[-1]
        self.assertEqual(crc16, '3CA6')

        # Check the whole qr code string
        qr_code_string = ''.join(emv_qr_vals)
        self.assertEqual(qr_code_string, '00020101021226330012hk.com.hkicl0313+852-678912345204000053033445405115.05802HK5914company_1_data6002HK63043CA6')
