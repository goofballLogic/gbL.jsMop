var mop;

module.exports.bootstrap = {
	init: function(jsmop) {
		mop = jsmop;
		mop.register(Calculator);
		mop.send().as("new tax calculator");
	}
};

function toPrice(amount) { return Math.round(amount * 100) / 100; }

function calcTaxForInvoice(invoiceNumber) {
	var total = 0;
	// get a list of line items
	var lines = mop.send().as("line items for invoice " + invoiceNumber);

	// for each one, check the unit price.
	for(var i in lines) {
		var line = lines[i];
		// between 100 and 1000 - add flat tax per unit
		if(line.Item.UnitPrice >= 100 && line.Item.UnitPrice <= 1000) {
			total += (line.Amount * flat_tax_amount);
		}
		// otherwise - add percentage tax amount per line
		else {
			total += toPrice(line.Amount * (toPrice(line.Item.UnitPrice * percentage_tax_amount / 100)));
		}
	}
	// return total
	mop.send(total).as("calculated tax for invoice " + invoiceNumber);
}

var flat_tax_amount = 10,
	percentage_tax_amount = 20
	;

var Calculator = {

	receive_flat_tax_amount: function(amount) { flat_tax_amount = amount; mop.send().as("new tax rate"); },
	receive_percentage_tax_amount: function(amount) { percentage_tax_amount = amount; mop.send().as("new tax rate"); },
	receive_calculate_tax_for_invoice: calcTaxForInvoice

};