var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given a hub with registered handlers", function() {
	
	var obj1 = {
		receive: { helloWorld : function(message) { } }
	};

	var obj2 = { 
		send: {
			helloWorld: function(message) { },
			goodbyeWorld: function(message) { }
		}
	};

	var log = [];

	mop.register(obj1, "obj 1");
	mop.register(obj2, "obj 2");
	mop.registerHandler(["_messageLog"], function(detail) {
		detail.category = mop.topics[1];
		log.push(JSON.parse(JSON.stringify(detail)));
	});

	describe("When a message is sent", function() {
		
		obj2.send.helloWorld("hi there");

		it("the message sending should be logged", function() {
			expect(log[0].category).to.eql("sent");
			expect(log[0].topics).to.eql(["hello", "world"]);
			expect(log[0].payload).to.eql([ "hi there" ]);
		});

		it("the message receiving should be logged", function() {
			expect(log[1].category).to.eql("received");
			expect(log[1].topics).to.eql([ "hello", "world" ]);
			expect(log[1].payload).to.eql([ "hi there" ]);
		});

	});

});