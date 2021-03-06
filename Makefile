# User/runtime variables
BROWSER = Firefox # for browser-test and headless-browser-test
KARMA_FLAGS = # set to --preprocessors= to show line numbers, otherwise coverage clobbers them
JSDOC_FLAGS = # set to --private to show private API, e.g. for developers working on mpENC
# TODO: use npm (not github) version of ink-docstrap when
# https://github.com/terryweiss/docstrap/issues/116 is fixed

# Site-dependent variables
BUILDDIR = build
NODE_PATH = ./node_modules
NPM = npm
NODE = node

# Dependencies - make sure you keep DEP_{ALL,NONCUSTOM}_{,NAMES} up-to-date
DEP_ASMCRYPTO = $(NODE_PATH)/asmcrypto.js/asmcrypto.js
DEP_ES6COLL = $(NODE_PATH)/es6-collections/es6-collections.js
DEP_LRUCACHE = $(NODE_PATH)/lru-cache/lib/lru-cache.js
DEP_NONCUSTOM = $(DEP_ES6COLL) $(DEP_LRUCACHE)
DEP_NONCUSTOM_NAMES = es6-collections lru-cache
DEP_ALL = $(DEP_ASMCRYPTO) $(DEP_NONCUSTOM)
DEP_ALL_NAMES = asmcrypto.js $(DEP_NONCUSTOM_NAMES)

# Build-depends - make sure you keep BUILD_DEP_ALL and BUILD_DEP_ALL_NAMES up-to-date
KARMA  = $(NODE_PATH)/karma/bin/karma
JSDOC  = $(NODE_PATH)/.bin/jsdoc
JSHINT = $(NODE_PATH)/.bin/jshint
JSCS   = $(NODE_PATH)/.bin/jscs
R_JS   = $(NODE_PATH)/.bin/r.js
ALMOND = $(NODE_PATH)/almond/almond.js
R_JS_ALMOND_OPTS = baseUrl=src name=../$(ALMOND:%.js=%) wrap.startFile=almond.0 wrap.endFile=almond.1
UGLIFY = $(NODE_PATH)/.bin/uglifyjs
BUILD_DEP_ALL = $(KARMA) $(JSDOC) $(JSHINT) $(JSCS) $(R_JS) $(ALMOND) $(UGLIFY)
BUILD_DEP_ALL_NAMES = karma jsdoc jshint jscs requirejs almond uglify-js

ASMCRYPTO_MODULES = common,utils,exports,globals,aes,aes-ctr,aes-ccm,aes-gcm,aes-exports,aes-ctr-exports,aes-ccm-exports,aes-gcm-exports,hash,sha256,sha256-exports,hmac,hmac-sha256,hmac-sha256-exports,pbkdf2,pbkdf2-hmac-sha256,pbkdf2-hmac-sha256-exports,rng,rng-exports,rng-globals sources

CAN_HEADLESS_BROWSER = (type xvfb-run && ( \
  type firefox || type iceweasel || \
  type google-chrome || type chromium || type chromium-browser )) >/dev/null

all: test doc dist test-shared test-static

dist: mpenc.js

checks: jshint jscs

test:
	if $(CAN_HEADLESS_BROWSER); then \
	  $(MAKE) headless-browser-test; else $(MAKE) phantomjs-test; fi

phantomjs-test:
	$(MAKE) BROWSER=PhantomJS karma-test

headless-browser-test:
	xvfb-run $(MAKE) BROWSER=$(BROWSER) karma-test

karma-test: $(KARMA) $(R_JS) $(DEP_ALL)
	$(NODE) $(KARMA) start --single-run=true --colors=false \
	  $(KARMA_FLAGS) --browsers=$(BROWSER) karma.conf.js

test-browser: $(KARMA) $(R_JS) $(DEP_ALL)
	$(NODE) $(KARMA) start $(KARMA_FLAGS) --browsers=$(BROWSER) karma.conf.js

doc: api-doc dev-doc

api-doc: $(JSDOC) src/site.simplex-custom.css
	mkdir -p doc/api/styles
	sed -e 's/@systemName@/mpENC API documentation/g' jsdoc.json > doc/api/jsdoc.json
	cp src/site.simplex-custom.css doc/api/styles
	$(NODE) $(JSDOC) --destination doc/api/ $(JSDOC_FLAGS) \
                 --configure doc/api/jsdoc.json \
                 --recurse src/ README.md

