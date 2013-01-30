var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

describe("Given mop with registered object receiving one message", function() {

	var mop = new jsmop.Mop();

	var receiver = {
		helloCount : 0,
		receive: {
			"helloWorld" : function() {
				receiver.helloCount++;
			}
		}
	};

	var sender = {
		send: {
			"helloWorld" : function() { }
		}
	};

	mop.register(receiver, "hello receiver");
	mop.register(sender, "hello sender");

	var methodTime = 0, messageTime = 0;

	describe("When the method is called 1000000 times", function() {

		receiver.helloCount = 0;
		var start = new Date().valueOf();
		for(var i = 0; i < 1000000; i++) {
			receiver.receive.helloWorld();
		}
		var end = new Date().valueOf();
		var total = receiver.helloCount;

		methodTime = end - start;

		it("it should have been called the correct number of times", function() {

			console.log("Time taken:", methodTime);
			expect(total).to.eql(1000000);

		});

	});

	describe("When the message is sent 1000000 times", function() {

		receiver.helloCount = 0;
		var start = new Date().valueOf();
		for(var i = 0; i < 1000000; i++) {
			sender.send.helloWorld();
		}
		var end = new Date().valueOf();
		var total = receiver.helloCount;

		messageTime = end - start;

		it("it should have been called the correct number of times", function() {

			console.log("Time taken:", messageTime);
			expect(total).to.eql(1000000);

		});

	});

});