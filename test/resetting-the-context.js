var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given a hub with registered handlers", function() {
	
	mop.register({
		receive_hello_world : function() {
			return "hello to you too";
		}
	});

	describe("When I send a hello world", function() {
		var result = mop.send().as("hello world");

		it("Should respond with hello to you too", function() {
			expect(result).to.be("hello to you too");
		});

		describe("But when I reset the context and send the same message", function() {
			var result2 = mop
				.reset()
				.send().as("hello world");

			it("Should no longer receive a response", function() {
				expect(result2).to.be.empty();
			});
		});
	});
});