var expect = require("expect.js"),
	jsmop = require("../gbL.jsMop")
	;

describe("Given a temporary need for a receiver", function() {
	var received = [];
	var mop = new jsmop.Mop();
	describe("When I send within a registration closure", function() {

		mop.withRegistered({ receive_something: function(message) { received.push(message); } }, function() {
			mop.send("hello").as("something");
		});

		it("The registered object should receive", function() {
			expect(received).to.contain("hello");
		});

		describe("But when sending again", function() {
			mop.send("goodbye").as("something");

			it("should not receive the message", function() {
				expect(received).to.not.contain("goodbye");
			});
		});
	});
});