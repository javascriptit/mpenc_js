/**
 * @fileOverview
 * Test of the `mpenc/handler` module.
 */

/*
 * Created: 27 Feb 2014 Guy K. Kloss <gk@mega.co.nz>
 *
 * (c) 2014-2015 by Mega Limited, Auckland, New Zealand
 *     http://mega.co.nz/
 *
 * This file is part of the multi-party chat encryption suite.
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation. See the accompanying
 * LICENSE file or <https://www.gnu.org/licenses/> if it is unavailable.
 *
 * This code is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

define([
    "mpenc/handler",
    "mpenc/helper/utils",
    "mpenc/helper/struct",
    "mpenc/codec",
    "mpenc/message",
    "mpenc/version",
    "mpenc/greet/keystore",
    "mpenc/greet/greeter",
    "asmcrypto",
    "jodid25519",
    "megalogger",
    "chai",
    "sinon/assert",
    "sinon/sandbox",
    "sinon/spy",
    "sinon/stub",
], function(ns, utils, struct, codec, message, version, keystore, greeter,
            asmCrypto, jodid25519, MegaLogger,
            chai, sinon_assert, sinon_sandbox, sinon_spy, stub) {
    "use strict";
    return;

    var assert = chai.assert;

    function _echo(x) {
        return x;
    }

    function _dummySessionStore() {
        var store = new keystore.KeyStore('dummy', stub().returns(1000));
        store.sessionIDs = utils.clone(_td.SESSION_KEY_STORE.sessionIDs);
        store.sessions = utils.clone(_td.SESSION_KEY_STORE.sessions);
        store.pubKeyMap = utils.clone(_td.SESSION_KEY_STORE.pubKeyMap);
        return store;
    }

    function _dummyMessageSecurity(author, greet) {
        return new message.MessageSecurity(
            author,
            greet ? greet.getEphemeralPrivKey() : stub(),
            greet ? greet.getEphemeralPubKey() : stub(),
            _dummySessionStore());
    }

    MegaLogger._logRegistry.assert.options.isEnabled = false;

    // Create/restore Sinon stub/spy/mock sandboxes.
    var sandbox = null;

    beforeEach(function() {
        sandbox = sinon_sandbox.create();
        sandbox.stub(MegaLogger._logRegistry.handler, '_log');
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe("DecryptTrialTarget class", function() {
        describe('#paramId method', function() {
            it('simple ID of message', function() {
                sandbox.stub(utils, 'sha256', _echo);
                var message = { from: 'somebody',
                                data: 'foo' };
                var target = new ns.DecryptTrialTarget(stub(), 42);
                assert.strictEqual(target.paramId(message), 'somebody\x00foo');
                assert.strictEqual(utils.sha256.callCount, 1);
            });
        });

        describe('#maxSize method', function() {
            it('simple ID of message', function() {
                var target = new ns.DecryptTrialTarget(stub(), 42);
                assert.strictEqual(target.maxSize(), 42);
            });
        });

        describe('#tryMe', function() {
            it('succeeding try func, not pending', function() {
                sandbox.stub(codec, 'decodeWirePacket').returns(
                    { type: codec.MESSAGE_TYPE.MPENC_DATA_MESSAGE,
                      content: _td.DATA_MESSAGE_STRING }
                );
                var messageSecurity = _dummyMessageSecurity('Moe');
                var payload = { from: 'Moe',
                                data: _td.DATA_MESSAGE_STRING };
                var target = new ns.DecryptTrialTarget(messageSecurity.decrypt.bind(messageSecurity), 42);
                var result = target.tryMe(false, payload);
                assert.strictEqual(result, true);
            });

            it('succeeding try func, not pending, previous group key', function() {
                sandbox.stub(codec, 'decodeWirePacket').returns(
                    { type: codec.MESSAGE_TYPE.MPENC_DATA_MESSAGE,
                      content: _td.DATA_MESSAGE_STRING }
                );
                sandbox.spy(codec, 'verifyMessageSignature');
                var messageSecurity = _dummyMessageSecurity('Moe');
                messageSecurity._sessionKeyStore.sessions[_td.SESSION_ID].groupKeys.unshift(atob('Dw4NDAsKCQgHBgUEAwIBAA=='));
                sandbox.spy(messageSecurity, 'decrypt');
                var payload = { from: 'Moe',
                                data: _td.DATA_MESSAGE_STRING };
                var target = new ns.DecryptTrialTarget(messageSecurity.decrypt.bind(messageSecurity), 42);
                var result = target.tryMe(false, payload);
                assert.strictEqual(result, true);
                assert.strictEqual(messageSecurity.decrypt.callCount, 1);
                assert.strictEqual(codec.verifyMessageSignature.callCount, 1);
            });

            it('succeeding try func, not pending, previous session', function() {
                sandbox.stub(codec, 'decodeWirePacket').returns(
                    { type: codec.MESSAGE_TYPE.MPENC_DATA_MESSAGE,
                      content: _td.DATA_MESSAGE_STRING }
                );
                sandbox.spy(codec, 'verifyMessageSignature');
                var messageSecurity = _dummyMessageSecurity('Moe');
                var sessionKeyStore = messageSecurity._sessionKeyStore;
                sessionKeyStore.sessionIDs.unshift('foo');
                sessionKeyStore.sessions['foo'] = utils.clone(sessionKeyStore.sessions[_td.SESSION_ID]);
                sessionKeyStore.sessions['foo'].groupKeys[0] = atob('Dw4NDAsKCQgHBgUEAwIBAA==');
                sandbox.spy(messageSecurity, 'decrypt');
                var payload = { from: 'Moe',
                                data: _td.DATA_MESSAGE_STRING };
                var target = new ns.DecryptTrialTarget(messageSecurity.decrypt.bind(messageSecurity), 42);
                var result = target.tryMe(false, payload);
                assert.strictEqual(result, true);
                assert.strictEqual(messageSecurity.decrypt.callCount, 1);
                assert.strictEqual(codec.verifyMessageSignature.callCount, 1);
            });

            it('succeeding try func, not pending, hint collision', function() {
                var collidingKey = 'XqtAZ4L9eY4qFdf6XsfgsQ==';
                sandbox.stub(codec, 'decodeWirePacket').returns(
                    { type: codec.MESSAGE_TYPE.MPENC_DATA_MESSAGE,
                      content: _td.DATA_MESSAGE_STRING }
                );
                sandbox.spy(codec, 'verifyMessageSignature');
                var messageSecurity = _dummyMessageSecurity('Moe');
                messageSecurity._sessionKeyStore.sessions[_td.SESSION_ID].groupKeys.unshift(atob(collidingKey));
                sandbox.spy(messageSecurity, 'decrypt');
                var payload = { from: 'Moe',
                                data: _td.DATA_MESSAGE_STRING };
                var target = new ns.DecryptTrialTarget(messageSecurity.decrypt.bind(messageSecurity), 42);
                var result = target.tryMe(false, payload);
                assert.strictEqual(result, true);
                assert.strictEqual(messageSecurity.decrypt.callCount, 1);
                assert.strictEqual(codec.verifyMessageSignature.callCount, 2);
            });
        });
    });

    describe("ProtocolHandler class", function() {
        describe('constructor', function() {
            it('fails for missing params', function() {
                assert.throws(function() { new ns.ProtocolHandler('42', _td.ED25519_PRIV_KEY, _td.ED25519_PUB_KEY,
                                                                  _td.STATIC_PUB_KEY_DIR); },
                              "Constructor call missing required parameters.");
            });

            it('just make an instance', function() {
                var handler = new ns.ProtocolHandler('42', 'HHGTTG',
                                                     _td.ED25519_PRIV_KEY,
                                                     _td.ED25519_PUB_KEY,
                                                     _td.STATIC_PUB_KEY_DIR);
                assert.strictEqual(handler.id, '42');
                assert.strictEqual(handler.name, 'HHGTTG');
                assert.deepEqual(handler.greet.askeMember.staticPrivKey, _td.ED25519_PRIV_KEY);
                assert.ok(handler.greet.cliquesMember);
            });
        });

        describe('#start() method', function() {
            it('start/initiate a group session', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         'Blues Brothers',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                participant.start(['elwood@blues.org/ios1234']);
                sinon_assert.calledOnce(greeter.encodeGreetMessage);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'jake@blues.org/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, 'elwood@blues.org/ios1234');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.greet.state, greeter.STATE.INIT_UPFLOW);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         'Blues Brothers',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [greeter.STATE.INIT_UPFLOW,
                                     greeter.STATE.INIT_DOWNFLOW,
                                     greeter.STATE.READY,
                                     greeter.STATE.AUX_UPFLOW,
                                     greeter.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.greet.state = illegalStates[i];
                    assert.throws(function() { participant.start(); },
                                  'start() can only be called from an uninitialised state.');
                }
            });
        });

        describe('#include() method', function() {
            it('add members to group', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         'Blues Brothers',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state = greeter.STATE.READY;
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                participant.include(['ray@charles.org/ios1234']);
                sinon_assert.calledOnce(greeter.encodeGreetMessage);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'jake@blues.org/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, 'ray@charles.org/ios1234');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.greet.state, greeter.STATE.AUX_UPFLOW);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         'Blues Brothers',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [greeter.STATE.NULL,
                                     greeter.STATE.INIT_UPFLOW,
                                     greeter.STATE.INIT_DOWNFLOW,
                                     greeter.STATE.AUX_UPFLOW,
                                     greeter.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.greet.state = illegalStates[i];
                    assert.throws(function() { participant.include(); },
                                  'include() can only be called from a ready state.');
                }
            });
        });

        describe('#exclude() method', function() {
            it('exclude members', function() {
                var participant = new ns.ProtocolHandler('a.dumbledore@hogwarts.ac.uk/android123',
                                                         'Hogwarts',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state = greeter.STATE.READY;
                var message = {message: "You're fired!",
                               members: ['a.dumbledore@hogwarts.ac.uk/android123', 'further.staff'],
                               dest: ''};
                sandbox.stub(participant.greet.cliquesMember, "akaExclude", stub());
                sandbox.stub(participant.greet.askeMember, "exclude", stub());
                sandbox.stub(participant.greet, "_mergeMessages").returns(message);
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                participant.exclude(['g.lockhart@hogwarts.ac.uk/ios1234']);
                sinon_assert.calledOnce(greeter.encodeGreetMessage);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'a.dumbledore@hogwarts.ac.uk/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, '');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.greet.state, greeter.STATE.AUX_DOWNFLOW);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         'Blues Brothers',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [greeter.STATE.NULL,
                                     greeter.STATE.INIT_UPFLOW,
                                     greeter.STATE.INIT_DOWNFLOW,
                                     greeter.STATE.AUX_UPFLOW,
                                     greeter.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.greet.state = illegalStates[i];
                    assert.throws(function() { participant.exclude(); },
                                  'exclude() can only be called from a ready state.');
                }
            });

            it('exclude last peer --> quit()', function() {
                var participant = new ns.ProtocolHandler('chingachgook@mohicans.org/android123',
                                                         'Last of the Mohicans',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state = greeter.STATE.READY;
                participant.members = ['chingachgook@mohicans.org/android123',
                                       'uncas@mohicans.org/ios1234'];
                var message = {message: "My poor son!",
                               members: ['chingachgook@mohicans.org/android123'],
                               dest: ''};
                sandbox.stub(participant.greet.cliquesMember, "akaExclude", stub());
                sandbox.stub(participant.greet.askeMember, "exclude", stub());
                sandbox.stub(participant.greet, "_mergeMessages").returns(message);
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                sandbox.stub(participant.greet, 'quit');
                participant.exclude(['uncas@mohicans.org/ios1234']);
                sinon_assert.calledOnce(participant.greet.quit);
            });
        });

        describe('#quit() method', function() {
            it('no-op test, already in QUIT', function() {
                var participant = new ns.ProtocolHandler('peter@genesis.co.uk/android4711',
                                                         'Genesis',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state =  greeter.STATE.QUIT;
                sandbox.spy(participant.greet, 'quit');
                participant.quit();
                assert.strictEqual(participant.greet.quit.callCount, 1);
            });

            it('simple test', function() {
                var participant = new ns.ProtocolHandler('peter@genesis.co.uk/android4711',
                                                         'Genesis',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state =  greeter.STATE.READY;
                participant.greet.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                var message = {signingKey: 'Sledge Hammer',
                               source: 'peter@genesis.co.uk/android4711',
                               dest: ''};
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                sandbox.stub(participant.greet.cliquesMember, 'akaQuit', stub());
                sandbox.stub(participant.greet, '_mergeMessages').returns(message);
                participant.quit();
                sinon_assert.calledOnce(greeter.encodeGreetMessage);
                sinon_assert.calledOnce(participant.greet._mergeMessages);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'peter@genesis.co.uk/android4711');
                assert.strictEqual(participant.protocolOutQueue[0].to, '');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.greet.state, greeter.STATE.QUIT);
            });

            it('impossible call situation', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         'Blues Brothers',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state = greeter.STATE.NULL;
                assert.throws(function() { participant.quit(); },
                              'Not participating.');
            });

            it('#quit() in workflow', function() {
                this.timeout(this.timeout() * 2);
                // Initialise members.
                var numMembers = 2;
                var participants = {};
                for (var i = 1; i <= numMembers; i++) {
                    participants[i.toString()] = new ns.ProtocolHandler(i.toString(), 'foo',
                                                                        _td.ED25519_PRIV_KEY,
                                                                        _td.ED25519_PUB_KEY,
                                                                        _td.STATIC_PUB_KEY_DIR);
                }

                // Start.
                participants['1'].start(['2']);
                assert.strictEqual(participants['1'].greet.state, greeter.STATE.INIT_UPFLOW);
                var protocolMessage = participants['1'].protocolOutQueue.shift();

                // Processing start/upflow message.
                participants['2'].processMessage(protocolMessage);
                protocolMessage = participants['2'].protocolOutQueue.shift();
                assert.strictEqual(participants['2'].greet.state, greeter.STATE.INIT_DOWNFLOW);
                participants['1'].processMessage(protocolMessage);
                protocolMessage = participants['1'].protocolOutQueue.shift();
                assert.strictEqual(participants['1'].greet.state, greeter.STATE.READY);

                // Participant 2 should process the last confirmation message.
                participants['2'].processMessage(protocolMessage);
                // Participant 2 is also ready.
                assert.strictEqual(participants['2'].greet.state, greeter.STATE.READY);

                participants['1'].quit();
            });
        });

        describe('#refresh() method', function() {
            it('refresh own private key using aka', function() {
                var participant = new ns.ProtocolHandler('dj.jazzy.jeff@rapper.com/android123',
                                                         '80s Rap',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state =  greeter.STATE.READY;
                participant.greet.cliquesMember.groupKey = "Parents Just Don't Understand";
                participant.greet.askeMember.ephemeralPubKeys = [];
                var message = { message: "Fresh Prince",
                                dest: '' };
                sandbox.stub(greeter, 'encodeGreetMessage').returns(message);
                sandbox.stub(codec, 'encodeWirePacket', _echo);
                participant.refresh();
                sinon_assert.calledOnce(greeter.encodeGreetMessage);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.deepEqual(participant.protocolOutQueue[0].message, message);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'dj.jazzy.jeff@rapper.com/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, '');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.greet.state, greeter.STATE.READY);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         'Blues Brothers',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [greeter.STATE.NULL,
                                     greeter.STATE.INIT_UPFLOW,
                                     greeter.STATE.AUX_UPFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.greet.state = illegalStates[i];
                    assert.throws(function() { participant.refresh(); },
                                  'refresh() can only be called from a ready or downflow states.');
                }
            });
        });

        describe('#send() method', function() {
            it('send a message confidentially', function() {
                var participant = new ns.ProtocolHandler('Larry',
                                                         'Tears for Fears',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.exponentialPadding = 0;
                participant.greet.cliquesMember.groupKey = _td.GROUP_KEY;
                participant.greet.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                participant.greet.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                participant.greet.state = greeter.STATE.READY;
                participant._messageSecurity = _dummyMessageSecurity('Larry', participant.greet);
                participant._currentMembers = new struct.ImmutableSet(_td.SESSION_KEY_STORE.sessions[_td.SESSION_ID].members);
                var message = 'Shout, shout, let it all out!';
                participant.send(message);
                assert.lengthOf(participant.messageOutQueue, 1);
                assert.lengthOf(participant.messageOutQueue[0].message, 192);
                assert.strictEqual(participant.messageOutQueue[0].from, 'Larry');
                assert.strictEqual(participant.messageOutQueue[0].to, '');
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
            });

            it('send a message confidentially with exponential padding', function() {
                var participant = new ns.ProtocolHandler('Larry',
                                                         'Tears for Fears',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.cliquesMember.groupKey = _td.GROUP_KEY;
                participant.greet.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                participant.greet.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                participant.greet.state = greeter.STATE.READY;
                participant._messageSecurity = _dummyMessageSecurity('Larry', participant.greet);
                participant._currentMembers = new struct.ImmutableSet(_td.SESSION_KEY_STORE.sessions[_td.SESSION_ID].members);
                var message = 'Shout, shout, let it all out!';
                participant.send(message);
                assert.lengthOf(participant.messageOutQueue, 1);
                assert.lengthOf(participant.messageOutQueue[0].message, 316);
                assert.strictEqual(participant.messageOutQueue[0].from, 'Larry');
                assert.strictEqual(participant.messageOutQueue[0].to, '');
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
            });

            it('on uninitialised state', function() {
                var participant = new ns.ProtocolHandler('kenny@southpark.com/android123',
                                                         'South Park',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state = greeter.STATE.INIT_DOWNFLOW;
                assert.throws(function() { participant.send('Wassup?'); },
                              'Messages can only be sent in ready state.');
            });
        });

        describe('#sendError() method', function() {
            it('send an mpENC protocol error message', function() {
                var participant = new ns.ProtocolHandler('a.dumbledore@hogwarts.ac.uk/android123',
                                                         'Hogwarts',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                participant.greet.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                participant.greet.state = greeter.STATE.AUX_DOWNFLOW;
                participant._messageSecurity = _dummyMessageSecurity('Moe', participant.greet);
                sandbox.stub(participant, 'quit');
                var message = 'Signature verification for q.quirrell@hogwarts.ac.uk/wp8possessed666 failed.';
                participant.sendError(codec.ERROR.TERMINAL, message);
                var outMessage = participant.protocolOutQueue[0].message;
                assert.strictEqual(participant.protocolOutQueue[0].message, codec.encodeWirePacket(_td.ERROR_MESSAGE_STRING));
                assert.strictEqual(participant.protocolOutQueue[0].from, participant.id);
                assert.strictEqual(participant.protocolOutQueue[0].to, '');
                assert.lengthOf(participant.uiQueue, 0);
                sinon_assert.calledOnce(participant.quit);
            });

            it('illegal error severity', function() {
                var participant = new ns.ProtocolHandler('asok@dilbertsintern.org/android123',
                                                         'Dilbert',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = 'Problem retrieving public key for: PointyHairedBoss';
                assert.throws(function() { participant.sendError(42, message); },
                              'Illegal error severity: 42.');
            });
        });

        describe('#processMessage() method', function() {
            it('on plain text message', function() {
                var participant = new ns.ProtocolHandler('2', 'foo',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = {message: 'Pōkarekare ana ngā wai o Waitemata, whiti atu koe hine marino ana e.',
                               from: 'kiri@singer.org.nz/waiata42'};
                participant.processMessage(message);
                assert.lengthOf(participant.protocolOutQueue, 2);
                assert.strictEqual(participant.protocolOutQueue[0].message, ns.PLAINTEXT_AUTO_RESPONSE);
                assert.strictEqual(participant.protocolOutQueue[1].message, codec.encodeWirePacket(codec.MPENC_QUERY_MESSAGE));
                assert.strictEqual(participant.protocolOutQueue[1].from,
                                   '2');
                assert.strictEqual(participant.protocolOutQueue[1].to,
                                   'kiri@singer.org.nz/waiata42');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
                assert.strictEqual(participant.uiQueue[0].type, 'info');
                assert.strictEqual(participant.uiQueue[0].message,
                                   'Received unencrypted message, requesting encryption.');
            });

            // TODO:
            // * check for message showing in ui queue
            // * INFO, WARNING, TERMINAL ERROR, type "error"
            // * invoke quit() on TERMINAL ERROR

            it('on TERMINAL error message', function() {
                var participant = new ns.ProtocolHandler('m.mcgonagall@hogwarts.ac.uk/ios456',
                                                         'Hogwarts',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var messageProperties = { from: 'a.dumbledore@hogwarts.ac.uk/android123',
                                          severity: codec.ERROR.TERMINAL,
                                          signatureOk: true,
                                          message: 'Signature verification for q.quirrell@hogwarts.ac.uk/wp8possessed666 failed.'};
                var message = {message: 'dummy',
                               from: 'a.dumbledore@hogwarts.ac.uk/android123'};
                sandbox.stub(codec, 'decodeWirePacket').returns({ type: codec.MESSAGE_TYPE.MPENC_ERROR,
                                                                   content: 'foo' });
                sandbox.stub(codec, 'decodeErrorMessage').returns(messageProperties);
                sandbox.stub(participant, 'quit');
                participant.processMessage(message);
                sinon_assert.calledOnce(codec.decodeWirePacket);
                sinon_assert.calledOnce(codec.decodeErrorMessage);
                sinon_assert.calledOnce(participant.quit);
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
                assert.strictEqual(participant.uiQueue[0].type, 'error');
                assert.strictEqual(participant.uiQueue[0].message,
                                   'TERMINAL ERROR: Signature verification for q.quirrell@hogwarts.ac.uk/wp8possessed666 failed.');
            });

            it('on WARNING error message', function() {
                var participant = new ns.ProtocolHandler('m.mcgonagall@hogwarts.ac.uk/ios456',
                                                         'Hogwarts',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var messageProperties = { from: 'a.dumbledore@hogwarts.ac.uk/android123',
                                          severity: codec.ERROR.WARNING,
                                          signatureOk: true,
                                          message: 'Signature verification for q.quirrell@hogwarts.ac.uk/wp8possessed666 failed.'};
                var message = { message: 'dummy',
                                from: 'a.dumbledore@hogwarts.ac.uk/android123' };
                sandbox.stub(codec, 'decodeWirePacket').returns({ type: codec.MESSAGE_TYPE.MPENC_ERROR,
                                                                   content: 'foo' });
                sandbox.stub(codec, 'decodeErrorMessage').returns(messageProperties);
                sandbox.stub(participant, 'quit');
                participant.processMessage(message);
                sinon_assert.calledOnce(codec.decodeWirePacket);
                sinon_assert.calledOnce(codec.decodeErrorMessage);
                assert.strictEqual(participant.quit.callCount, 0);
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
                assert.strictEqual(participant.uiQueue[0].type, 'error');
                assert.strictEqual(participant.uiQueue[0].message,
                                   'WARNING: Signature verification for q.quirrell@hogwarts.ac.uk/wp8possessed666 failed.');
            });

            it('on greet message', function() {
                var participant = new ns.ProtocolHandler('2', 'foo',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var groupKey = _td.GROUP_KEY.substring(0, 16);
                participant.greet.cliquesMember.groupKey = groupKey;
                var message = { message: _td.DOWNFLOW_MESSAGE_PAYLOAD,
                                from: 'bar@baz.nl/blah123' };
                sandbox.stub(codec, 'decodeWirePacket').returns(
                        { type: codec.MESSAGE_TYPE.MPENC_GREET_MESSAGE,
                          content: 'foo' });
                sandbox.stub(greeter, 'decodeGreetMessage').returns(_td.DOWNFLOW_MESSAGE_STRING);
                sandbox.stub(participant.greet, '_processMessage').returns(
                        { decodedMessage: _td.DOWNFLOW_MESSAGE_STRING,
                          newState: greeter.STATE.READY });
                sandbox.stub(participant.greet, 'getEphemeralPubKey').returns(_td.ED25519_PUB_KEY);
                sandbox.stub(participant.greet, 'getEphemeralPrivKey').returns(_td.ED25519_PRIV_KEY);
                sandbox.stub(participant.greet, 'getMembers').returns([]);
                sandbox.stub(participant.greet, 'getEphemeralPubKeys').returns([]);
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                sandbox.stub(codec, 'encodeWirePacket', _echo);
                participant.processMessage(message);
                sinon_assert.calledOnce(codec.decodeWirePacket);
                sinon_assert.calledOnce(greeter.decodeGreetMessage);
                sinon_assert.calledOnce(participant.greet._processMessage);
                sinon_assert.calledOnce(greeter.encodeGreetMessage);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].message, _td.DOWNFLOW_MESSAGE_STRING);
                assert.strictEqual(participant.protocolOutQueue[0].from, '2');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
            });

            it('downflow message with invalid session auth', function() {
                var message = { source: '5', dest: '',
                                greetType: greeter.GREET_TYPE.INIT_PARTICIPANT_DOWN,
                                members: ['1', '2', '3', '4', '5'],
                                intKeys: [[], [], [], [], []],
                                nonces: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                pubKeys: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                sessionSignature: 'bar' };
                var participant = new ns.ProtocolHandler('2', 'foo',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                sandbox.stub(codec, 'decodeWirePacket').returns(
                        { type: codec.MESSAGE_TYPE.MPENC_GREET_MESSAGE,
                          content: 'foo' });
                sandbox.stub(greeter, 'decodeGreetMessage').returns(_td.DOWNFLOW_MESSAGE_STRING);
                sandbox.stub(participant.greet, '_processMessage')
                        .throws(new Error('Session authentication by member 5 failed.'));
                sandbox.stub(participant.greet, 'getEphemeralPrivKey').returns(_td.ED25519_PRIV_KEY);
                sandbox.stub(participant.greet, 'getEphemeralPubKey').returns(_td.ED25519_PUB_KEY);
                sandbox.spy(participant.greet, 'quit');
                sandbox.stub(participant.greet.cliquesMember, "akaQuit", stub());
                sandbox.stub(participant.greet.askeMember, "quit", stub());
                sandbox.stub(participant.greet, '_mergeMessages').returns(
                        { dest: '',
                          source: participant.id,
                          greetType: greeter.GREET_TYPE.QUIT_DOWN });
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                sandbox.stub(codec, 'encodeErrorMessage', _echo);
                sandbox.stub(codec, 'encodeWirePacket', _echo);
                participant.processMessage(message);
                assert.strictEqual(codec.decodeWirePacket.callCount, 1);
                assert.strictEqual(greeter.decodeGreetMessage.callCount, 1);
                assert.strictEqual(participant.greet._processMessage.callCount, 1);
                assert.strictEqual(participant.greet.getEphemeralPrivKey.callCount, 3);
                assert.strictEqual(participant.greet.getEphemeralPubKey.callCount, 4);
                assert.strictEqual(participant.greet._mergeMessages.callCount, 1);
                assert.strictEqual(greeter.encodeGreetMessage.callCount, 1);
                // To send two messages.
                assert.lengthOf(participant.protocolOutQueue, 2);
                assert.lengthOf(participant.uiQueue, 0);
                // An error message.
                var outMessage = participant.protocolOutQueue[0];
                assert.deepEqual(outMessage.message, {
                    from: "2",
                    severity: codec.ERROR.TERMINAL,
                    message: 'Session authentication by member 5 failed.'
                });
                assert.strictEqual(outMessage.from, participant.id);
                assert.strictEqual(outMessage.to, '');
                // And a QUIT message.
                assert.strictEqual(participant.greet.quit.callCount, 1);
                outMessage = participant.protocolOutQueue[1];
                assert.strictEqual(outMessage.message.source, participant.id);
                assert.strictEqual(outMessage.from, participant.id);
                assert.strictEqual(outMessage.message.dest, '');
                assert.strictEqual(outMessage.to, '');
                assert.strictEqual(outMessage.message.greetType, greeter.GREET_TYPE.QUIT_DOWN);
            });

            it('on own greet message with flushed ephemeralPubKeys', function() {
                var participant = new ns.ProtocolHandler('1', 'foo',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.cliquesMember.groupKey = _td.GROUP_KEY.substring(0, 16);
                participant.greet.askeMember.ephemeralPubKeys = [];
                participant.greet.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                var message = { message: _td.DOWNFLOW_MESSAGE_PAYLOAD,
                                from: '1' };
                sandbox.stub(codec, 'decodeWirePacket').returns(
                        { type: codec.MESSAGE_TYPE.MPENC_GREET_MESSAGE,
                          content: 'foo' });
                sandbox.stub(greeter, 'decodeGreetMessage').returns(_td.DOWNFLOW_MESSAGE_STRING);
                sandbox.stub(participant.greet, '_processMessage').returns(
                        { decodedMessage: _td.DOWNFLOW_MESSAGE_STRING,
                          newState: greeter.STATE.READY });
                sandbox.stub(greeter, 'encodeGreetMessage', _echo);
                sandbox.stub(codec, 'encodeWirePacket', _echo);
                participant.processMessage(message);
                sinon_assert.calledOnce(codec.decodeWirePacket);
                sinon_assert.calledOnce(greeter.decodeGreetMessage);
                assert.strictEqual(greeter.decodeGreetMessage.getCall(0).args[1], _td.ED25519_PUB_KEY);
                sinon_assert.calledOnce(participant.greet._processMessage);
                sinon_assert.calledOnce(greeter.encodeGreetMessage);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].message, _td.DOWNFLOW_MESSAGE_STRING);
                assert.strictEqual(participant.protocolOutQueue[0].from, '1');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
            });

            it('on data message', function() {
                var participant = new ns.ProtocolHandler('2', 'foo',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.greet.state = greeter.STATE.READY;
                var groupKey = _td.GROUP_KEY.substring(0, 16);
                participant.greet.cliquesMember.groupKey = groupKey;
                participant.greet.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                participant._messageSecurity = _dummyMessageSecurity('Moe', participant.greet);
                var message = {message: _td.DATA_MESSAGE_PAYLOAD,
                               from: 'bar@baz.nl/blah123'};
                sandbox.stub(participant._tryDecrypt, 'trial');
                participant.processMessage(message);
                assert.strictEqual(participant._tryDecrypt.trial.callCount, 1);
                assert.lengthOf(participant._tryDecrypt.trial.getCall(0).args, 1);
                assert.deepEqual(participant._tryDecrypt.trial.getCall(0).args[0],
                    { from: message.from, data: _td.DATA_MESSAGE_STRING });
            });

            it('on data message received out-of-order', function() {
                var members = new struct.ImmutableSet(_td.SESSION_KEY_STORE.sessions[_td.SESSION_ID].members);

                var sender = new ns.ProtocolHandler('Larry', 'Tears for Fears',
                                                    _td.ED25519_PRIV_KEY,
                                                    _td.ED25519_PUB_KEY,
                                                    _td.STATIC_PUB_KEY_DIR);
                sender.exponentialPadding = 0;
                sender.greet.state = greeter.STATE.READY;
                sender.greet.cliquesMember.groupKey = _td.GROUP_KEY;
                sender.greet.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                sender.greet.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                sender._messageSecurity = _dummyMessageSecurity('Larry', sender.greet);
                sender._sessionKeyStore = sender._messageSecurity._sessionKeyStore;
                sender._currentMembers = members;
                sender.send('Message 1');
                sender.send('Message 2');
                assert.lengthOf(sender.messageOutQueue, 2);
                assert.lengthOf(sender.uiQueue, 2);

                var recipient = new ns.ProtocolHandler('Moe', 'Tears for Fears',
                                                        _td.ED25519_PRIV_KEY,
                                                        _td.ED25519_PUB_KEY,
                                                        _td.STATIC_PUB_KEY_DIR);
                recipient.greet.state = greeter.STATE.READY;
                recipient.greet.cliquesMember.groupKey = _td.GROUP_KEY;
                recipient.greet.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                recipient.greet.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                recipient._messageSecurity = _dummyMessageSecurity('Moe', recipient.greet);
                recipient._sessionKeyStore = recipient._messageSecurity._sessionKeyStore;
                recipient._currentMembers = members;
                var message2 = sender.messageOutQueue.pop();
                var message1 = sender.messageOutQueue.pop();
                recipient.processMessage(message2);
                // second message is not accepted...
                assert.lengthOf(recipient.uiQueue, 0);
                recipient.processMessage(message1);
                // until first one is received
                assert.lengthOf(recipient.uiQueue, 2);
                assert.deepEqual(recipient.uiQueue[0].body.content, sender.uiQueue[0].body.content);
                assert.deepEqual(recipient.uiQueue[1].body.content, sender.uiQueue[1].body.content);
            });

            it('on query message', function() {
                var participant = new ns.ProtocolHandler('2', 'foo',
                                                         _td.ED25519_PRIV_KEY,
                                                         _td.ED25519_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = {message: codec.encodeWirePacket(codec.MPENC_QUERY_MESSAGE),
                               from: 'raw@hide.com/rollingrollingrolling'};
                participant.start = stub();
                participant.processMessage(message);
                sinon_assert.calledOnce(participant.start);
            });

            /*it('on quit message', function() {
                // TODO(gk): complete this
            });*/
        });
    });
});
