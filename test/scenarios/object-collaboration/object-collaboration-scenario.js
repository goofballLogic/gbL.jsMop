var jsmop = require("../../../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();
/*

	This scenario depicts the process of creating a new invoice, adding some line items to it, and requesting the total amount.
	Then we create two more invoices with line items, and we mark the first invoice as paid.
	We request a report of all outstanding invoice amounts, including total charges and total tax.
	Finally, we change the way tax is calculated to a flat-tax for items between £100 and £1000 and request a new report.

*/

describe("Given an invoice factory", function() {

	var objects = {
		factory: require("./invoice-factory"),
		taxCalculator: require("./uk-VAT-calculator")
	};

	mop.reset().boot(objects);

	describe("When I request a new invoice", function() {
		var invoiceNumber = mop.send().as("new invoice request");

		it("Should return the number of the new invoice", function() {
			expect(invoiceNumber).to.be.greaterThan(0);
		});

		var toPrice = function(amount) { return Math.round(amount * 100) / 100; };

		describe("When I add two line items to the invoice and request the total amount", function() {
			var kitkat = { Description: "Kit kat", UnitPrice: 0.89 };
			var ferrari = { Description: "Any old Ferrari will do", UnitPrice: 200000.00 };
			var netbook = { Description: "Samsung netbook", UnitPrice: 319.99 };

			var lineItem = "line item for invoice " + invoiceNumber;
			
			mop.send(kitkat, 3).as(lineItem);
			mop.send(ferrari, 2).as(lineItem);

			var total = mop.send().as("total amount for invoice " + invoiceNumber);
			
			it("Should return the total for the invoice", function() {
				var taxFactor = 1.2; // 20% tax? surely that's a bug?
				var amount = (toPrice(kitkat.UnitPrice * 3) + toPrice(ferrari.UnitPrice * 2)) * taxFactor;
				var expected = toPrice(amount);
				expect(total).to.be(expected);
			});


			describe("When I add two more invoices with line items, pay the first invoice and request an outstanding amount report", function() {
				var invoice2 = mop.send().as("new invoice request");
				var invoice3 = mop.send().as("new invoice request");

				mop.send(kitkat, 1).as("line item for invoice " + invoice2);
				mop.send(ferrari, 3).as("line item for invoice " + invoice2);
				mop.send(kitkat, 5).as("line item for invoice " + invoice3);
				mop.send(netbook, 2).as("line item for invoice " + invoice3);

				mop.send(invoiceNumber).as("invoice paid");

				var report = mop.send({ status: "open" }).forList().as("request invoice totals report");

				it("Should return a report with two totals", function() {
					expect(report).to.have.length(2);
				});

				it("Should return the correct tax amount for each report", function() {
					var sampleTotals = report[1];
					var expectedTax = toPrice(sampleTotals.net * 0.2);
					expect(sampleTotals.tax).to.be(expectedTax);
				});

				describe("When I change the tax calculator and request a report", function() {
					mop
						.unregister(objects.taxCalculator)
						.boot({ taxCalculator: require("./tiered-flat-tax-calculator") })
						.send(42).as("flat tax amount");
					
					var report = mop.send().as("request totals report for invoice " + invoice3);

					it("Should return the correct tax", function() {

						var expectedTax =
							(toPrice(toPrice(kitkat.UnitPrice * 0.2) * 5)) + // percentage tax for the kitkats
							(2 * 42) // flat tax for the two netbooks
							;

						expect(report.tax).to.be(expectedTax);
					});
				});
			});
		});
	});

});