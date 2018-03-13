var request = require('request');
var rpromise = require('request-promise');
var node_svc_api = `${process.env.ITT_NODE_SERVICES}/api`;
var node_svc_api_key = process.env.NODE_SVC_API_KEY;

var request_opts = {
    headers: {
        'NSVC-API-KEY': node_svc_api_key
    },
    json: true
}

module.exports = {
    verify: (txHash, telegram_chat_id) => {
        request_opts.method = 'POST'
        request_opts.uri = `${node_svc_api}/payment/verify`
        request_opts.body = {
            txHash: txHash,
            telegram_chat_id: telegram_chat_id
        }
        return rpromise(request_opts)
    },
    userInfo: (telegram_chat_id) => {
        request_opts.method = 'GET'
        request_opts.uri = `${node_svc_api}/payment/status/${telegram_chat_id}`
        return rpromise(request_opts)
    }
}