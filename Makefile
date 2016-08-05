ESLINT = node_modules/.bin/eslint
BABEL = node_modules/.bin/babel

export NODE_ENV = test

.PHONY: build clean dist lint lint-quiet

build:
	$(BABEL) src/ --modules common --out-dir dist
	chmod +x dist/cli.js

clean:
	rm -rf dist

dist:
	make clean
	make build

lint:
	$(ESLINT) --ext .js .

lint-quiet:
	$(ESLINT) --ext .js --quiet .
