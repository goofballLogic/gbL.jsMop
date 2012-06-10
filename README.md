
# gbL.jsMop

## Preamble
Javascript library for message passing in javascript. "mop" is an acronym referring to OOP, but "message-oriented" instead of "object-oriented". A central "mop" object is used to send and receive messages (in place of a native message exchange construct).

http://www.purl.org/stefan_ram/pub/doc_kay_oop_en

## Environment
Designed to work specifically in the browser, or in Node, but should work in most CommonJS environments.

## Running/Building tests
####Without a browser (mocha)
You will need to

    npm install mocha
    npm install expect.js

and then

    make test

####In the browser
Just browse to 

    test-browser/browserTests.html

####Building (and opening) the browser tests
You will need to

    npm install browserify

and then

    make browser-test

## Example
Example usage can be found in the /test/scenarios folder.

### Basics
First step is to spin up a hub for the messages:

    var mop = new gbL.jsMop.Mop();

or

    var mop = new require("gbL.jsMop").Mop();

Then, if you want to send a message, you can just:

    mop.send("Hello world").as("test");

Which sends a message with subject _*test*_ and payload of a _*string Hello world*_.

