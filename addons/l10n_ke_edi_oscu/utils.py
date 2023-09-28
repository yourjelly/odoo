# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

_required_fields_TrnsSalesSaveWrReq = {
    'trdInvcNo', 'orgInvcNo', 'rcptTyCd', 'salesSttsCd', 'cfmDt',
    'salesDt', 'totItemCnt', 'taxblAmtA', 'taxblAmtB', 'taxblAmtC',
    'taxblAmtD', 'taxblAmtE', 'taxAmtA', 'taxAmtB', 'taxAmtC',
    'taxAmtD', 'taxAmtE', 'taxRtA', 'taxRtB', 'taxRtC', 'taxRtD',
    'taxRtE', 'totTaxblAmt', 'totTaxAmt', 'totAmt', 'prchrAcptcYn',
    'regrId', 'regrNm', 'modrId', 'modrNm',
}
_required_fields_TrnsSalesSaveWrReceipt = {'rcptPbctDt', 'prchrAcptcY'}
_required_fields_TrnsSalesSaveWrItem = {
    'itemSeq', 'itemClsCd', 'itemNm', 'pkgUnitCd', 'pkg',
    'qtyUnitCd', 'qty', 'prc', 'splyAmt', 'dcRt', 'dcAmt', 'taxTyCd',
    'taxblAmt', 'taxAmt', 'totAmt',
}
_required_fields_StockMasterSaveReq = {
    'itemCd', 'rsdQty', 'regrId', 'regrNm', 'modrId', 'modrNm',
}
_required_fields_ItemSaveReq = {
    'itemCd', 'itemClsCd', 'itemTyCd', 'itemNm', 'orgnNatCd',
    'pkgUnitCd', 'qtyUnitCd', 'taxTyCd', 'dftPrc', 'isrcAplcbYn',
    'useYn', 'regrId', 'regrNm', 'modrId', 'modrNm',
}
_required_fields_StockIOSaveReq = {
    'sarNo', 'orgSarNo', 'regTyCd', 'sarTyCd', 'ocrnDt', 'totItemCnt',
    'totTaxblAmt', 'totTaxAmt', 'totAmt', 'regrId', 'regrNm', 'modrId',
    'modrNm',
}
_required_fields_StockIoItemSaveReq = {
    'itemSeq', 'itemClsCd', 'itemNm', 'pkg', 'pkgUnitCd', 'qty', 'prc',
    'splyAmt', 'totDcAmt', 'taxblAmt', 'taxTyCd', 'taxAmt', 'totAmt',
}
_required_fields_TrnsPurchaseSaveReq = {
    'invcNo', 'orgInvcNo', 'regTyCd', 'pchsTyCd', 'rcptTyCd', 'pmtTyCd',
    'pchsSttsCd', 'pchsDt', 'totItemCnt', 'taxblAmtA', 'taxblAmtB',
    'taxblAmtC', 'taxblAmtD', 'taxblAmtE', 'taxRtA', 'taxRtB', 'taxRtC',
    'taxRtD', 'taxRtE', 'taxAmtA', 'taxAmtB', 'taxAmtC', 'taxAmtD',
    'taxAmtE', 'totTaxblAmt', 'totTaxAmt', 'totAmt', 'regrId', 'regrNm',
    'modrId', 'modrNm',
}

def check_required_fields(object_id, content):
    """ Ensure the required fields have some content, dependent on the type of request

    :param object_id: string representing the type of request as defined in the OSCU documentation,
                      determines which fields are required.
    :param content: dict representing thejson content of the request.
    :return: a list representing the missing fields.
    """

    required_fields = {
        'TrnsSalesSaveWrReq':     _required_fields_TrnsSalesSaveWrReq,
        'TrnsSalesSaveWrReceipt': _required_fields_TrnsSalesSaveWrReceipt,
        'TrnsSalesSaveWrItem':    _required_fields_TrnsSalesSaveWrItem,
        'ItemSaveReq':            _required_fields_ItemSaveReq,
        'StockIOSaveReq':         _required_fields_StockIOSaveReq,
        'StockIoItemSaveReq':     _required_fields_StockIoItemSaveReq,
        'StockMasterSaveReq':     _required_fields_StockMasterSaveReq,
        'TrnsPurchaseSaveReq':    _required_fields_TrnsPurchaseSaveReq,
    }.get(object_id)
    missing_content = []
    for field in required_fields:
        if (content[field] is False or content[field] is None):
           missing_content.append(field)
    return missing_content
