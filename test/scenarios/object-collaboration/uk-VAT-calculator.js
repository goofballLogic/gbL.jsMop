var mop;

module.exports.bootstrap = {
	init: function(jsmop) {
		mop = jsmop;
		mop.register(Calculator);
	}
};

var toPrice = function(amount) { return Math.round(amount * 100) / 100; };

var Calculator = {

	receive_calculate_tax_for_invoice: function(invoiceNumber) {
		// just get the net amount and multiply by 0.2
		mop.send(
			toPrice(mop.send().as("net amount for invoice " + invoiceNumber) * 0.2)
		).as("calculated tax for invoice " + invoiceNumber);
	}

};
