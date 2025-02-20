# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from . import models


def _l10n_es_edi_post_init(env):
    for company in env['res.company'].search([('partner_id.country_id.code', '=', 'ES')]):
        ChartTemplate = env['account.chart.template'].with_company(company)
        taxes_data = ChartTemplate._get_es_edi_sii_account_tax()
        ChartTemplate._load_data({'account.tax': taxes_data})
