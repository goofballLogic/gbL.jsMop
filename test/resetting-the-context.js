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

			var busOnResetCalls = 0;
			var I = { bus: { onReset: function() { busOnResetCalls++; } } };
			mop.register(I);

			var result2 = mop
				.reset()
				.send().as("hello world");

			var firstResetCallCount = busOnResetCalls;

			it("Should no longer receive a response", function() {
				expect(result2).to.be.empty();
			});

			it("Should have called the onReset callback", function() {
				expect(firstResetCallCount).to.equal(1);
			});

			describe("And when I reset again", function() {

				mop.reset();

				var secondResetCallCount = busOnResetCalls;

				it("Should not have called the onReset callback a second time", function() {
					expect(secondResetCallCount).to.equal(1);
				});

			});

		});
	});

	describe("When I unregister the object, then call reset", function() {
		var busOnResetCalls = 0;
		var I = { bus: { onReset: function() { busOnResetCalls++; } } };
		mop.register(I);

		mop.unregister(I).reset();
		var resultingResetCallCount = busOnResetCalls;

		it("Should not have called the onReset method", function() {
			expect(resultingResetCallCount).to.equal(0);
		});
	});

});