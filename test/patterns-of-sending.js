var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given a registered object with handlers", function() {

	var subject = {
		received : { abuse : [], love : [] },
		receive_general_abuse : function(abuse) {
			this.received.abuse.push(abuse);
		},
		receive_general_love : function(love) {
			this.received.love.push(love);
		}
	};

	mop.register(subject);

	describe("When a message is sent using space delimited subject", function() {
		mop.send("yo sushi").withSubject("general abuse");

		it("the object should receive the message through its handler", function() {
			expect(subject.received.abuse).to.contain("yo sushi");
		});
	});

	describe("When a message is sent using as instead of withSubject", function() {
		mop.send("yo su").as("general love");

		it("the object should receive the message through its handler", function() {
			expect(subject.received.love).to.contain("yo su");
		});
	});
});