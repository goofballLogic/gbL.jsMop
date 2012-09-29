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

	mop.reset().register(subject);

	describe("When a message is sent using space delimited subject", function() {
		mop.send("yo sushi").as("general abuse");

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

describe("Given a registered object with a send property", function() {

	var originalSendReceived = [];

	var iSubject = {
		send: {
			newOrderNameAndAddress : function(orderId, name, address) {
				originalSendReceived.push({"orderId" : orderId, "name" : name, "address" : address });
				return "retOriginalFunc";
			}
		}
	};

	mop.reset().register(iSubject);

	var received = [];

	mop.registerHandler("new order name and address", function(orderId, name, address) {
		received.push({ "orderId" : orderId, "name" : name, "address" : address });
		return "retHandlerFunc";
	});

	var hasOrderId = function(toSearch, orderId) {
		for(var i in toSearch) {
			if(toSearch[i].orderId == orderId) return true;
		}
		return false;
	};

	describe("When a message is sent through the registered interface", function() {

		var returned = iSubject.send.newOrderNameAndAddress(1, "hello", "world");

		it("should send the message as expected", function() {
			expect(hasOrderId(received, 1)).to.equal(true);
		});

		it("and it should execute the original send function", function() {
			expect(hasOrderId(originalSendReceived, 1)).to.equal(true);
		});

		it("and it should return values from the send handler", function() {
			expect(returned).to.contain("retHandlerFunc");
		});

		it("and it should return values from the original send function", function() {
			expect(returned).to.contain("retOriginalFunc");
		});
	});

	describe("But when the object is unregistered", function() {

		mop.unregister(iSubject);
		iSubject.send.newOrderNameAndAddress(2, "hello", "world");

		it("should not send the message any more", function() {
			expect(hasOrderId(received, 2)).to.equal(false);
		});

		it("but original send function should still execute", function() {
			expect(hasOrderId(originalSendReceived, 2)).to.equal(true);
		});
	});

});

describe("Given a registered object with send members", function() {

	var originalSendReceived = [];

	var iSubject = {
		send_new_order_name_and_address : function(orderId, name, address) {
			originalSendReceived.push( { "orderId" : orderId, "name" : name, "address" : address });
			return "retOriginalFunc";
		}
	};

	mop.reset().register(iSubject);

	var received = [];

	mop.registerHandler("new order name and address", function(orderId, name, address) {
		received.push({ "orderId" : orderId, "name" : name, "address" : address });
		return "retHandlerFunc";
	});

	var hasOrderId = function(toSearch, orderId) {
		for(var i in toSearch) {
			if(toSearch[i].orderId == orderId) return true;
		}
		return false;
	};

	describe("When a message is sent through the registered interface", function() {

		var returned = iSubject.send_new_order_name_and_address(1, "hello", "world");

		it("should send the message as expected", function() {
			expect(hasOrderId(received, 1)).to.equal(true);
		});

		it("and it should execute the original send function", function() {
			expect(hasOrderId(originalSendReceived, 1)).to.equal(true);
		});

		it("and it should return values from the send handler", function() {
			expect(returned).to.contain("retHandlerFunc");
		});

		it("and it should return values from the original send function", function() {
			expect(returned).to.contain("retOriginalFunc");
		});
	});

	describe("But when the object is unregistered", function() {

		mop.unregister(iSubject);
		iSubject.send_new_order_name_and_address(2, "hello", "world");

		it("should not send the message any more", function() {
			expect(hasOrderId(received, 2)).to.equal(false);
		});

		it("but original send function should still execute", function() {
			expect(hasOrderId(originalSendReceived, 2)).to.equal(true);
		});
	});
});