
module.exports = {
    getButtonCallbackData: (cmd, data, functon, navigation) => getButtonCallbackData(cmd, data, functon, navigation)
}

function getButtonCallbackData(cmd, d, f, n) {
    var dataObject = { cmd: cmd }
    if (d && Object.keys(d).length > 0)
        dataObject.d = d
    if (f) dataObject.f = f
    if (n) dataObject.n = n

    var callbackData = JSON.stringify(dataObject).trim()
    if (callbackData.length > 64) {
        throw new Error('Button callback data string is too long')
    }

    return callbackData
}