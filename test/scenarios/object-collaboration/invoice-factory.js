var mop,
	invoices = require("./invoice")
	;

module.exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new InvoiceFactory(), "Invoice factory")
			;
	}
};

var invoiceNumberSeed = new Date().getTime();

function InvoiceFactory() {

	var build = function() {
		var invoiceId = ++invoiceNumberSeed;
		var invoice = new invoices.Invoice(invoiceId, mop);
		mop.register(invoice, "Invoice #" + invoiceId);
		return invoiceId;
	};

	return {
		receive_new_invoice_request: build
	};
}