
# gbL.jsMop

## Preamble
Javascript library for message passing in javascript. "mop" is an acronym referring to OOP, but "message-oriented" instead of "object-oriented". A central "mop" object is used to send and receive messages (in place of a native message exchange construct). 

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

