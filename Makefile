JSCS = node_modules/.bin/jscs
JSHINT = node_modules/.bin/jshint
BABEL = node_modules/.bin/babel

export NODE_ENV = test

.PHONY: build clean dist lint

build:
	$(BABEL) src/ --modules common --out-dir dist
	chmod +x dist/cli.js

clean:
	rm -rf dist

dist:
	make clean
	make build

lint:
	$(JSHINT) .
	$(JSCS) -c .jscsrc .
