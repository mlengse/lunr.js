
SRC = lib/lunr.js \
	lib/utils.js \
	lib/field_ref.js \
	lib/set.js \
	lib/idf.js \
	lib/token.js \
	lib/tokenizer.js \
	lib/pipeline.js \
	lib/vector.js \
	lib/stemmer.js \
	lib/stop_word_filter.js \
	lib/trimmer.js \
	lib/token_set.js \
	lib/token_set_builder.js \
	lib/index.js \
	lib/builder.js \
	lib/match_data.js \
	lib/query.js \
	lib/query_parse_error.js \
	lib/query_lexer.js \
	lib/query_parser.js

NODE ?= node
NPM ?= npm
MOCHA ?= ./node_modules/.bin/mocha
MUSTACHE ?= ./node_modules/.bin/mustache
ESLINT ?= ./node_modules/.bin/eslint
JSDOC ?= ./node_modules/.bin/jsdoc
HTTP_SERVER ?= ./node_modules/.bin/http-server

all: test lint docs
release: lunr.js lunr.min.js bower.json package.json component.json docs

lunr.js: $(SRC) build/wrapper_start build/wrapper_end build/build.js
	$(NODE) build/build.js lunr.js

lunr.min.js: lunr.js
	$(NODE) build/build.js lunr.min.js

%.json: build/%.json.template build/build.js
	$(NODE) build/build.js $@

size: lunr.min.js
	$(NODE) build/build.js size

server: test/index.html
	$(HTTP_SERVER) -a 0.0.0.0 -c-1

lint: $(SRC)
	$(ESLINT) $^

perf/*_perf.js:
	$(NODE) -r ./perf/perf_helper.js $@

benchmark: perf/*_perf.js

test: node_modules lunr.js
	$(MOCHA) test/*.js -u tdd -r test/test_helper.js -R dot -C

test/inspect: node_modules lunr.js
	$(MOCHA) test/*.js -u tdd -r test/test_helper.js -R dot -C --inspect-brk=0.0.0.0:9292

test/env/file_list.json: $(wildcard test/*test.js)
	$(NODE) -p 'JSON.stringify({test_files: process.argv.slice(1)})' $^ > $@

test/index.html: test/env/file_list.json test/env/index.mustache
	$(MUSTACHE) $^ > $@

docs: $(SRC)
	$(JSDOC) -R README.md -d docs -c build/jsdoc.conf.json $^

clean:
	$(NODE) build/build.js clean

reset:
	git checkout lunr.* *.json

node_modules: package.json
	$(NPM) -s install

.PHONY: test clean docs reset perf/*_perf.js test/inspect
