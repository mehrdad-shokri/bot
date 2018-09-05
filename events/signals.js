const fs = require('fs')
var api = require('../core/api')
var errorManager = require('../util/error')
var dateUtil = require('../util/dates')
var _ = require('lodash')
var signalHelper = require('../util/signal-helper')

var NodeCache = require('node-cache')
var cache = new NodeCache()


const TelegramBot = require('node-telegram-bot-api')
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: false })
const telegram_message_options = {
    parse_mode: "Markdown"
}

var horizons = ['long', 'medium', 'short']
var subscriptionTemplates = {}
initSubscriptionTemplates()

var opts =
    {
        "parse_mode": "Markdown",
        "disable_web_page_preview": "true"
    };

function notify(message_data) {

    if (message_data != undefined) {
        var risk = message_data.risk;
        var signal_counter_currency

        console.log(`${message_data.signal} signal`);

        return signalHelper.applyTemplate(message_data)
            .then(telegram_signal_message => {
                if (!telegram_signal_message) throw new Error(errorManager.generic_error_message)

                return api.getSignals(message_data.signal).then(signalsJson => {
                    if (signalsJson) {
                        var signal = JSON.parse(signalsJson)[0]
                        signal.trend = message_data.trend
                        signal.source = message_data.source

                        var users_cache = cache.get('users')
                        if (!users_cache) {
                            return api.getUsers().then(usersJson => {
                                var users = JSON.parse(usersJson)
                                console.log('Reloading users cache for signal dispatching...')
                                cache.set('users', users, 3300)
                                return notifyUsers(users, signal, message_data, telegram_signal_message)
                            })
                        } else {
                            return notifyUsers(users_cache, signal, message_data, telegram_signal_message)
                        }
                    }
                })
            })
    }
}

function notifyUsers(users, signal, message_data, telegram_signal_message) {

    //var horizon = message_data.horizon;
    var hrzns = horizons.slice(horizons.indexOf(message_data.horizon))
    users = users.filter(usr => hrzns.indexOf(usr.settings.horizon) >= 0)
    users = users.filter(user => (user.is_ITT_team || user.eula))

    var signalForNonno = isForNonno(signal, message_data)
    var signalForFree = isForFree(signal, message_data)
    var signalForStarter = isForStarter(signal, message_data)
    var signalForPro = isForPro(signal, message_data)
    var signalForAdvanced = isForAdvanced(signal, message_data)

    var matchingStarterUsers = users.filter(user => (user.settings.is_ITT_team || dateUtil.getDaysLeftFrom(user.settings.subscriptions.paid) > 0 || (user.settings.staking && user.settings.staking.diecimila)) &&
        user.settings.transaction_currencies.indexOf(message_data.transaction_currency) >= 0 &&
        user.settings.counter_currencies.indexOf(parseInt(message_data.counter_currency)) >= 0 &&
        !user.settings.is_muted
    )

    matchingStarterUsers = matchingStarterUsers.filter(user => {
        var matchingIndicator = user.settings.indicators.find(ind => ind.name == signal.label)
        return matchingIndicator && matchingIndicator.enabled
    })

    matchingStarterUsers = matchingStarterUsers.filter(user => {
        var matchingExchange = user.settings.exchanges.find(exc => exc.label.toLowerCase() == signal.source.toLowerCase())
        return matchingExchange && matchingExchange.enabled
    })

    var matchingBetaUsers = users.filter(user =>
        dateUtil.getDaysLeftFrom(user.settings.subscriptions.beta) > 0 &&
        dateUtil.getDaysLeftFrom(user.settings.subscriptions.paid) <= 0 &&
        !user.settings.is_ITT_team &&
        user.settings.transaction_currencies.indexOf(message_data.transaction_currency) >= 0 &&
        user.settings.counter_currencies.indexOf(parseInt(message_data.counter_currency)) >= 0 &&
        !user.settings.is_muted
    )

    var freeOnlyUsers = users.filter(user => (
        !user.settings.is_ITT_team &&
        dateUtil.getDaysLeftFrom(user.settings.subscriptions.paid) <= 0 &&
        dateUtil.getDaysLeftFrom(user.settings.subscriptions.beta) <= 0))

    var subscribers = []

    if (signalForFree) {
        subscribers = freeOnlyUsers
        subscribers = subscribers.concat(matchingBetaUsers)
    }
    else if (signalForNonno) {
        subscribers = subscribers.concat(matchingBetaUsers)
    }

    if (signalForStarter)
        subscribers = _.unionBy(subscribers, matchingStarterUsers, 'telegram_chat_id')

    if (signalForPro)
        subscribers = _.unionBy(subscribers, matchingStarterUsers.filter(u => u.settings.staking && u.settings.staking.diecimila), 'telegram_chat_id')

    if (signalForAdvanced)
        subscribers = _.unionBy(subscribers, matchingStarterUsers.filter(u => u.settings.staking && u.settings.staking.centomila), 'telegram_chat_id')

    var rejections = []
    var reasons = []
    var notificationPromises = []
    var subscribersIds = []

    subscribers.map(subscriber => {
        var notificationPromise = bot.sendMessage(subscriber.telegram_chat_id, telegram_signal_message, opts)
            .then(() => {
                subscribersIds.push(subscriber.telegram_chat_id)
            })
            .catch(err => {
                rejections.push(subscriber.telegram_chat_id)
                reasons.push(`${subscriber.telegram_chat_id} :: ${err.message.includes('400') ? 'Not Existing' : err.message.includes('403') ? 'Blocked' : err.message}`)
                console.log(`${err.message} :: chat ${subscriber.telegram_chat_id}`)
            })

        notificationPromises.push(notificationPromise)
    })

    return Promise.all(notificationPromises)
        .then(() => {
            return api.lastDispatchedSignal(subscribersIds, message_data.id).then(() => {
                return { signal_id: message_data.id, rejections: rejections, reasons: reasons, sent_at: new Date(message_data.sent_at * 1000) }
            })
        })
}

