var profiler = require("v8-profiler");

var jsmop = require("../gbL.jsMop")
	;

function Receiver() {
	var I = { receive: {} };
	I.received = [];
	I.receive.helloWorld = function(message) {
		console.log("Received:", message);
	};
	return I;
}

function Sender() {
	var I = { send: {} };
	I.send.helloWorld = function(message) { };
	return I;
}

var mop = new jsmop.Mop();
var receiver = new Receiver();
var sender = new Sender();
mop.register(receiver, "Receiver").register(sender, "Sender");

var snapshot = profiler.takeSnapshot("test");
profiler.startProfiling("test");

for(var i = 0; i < 1000; i++) {
	sender.send.helloWorld("hi");
}

profiler.stopProfiling("test");

