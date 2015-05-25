# User/runtime variables
BROWSER = Firefox
KARMA_FLAGS = # set to --preprocessors= to show line numbers, otherwise coverage clobbers them

# Site-dependent variables
BUILDDIR = build
NODE_PATH = ./node_modules
NPM = npm
NODE = node

# Dependencies - make sure you keep DEP_{ALL,NONCUSTOM}_{,NAMES} up-to-date
DEP_ASMCRYPTO = $(NODE_PATH)/asmcrypto.js/asmcrypto.js
DEP_JSBN = $(NODE_PATH)/jsbn/index.js
DEP_JODID = $(NODE_PATH)/jodid25519/jodid25519.js
DEP_ES6COLL = $(NODE_PATH)/es6-collections/es6-collections.js
DEP_LRUCACHE = $(NODE_PATH)/lru-cache/lib/lru-cache.js
DEP_NONCUSTOM = $(DEP_JSBN) $(DEP_ES6COLL) $(DEP_LRUCACHE)
DEP_NONCUSTOM_NAMES = jsbn es6-collections lru-cache
# jodid needs to be loaded after jsbn
DEP_ALL = $(DEP_ASMCRYPTO) $(DEP_NONCUSTOM) $(DEP_JODID)
DEP_ALL_NAMES = asmcrypto.js $(DEP_NONCUSTOM_NAMES) jodid25519

# Build-depends - make sure you keep BUILD_DEP_ALL and BUILD_DEP_ALL_NAMES up-to-date
KARMA  = $(NODE_PATH)/karma/bin/karma
JSDOC  = $(NODE_PATH)/.bin/jsdoc
JSHINT = $(NODE_PATH)/.bin/jshint
JSCS   = $(NODE_PATH)/.bin/jscs
R_JS   = $(NODE_PATH)/.bin/r.js
ALMOND = $(NODE_PATH)/almond/almond.js
R_JS_ALMOND_OPTS = baseUrl=src name=../$(ALMOND:%.js=%) wrap.startFile=almond.0 wrap.endFile=almond.1
UGLIFY = $(NODE_PATH)/.bin/uglifyjs
BUILD_DEP_ALL = $(KARMA) $(JSDOC) $(R_JS) $(ALMOND) $(UGLIFY)
BUILD_DEP_ALL_NAMES = karma jsdoc requirejs almond uglify-js

ASMCRYPTO_MODULES = common,utils,exports,globals,aes,aes-ecb,aes-cbc,aes-cfb,aes-ctr,aes-ccm,aes-gcm,aes-exports,aes-ecb-exports,aes-cbc-exports,aes-cfb-exports,aes-ctr-exports,aes-ccm-exports,aes-gcm-exports,hash,sha1,sha1-exports,sha256,sha256-exports,sha512,sha512-exports,hmac,hmac-sha1,hmac-sha256,hmac-sha512,hmac-sha1-exports,hmac-sha256-exports,hmac-sha512-exports,pbkdf2,pbkdf2-hmac-sha1,pbkdf2-hmac-sha256,pbkdf2-hmac-sha512,pbkdf2-hmac-sha1-exports,pbkdf2-hmac-sha256-exports,pbkdf2-hmac-sha512-exports,rng,rng-exports,rng-globals,bn,bn-exports,rsa,rsa-raw,rsa-pkcs1,rsa-keygen-exports,rsa-raw-exports sources

all: test api-doc dist test-shared

mpenc.js: $(BUILDDIR)/mpenc-shared.min.js
	sed -e 's,$<,$@,g' "$<.map" > "$@.map"
	sed -e 's,$<,$@,g' "$<" > "$@"

test: .npm-build-deps $(KARMA) $(R_JS) $(DEP_ALL)
	$(NODE) $(KARMA) start $(KARMA_FLAGS) --singleRun=true karma.conf.js --colors=false --browsers PhantomJS

# use e.g. `make BROWSER=Chrome browser-test` to use a different browser
browser-test:
	$(NODE) $(KARMA) start $(KARMA_FLAGS) karma.conf.js --browsers $(BROWSER)

api-doc: $(JSDOC)
	$(NODE) $(JSDOC) --destination doc/api/ --private \
                 --configure jsdoc.json \
                 --recurse src/

jshint: $(JSHINT)
	@-$(NODE) $(JSHINT) --verbose .

jscs: $(JSCS)
	@-$(NODE) $(JSCS) --verbose .

checks: jshint jscs

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

dist: $(BUILDDIR)/mpenc-shared.min.js $(BUILDDIR)/mpenc-static.js

# TODO: this may be removed when the default dist of asmcrypto includes sha512
$(DEP_ASMCRYPTO): $(DEP_ASMCRYPTO).with.sha512
$(DEP_ASMCRYPTO).with.sha512:
	$(NPM) install asmcrypto.js
	cd $(NODE_PATH)/asmcrypto.js &&	$(NPM) install && $(NODE) $(NODE_PATH)/.bin/grunt --with=$(ASMCRYPTO_MODULES) concat
	touch $(DEP_ASMCRYPTO).with.sha512

# TODO: this may be removed when jodid25519 gets uploaded to npm repos
$(DEP_JODID):
	$(NPM) install jodid25519
	cd $(NODE_PATH)/jodid25519 && make jodid25519.js

$(BUILD_DEP_ALL) $(DEP_NONCUSTOM):
	$(NPM) install $(BUILD_DEP_ALL_NAMES) $(DEP_NONCUSTOM_NAMES)

# other things from package.json, such as karma plugins. we touch a guard file
# to prevent "npm install" running on every invocation of `make test`
.npm-build-deps: package.json
	$(NPM) install
	touch .npm-build-deps

clean:
	rm -rf doc/api/ coverage/ build/ mpenc.js test-results.xml

clean-all: clean
	rm -f $(BUILD_DEP_ALL) $(DEP_ALL)
	rm -rf $(BUILD_DEP_ALL_NAMES:%=$(NODE_PATH)/%) $(DEP_ALL_NAMES:%=$(NODE_PATH)/%)
	rm -f .npm-build-deps

.PHONY: all test browser-test api-doc jshint jscs checks
.PHONY: clean clean-all build-deps-auto
.PHONY: build-static build-shared test-static test-shared dist
