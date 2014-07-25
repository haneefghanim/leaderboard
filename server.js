var express = require("express");
var logfmt = require("logfmt");
var redis = require('redis');
var url = require('url');

var app = express();
var redisURL = url.parse(process.env.REDISCLOUD_URL);
var client = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
client.auth(redisURL.auth.split(":")[1]);

app.use(logfmt.requestLogger());

client.set('foo', 'bar');
client.get('foo', function (err, reply) {
    console.log(reply.toString()); // Will print `bar`
});

// app.get('/', function(req, res) {
//   res.send('Hello World!');
// });

// var port = Number(process.env.PORT || 5000);
// app.listen(port, function() {
//   console.log("Listening on " + port);
// });