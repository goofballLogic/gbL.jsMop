module.exports.Invoice = function(invoiceId, mop) {

	// encapsulated state
	var lineItems = [],
		totals = { net: null, tax: null, gross: null },
		status = "open"
		;

	// private functions
	function toPrice(amount) { return Math.round(amount * 100) / 100; }

	function recalculate() {
		var net = 0;
		for(var i in lineItems)
			net += toPrice(lineItems[i].Item.UnitPrice * lineItems[i].Amount);

		totals = { net: net, tax: null, gross: null };

		mop.send(invoiceId).as("calculate tax for invoice");
	}

	function cloneTotals() {
		return { net: totals.net, tax: totals.tax, gross: totals.gross };
	}

	function cloneLineItems() {
		var ret = [];
		for(var i in lineItems) {
			var lineItem = lineItems[i];
			ret.push({ Item: lineItem.Item, Amount: lineItem.Amount });
		}
		return ret;
	}

	function setCalculatedTax(tax) {
		var newTotals = cloneTotals();
		newTotals.tax = tax;
		newTotals.gross = toPrice(totals.net + tax);
		totals = newTotals;
	}

	function addLineItem(item, amount) {
		lineItems.push({ Item: item, Amount: amount});
		recalculate();
	}

	// message handlers
	this.receive_line_item_for_invoice = function(item, amount) { addLineItem(item, amount); };
	this.receive_total_amount_for_invoice = function() { return totals.gross; };
	this.receive_net_amount_for_invoice = function() { return totals.net; };
	this.receive_calculated_tax_for_invoice = function(tax) { setCalculatedTax(tax); };
	this.receive_request_totals_report_for_invoice = function() { return cloneTotals(); };
	this.receive_line_items_for_invoice = function() { return cloneLineItems(); };

	mop.setReceiveFilters(this, function(topics) {
		// only accept for my invoice number
		return topics.slice(-1)[0] == invoiceId;
	});

	this.receive_invoice_paid = function() { status = "paid"; };
	this.receive_invoice_paid.filter = function(topics, data) { return data && data[0] == invoiceId; };

	this.receive_request_invoice_totals_report = function() { return cloneTotals(); };
	this.receive_request_invoice_totals_report.filter = function(topics, data) {
		return data && data[0] && data[0].status == status;
	};

	this.receive_new_tax = function() { recalculate(); };
};