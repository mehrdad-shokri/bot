const TelegramBot = require('node-telegram-bot-api');
var express = require('express');
var path = require('path');
var crypto = require('crypto');
var app = express();
var fs = require('fs');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

var plotly = require('plotly')(process.env.PLOTLY_USER, process.env.PLOTLY_API_KEY);

app.set('port', (process.env.PORT || 5000));

app.get('/', function (request, response) {
    // response.render('pages/index');
    response.sendStatus(200)
});

app.get('/chart', function (request, response) {

    var chat_id = request.query.chat_id;
    console.log(`Must create a chart for ${chat_id}!`);
    createChart(chat_id)
        .then((result) => {
            response.status(result.code).send(result.message);
        })
        .catch((reason) => {
            if (reason.code != null) {
                response.status(reason.code).send(reason.message);
            }
            else {
                response.status(500).send(reason);
            }

        });
});

app.listen(app.get('port'), function () {
    console.log('Chart service is running on port', app.get('port'));
});


var createChart = function (chat_id) {
    return new Promise((resolve, reject) => {
        //TODO Call to the endpoint
        try {

            // SAMPLE DATA
            var trace1 = {
                y: [0.2, 0.2, 0.6, 1.0, 0.5, 0.4, 0.2, 0.7, 0.9, 0.1, 0.5, 0.3],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-23'
            };
            var trace2 = {
                y: [0.6, 0.7, 0.3, 0.6, 0.0, 0.5, 0.7, 0.9, 0.5, 0.8, 0.7, 0.2],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-24'
            };
            var trace3 = {
                y: [0.2, 0.2, 0.6, 1.0, 0.5, 0.4, 0.2, 0.7, 0.9, 0.1, 0.5, 0.3],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-25'
            };
            var trace4 = {
                y: [0.6, 0.7, 0.3, 0.6, 0.0, 0.5, 0.7, 0.9, 0.5, 0.8, 0.7, 0.2],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-26'
            };
            var trace5 = {
                y: [0.2, 0.2, 0.6, 1.0, 0.5, 0.4, 0.2, 0.7, 0.9, 0.1, 0.5, 0.3],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-27'
            };
            var trace6 = {
                y: [0.6, 0.7, 0.3, 0.6, 0.0, 0.5, 0.7, 0.9, 0.5, 0.8, 0.7, 0.2],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-28'
            };
            var trace7 = {
                y: [0.2, 0.2, 0.6, 1.0, 0.5, 0.4, 0.2, 0.7, 0.9, 0.1, 0.5, 0.3],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-29'
            };
            var trace8 = {
                y: [0.6, 0.7, 0.3, 0.6, 0.0, 0.5, 0.7, 0.9, 0.5, 0.8, 0.7, 0.2],
                type: "box",
                marker: { color: '#FF851B' },
                name: '2017-10-30'
            };

            var figure = { 'data': [trace1, trace2, trace3, trace4, trace5, trace6, trace7, trace8] };

            var layout = {
                yaxis: {
                    title: "normalized moisture",
                    zeroline: false
                },
                xaxis: {
                    title: "Period"
                },
                boxmode: "group"
            };

            var imgOpts = {
                format: 'png',
                width: 1000,
                height: 500,
            };



            plotly.getImage(figure, imgOpts, function (error, imageStream) {
                if (error) {
                    console.log(error);
                    reject({ code: 500, message: error });
                }

                var chartName = crypto.randomBytes(6).toString('hex') + '.png';
                var fileStream = fs.createWriteStream(chartName).on('close', () => {

                    bot.sendPhoto(chat_id, chartName, { caption: 'Generic chart' })
                        .then(function () {
                            console.log(chartName + ' sent');
                            fs.unlinkSync(chartName);
                            console.log(chartName + ' deleted');

                            resolve({ code: 200, message: 'Success' });
                        })
                        .catch((reason) => {
                            reject({ code: reason.response.statusCode, message: reason.response.body });
                        });
                });

                imageStream.pipe(fileStream);

            });
        }
        catch (err) {
            console.log(err);
            reject({ code: 500, message: err });
        }
    });
}