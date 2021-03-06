var api = require('../../core/api')
require('../../util/extensions')
var dateUtils = require('../../util/dates')
var nopreview_markdown_opts = require('../../bot/telegramInstance').nopreview_markdown_opts

var moduleBot = null
var upgradeToPro = 'Upgrade to the Pro plan by sending'
var extendYourSubscription = (daysLeft) => { return `Your subscription will expire in ${Math.max(daysLeft, 0)} days.\nTo extend your subscription send` }

var getCurrentStatusMessage = (settings, itt_usd_rate) => {
    var paidDaysLeft = dateUtils.getDaysLeftFrom(settings.subscriptions.paid)
    var currentPlan = paidDaysLeft > 0 || settings.is_ITT_team || settings.staking.diecimila ? 'Pro' : 'FREE'
    var usdPricePerSecond = 20 * 12 / 365.25 / 24 / 3600
    var oneMonthInSeconds = 2629746

    return `Subscription | *${currentPlan}* plan\n[View all available subscription plans](intelligenttrading.org/pricing).

${paidDaysLeft <= 0 && !settings.is_ITT_team ? upgradeToPro : extendYourSubscription(paidDaysLeft)} ITT tokens to the address below. You will be notified as soon as the transaction is confirmed.

‣ Receiver address: ${settings.ittWalletReceiverAddress}
‣ ITT token price: $${itt_usd_rate} USDT
‣ Tokens required for 1 month: ${Math.ceil(oneMonthInSeconds * usdPricePerSecond / itt_usd_rate)}
‣ ITT available on the following exchanges: Coss.io, [Mercatox](https://mercatox.com/), [Idex](https://idex.market/), [ForkDelta](https://forkdelta.github.io/)`
}

module.exports = function (bot) {
    moduleBot = bot
    this.cmd = (msg, params) => {
        const chat_id = msg.chat.id
        var currentStatusMsg = 'Tap or type /settings and follow the instructions to upgrade or extend your subscription.'
        moduleBot.sendMessage(chat_id, currentStatusMsg, nopreview_markdown_opts)
    }

    /*this.cmd = (msg, params) => {
        const chat_id = msg.chat.id
        Promise.all([api.getUser(chat_id), getITTRate()]).then(fulfillments => {
            var user = JSON.parse(fulfillments[0])
            var itt_usd_rate = fulfillments[1]
            var currentStatusMsg = getCurrentStatusMessage(user.settings, itt_usd_rate)
            return currentStatusMsg
        }).then((msg) => {
            moduleBot.sendMessage(chat_id, msg, nopreview_markdown_opts)
        })
    }*/
}

var getITTRate = () => {
    return api.getITT().then(itt_json => {
        var itt = JSON.parse(itt_json)
        return parseFloat(itt.close).toFixed(3)
    })
}


