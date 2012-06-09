var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given require('gbL.jsMop')", function() {

	it("the boot function should be available", function() {
		expect(mop.boot).to.be.a("function");
	});

	describe("when a handler is registered", function() {

		var helloWorldHandlerData = [];

		mop.registerHandler(["hello", "world"], function(data) {
			helloWorldHandlerData.push(data);
		});

		describe("and when a message is sent with matching subject", function() {
			mop.send("hi").as("hello", "world");
		
			it("the handler should receive the message", function() {
				expect(helloWorldHandlerData).to.contain("hi");
			});
		});

		describe("and when a message is sent with matching partial subject", function() {
			mop.send("hi 2").as("hello", "world", "other");

			it("The handler should still receive the message", function() {
				expect(helloWorldHandlerData).to.contain("hi 2");
			});
		});

	});

	describe("when a handler is registered using space-delimited syntax", function() {
		
		var helloHeavenHandlerData = [];

		mop.registerHandler("hello heaven", function(data) {
			helloHeavenHandlerData.push(data);
		});

		describe("and a message is sent with matching subject", function() {
			mop.send("hi").as("hello", "heaven");

			it("the handler should receive the message", function() {
				expect(helloHeavenHandlerData).to.contain("hi");
			});
		});
	});

});