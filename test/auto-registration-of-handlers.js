var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given an object with handlers", function() {

	var subject = {
		received : { abuse : [], love : [] },
		receive_general_abuse : function(abuse) {
			this.received.abuse.push(abuse);
		},
		receive_general_love : function(love) {
			this.received.love.push(love);
		}
	};

	describe("when that object is registered", function() {
		mop.register(subject);

		describe("and when a message is sent", function() {
			mop.send("dziuba").as("general", "abuse");
		
			it("the object should receive the message through its handler", function() {
				expect(subject.received.abuse).to.contain("dziuba");
			});
		});

		describe("but when the object's handler is Unregistered and when message is sent", function() {
			mop
				.unregisterHandler(subject.receive_general_abuse)
				.send("zoomba").as("general", "abuse");

			it("the object should not receive the message", function() {
				expect(subject.received.abuse).to.not.contain("zoomba");
			});
		});

		describe("but when the object is unregistered and when message is sent", function() {
			mop
				.unregister(subject)
				.send("hugs").as("general love");

			it("the object should not receive the message", function() {
				expect(subject.received.love).to.be.empty();
			});
		});
	});

});