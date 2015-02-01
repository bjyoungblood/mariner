JSCS = node_modules/.bin/jscs
JSHINT = node_modules/.bin/jshint
6TO5 = node_modules/.bin/6to5

export NODE_ENV = test

.PHONY: build clean dist lint

build:
	$(6TO5) src/ --modules common --out-dir dist
	chmod +x dist/cli.js

clean:
	rm -rf dist

dist:
	make clean
	make build

lint:
	$(JSHINT) .
	$(JSCS) -c .jscsrc .
