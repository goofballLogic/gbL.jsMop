all = test test-dot test-min test-list

.PHONY: $(all)


PATH := $(PATH):/usr/local/bin

runner = ./node_modules/.bin/mocha
openinbrowser = open
testfiles = $(shell find ./test -name "*.js")
browserify = ./node_modules/.bin/browserify

test:
	@$(runner) --reporter spec $(testfiles)

browser-test:
	$(browserify) -o ./test-browser/browsertests.js $(testfiles)
	open ./test-browser/browserTests.html

test-dot:
	@$(runner) --reporter dot $(testfiles)