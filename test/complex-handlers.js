var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

describe("Given a registered handler with a toString method", function() {

	var count = 0;

	var handler = function() { count++; };
	handler.toString = function() { return "spy"; }; // use case - when a sinon.spy is a handler

	var mop = new jsmop.Mop();
	mop.registerHandler("hello", handler, {}, "test");
	mop.send().as("hello");

	describe("When the handler is unregistered, and a message is sent again", function() {
		mop.unregisterHandler(handler);
		mop.send().as("hello");

		it("Should not receive the message", function() {
			expect(count).to.be(1);
		});

		describe("And when another handler with the same name is registered, and a message is again sent", function() {
			var handler2 = function() { };
			handler2.toString = function() { return "spy"; };
			mop.registerHandler("hello", handler2, {}, "test");
			mop.send().as("hello");

			it("The original handler should not receive a message", function() {
				expect(count).to.be(1);
			});
		});
	});

});