dev-doc: $(JSDOC) src/site.simplex-custom.css
	mkdir -p doc/dev/styles
	sed -e 's/@systemName@/mpENC developer docs/g' jsdoc.json > doc/dev/jsdoc.json
	cp src/site.simplex-custom.css doc/dev/styles
	$(NODE) $(JSDOC) --destination doc/dev/ $(JSDOC_FLAGS) \
                 --configure doc/dev/jsdoc.json --private \
                 --recurse src/ README.md

jshint: $(JSHINT)
	@-$(NODE) $(JSHINT) --verbose src test

jscs: $(JSCS)
	@-$(NODE) $(JSCS) --verbose src test

$(BUILDDIR)/build-config-static.js: src/config.js Makefile
	mkdir -p $(BUILDDIR)
	tail -n+2 "$<" > "$@"

$(BUILDDIR)/build-config-shared.js: src/config.js Makefile
	mkdir -p $(BUILDDIR)
	tail -n+2 "$<" > "$@.tmp"
	for i in $(DEP_ALL_NAMES); do \
		sed -i -e "s,node_modules/$$i/.*\",build/$$i-dummy\"," "$@.tmp"; \
		touch $(BUILDDIR)/$$i-dummy.js; \
	done
	mv "$@.tmp" "$@"

$(BUILDDIR)/mpenc-static.js: build-static
build-static: $(R_JS) $(ALMOND) $(BUILDDIR)/build-config-static.js $(DEP_ALL)
	$(NODE) $(R_JS) -o $(BUILDDIR)/build-config-static.js out="$(BUILDDIR)/mpenc-static.js" \
	  $(R_JS_ALMOND_OPTS) include=mpenc optimize=none

$(BUILDDIR)/mpenc-shared.js: build-shared
build-shared: $(R_JS) $(ALMOND) $(BUILDDIR)/build-config-shared.js
	$(NODE) $(R_JS) -o $(BUILDDIR)/build-config-shared.js out="$(BUILDDIR)/mpenc-shared.js" \
	  $(R_JS_ALMOND_OPTS) include=mpenc optimize=none

test-static: test/build-test-static.js build-static
	./$< ../$(BUILDDIR)/mpenc-static.js

test-shared: test/build-test-shared.js build-shared $(DEP_ALL)
	./$< ../$(BUILDDIR)/mpenc-shared.js $(DEP_ALL)

$(BUILDDIR)/%.min.js: $(BUILDDIR)/%.js $(UGLIFY)
	$(NODE) $(UGLIFY) $< -o $@ --source-map $@.map --mangle --compress --lint

mpenc.js: $(BUILDDIR)/mpenc-shared.min.js
	sed -e 's,$<,$@,g' "$<.map" > "$@.map"
	sed -e 's,$<,$@,g' "$<" > "$@"

# TODO: this may be removed when the default dist of asmcrypto includes AES-CTR
$(DEP_ASMCRYPTO): $(DEP_ASMCRYPTO).with.aesctr
$(DEP_ASMCRYPTO).with.aesctr:
	$(NPM) install asmcrypto.js
	cd $(NODE_PATH)/asmcrypto.js &&	$(NPM) install && $(NODE) $(NODE_PATH)/.bin/grunt --with=$(ASMCRYPTO_MODULES) concat
	touch $(DEP_ASMCRYPTO).with.aesctr

# annoyingly, npm sets mtime to package publish date so we have to use |-syntax
# https://www.gnu.org/software/make/manual/html_node/Prerequisite-Types.html
$(BUILD_DEP_ALL) $(DEP_NONCUSTOM): | .npm-build-deps
	$(NPM) install $(BUILD_DEP_ALL_NAMES) $(DEP_NONCUSTOM_NAMES)

# other things from package.json, such as karma plugins. we touch a guard file
# to prevent "npm install" running on every invocation of `make test`
.npm-build-deps: package.json
	$(NPM) install
	touch .npm-build-deps

clean:
	rm -rf doc/ coverage/ build/ mpenc.js* test-results.xml contrib/*.pyc

clean-all: clean
	rm -f $(BUILD_DEP_ALL) $(DEP_ALL)
	rm -rf $(BUILD_DEP_ALL_NAMES:%=$(NODE_PATH)/%) $(DEP_ALL_NAMES:%=$(NODE_PATH)/%)
	rm -f .npm-build-deps node_modules

.PHONY: all test phantomjs-test headless-browser-test karma-test test-browser
.PHONY: build-static build-shared test-static test-shared dist
.PHONY: doc api-doc dev-doc jshint jscs checks
.PHONY: clean clean-all