function isForFree(signal, message_data) {

    var isUptrend = message_data.trend > 0
    var isUSDT = message_data.counter_currency == 2

    return IsDeliverableTo('free', signal, message_data) && isUptrend && isUSDT
}

function isForNonno(signal, message_data) {
    return IsDeliverableTo('beta', signal, message_data)
}

function isForStarter(signal, message_data) {
    return IsDeliverableTo('paid', signal, message_data)
}

function isForPro(signal, message_data) {
    return IsDeliverableTo('diecimila', signal, message_data)
}

function isForAdvanced(signal, message_data) {
    return IsDeliverableTo('centomila', signal, message_data)
}

function IsDeliverableTo(pricingPlan, signal, message_data) {

    var template = subscriptionTemplates[pricingPlan]
    var isSubscribedToTickers = template.tickers.length == 0 || template.tickers.indexOf(message_data.transaction_currency) >= 0
    var canDeliverToLevel = signal.deliverTo.indexOf(pricingPlan) >= 0
    var hasTheRightHorizon = !template.horizon || horizons.indexOf(message_data.horizon) <= horizons.indexOf(template.horizon)
    var isAllowedExchange = !template.exchanges || template.exchanges.length <= 0 || template.exchanges.indexOf(message_data.source.toLowerCase()) >= 0
    return isSubscribedToTickers && canDeliverToLevel && hasTheRightHorizon && isAllowedExchange
}

var buildHorizonFilter = (horizon) => {
    return `horizon=${horizons.slice(horizons.indexOf(horizon)).join(',')}`;
}

function initSubscriptionTemplates() {
    var freePromise = api.getSubscriptionTemplate('free')
    var nonnoPromise = api.getSubscriptionTemplate('beta')
    var starterPromise = api.getSubscriptionTemplate('paid')
    var diecimilaPromise = api.getSubscriptionTemplate('diecimila')
    var centomilaPromise = api.getSubscriptionTemplate('centomila')

    Promise.all([freePromise, nonnoPromise, starterPromise, diecimilaPromise, centomilaPromise]).then(templates => {
        subscriptionTemplates.free = JSON.parse(templates[0])
        subscriptionTemplates.beta = JSON.parse(templates[1])
        subscriptionTemplates.paid = JSON.parse(templates[2])
        subscriptionTemplates.diecimila = JSON.parse(templates[3])
        subscriptionTemplates.centomila = JSON.parse(templates[4])
    })
}

module.exports = { notify: notify }