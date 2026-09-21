const NotificationCenter = require('../notifiers/notificationcenter');
const Growl = require('../notifiers/growl');
const utils = require('../lib/utils');
const path = require('path');
const os = require('os');
const fs = require('fs');
const testUtils = require('./_test-utils');

let notifier = null;
const originalUtils = utils.fileCommandJson;
const originalMacVersion = utils.isMojaveOrLater;
const originalType = os.type;

describe('Mac fallback', function () {
  const original = utils.isMojaveOrLater;
  const originalMac = utils.isMac;

  afterEach(function () {
    utils.isMojaveOrLater = original;
    utils.isMac = originalMac;
  });

  it('should default to Growl notification if older macOS than 10.14', function (done) {
    utils.isMojaveOrLater = function () {
      return false;
    };
    utils.isMac = function () {
      return true;
    };
    const n = new NotificationCenter({ withFallback: true });
    n.notify({ message: 'Hello World' }, function (_, response) {
      expect(this).toBeInstanceOf(Growl);
      done();
    });
  });

  it('should not fallback to Growl notification if withFallback is false', function (done) {
    utils.isMojaveOrLater = function () {
      return false;
    };
    utils.isMac = function () {
      return true;
    };
    const n = new NotificationCenter();
    n.notify({ message: 'Hello World' }, function (err, response) {
      expect(err).toBeTruthy();
      expect(this).not.toBeInstanceOf(Growl);
      done();
    });
  });
});

describe('terminal-notifier', function () {
  beforeEach(function () {
    os.type = function () {
      return 'Darwin';
    };

    utils.isMojaveOrLater = function () {
      return true;
    };
  });

  beforeEach(function () {
    notifier = new NotificationCenter();
  });

  afterEach(function () {
    os.type = originalType;
    utils.isMojaveOrLater = originalMacVersion;
  });

  // Simulate async operation, move to end of message queue.
  function asyncify(fn) {
    return function () {
      const args = arguments;
      setTimeout(function () {
        fn.apply(null, args);
      }, 0);
    };
  }

  describe('#notify()', function () {
    beforeEach(function () {
      utils.fileCommandJson = asyncify(function (n, o, cb) {
        cb(null, '');
      });
    });

    afterEach(function () {
      utils.fileCommandJson = originalUtils;
    });

    it('should notify with a message', function (done) {
      notifier.notify({ message: 'Hello World' }, function (err, response) {
        expect(err).toBeNull();
        done();
      });
    });

    it('should be chainable', function (done) {
      notifier
        .notify({ message: 'First test' })
        .notify({ message: 'Second test' }, function (err, response) {
          expect(err).toBeNull();
          done();
        });
    });

    it('should be able to list all notifications', function (done) {
      utils.fileCommandJson = asyncify(function (n, o, cb) {
        cb(
          null,
          fs
            .readFileSync(path.join(__dirname, '/fixture/listAll.txt'))
            .toString()
        );
      });

      notifier.notify({ list: 'ALL' }, function (_, response) {
        expect(response).toBeTruthy();
        done();
      });
    });

    it('should be able to remove all messages', function (done) {
      utils.fileCommandJson = asyncify(function (n, o, cb) {
        cb(
          null,
          fs
            .readFileSync(path.join(__dirname, '/fixture/removeAll.txt'))
            .toString()
        );
      });

      notifier.notify({ remove: 'ALL' }, function (_, response) {
        expect(response).toBeTruthy();

        utils.fileCommandJson = asyncify(function (n, o, cb) {
          cb(null, '');
        });

        notifier.notify({ list: 'ALL' }, function (_, response) {
          expect(response).toBeFalsy();
          done();
        });
      });
    });
  });

  describe('arguments', function () {
    beforeEach(function () {
      this.original = utils.fileCommandJson;
    });

    afterEach(function () {
      utils.fileCommandJson = this.original;
    });

    function expectArgsListToBe(expected, done) {
      utils.fileCommandJson = asyncify(function (notifier, argsList, callback) {
        expect(argsList).toEqual(expected);
        callback();
        done();
      });
    }

    it('should allow for non-sensical arguments (fail gracefully)', function (done) {
      const expected = [
        '-title',
        '"title"',
        '-message',
        '"body"',
        '-tullball',
        '"notValid"',
        '-timeout',
        '"10"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'title',
        message: 'body',
        tullball: 'notValid'
      });
    });

    it('should validate and transform sound to default sound if Windows sound is selected', function (done) {
      utils.fileCommandJson = asyncify(function (notifier, argsList, callback) {
        expect(testUtils.getOptionValue(argsList, '-title')).toBe('"Heya"');
        expect(testUtils.getOptionValue(argsList, '-sound')).toBe('"Bottle"');
        callback();
        done();
      });
      const notifier = new NotificationCenter();
      notifier.notify({
        title: 'Heya',
        message: 'foo bar',
        sound: 'Notification.Default'
      });
    });

    it('should pass each action as a separate unquoted -action flag', function (done) {
      const expected = [
        '-title',
        '"title \\"message\\""',
        '-message',
        '"body \\"message\\""',
        '-timeout',
        '"10"',
        '-action',
        'foo',
        '-action',
        'bar',
        '-action',
        'baz "foo" bar'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'title "message"',
        message: 'body "message"',
        actions: ['foo', 'bar', 'baz "foo" bar']
      });
    });

    it('should still support wait flag with default timeout', function (done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-timeout',
        '"5"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({ title: 'Title', message: 'Message', wait: true });
    });

    it('should let timeout set precedence over wait', function (done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-timeout',
        '"10"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'Title',
        message: 'Message',
        wait: true,
        timeout: 10
      });
    });

    it('should not set a default timeout if explicitly false', function (done) {
      const expected = ['-title', '"Title"', '-message', '"Message"'];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'Title',
        message: 'Message',
        timeout: false
      });
    });

    it('should pass a bare -reply flag when reply is true', function (done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-timeout',
        '"10"',
        '-reply'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.notify({ title: 'Title', message: 'Message', reply: true });
    });

    it('should pass a reply placeholder unquoted', function (done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-timeout',
        '"10"',
        '-reply',
        'Type here'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.notify({
        title: 'Title',
        message: 'Message',
        reply: 'Type here'
      });
    });

    it('should drop icon and sender, which terminal-notifier 3 cannot use', function (done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-timeout',
        '"10"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.notify({
        title: 'Title',
        message: 'Message',
        icon: '/tmp/icon.png',
        sender: 'com.apple.Terminal'
      });
    });

    it('should escape all title and message', function (done) {
      const expected = [
        '-title',
        '"title \\"message\\""',
        '-message',
        '"body \\"message\\""',
        '-tullball',
        '"notValid"',
        '-timeout',
        '"10"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'title "message"',
        message: 'body "message"',
        tullball: 'notValid'
      });
    });
  });
});

describe('terminal-notifier 3 responses', function () {
  const originalFileCommand = utils.fileCommandJson;
  const originalRegister = utils.registerMacNotifier;
  const originalMac = utils.isMojaveOrLater;

  beforeEach(function () {
    utils.isMojaveOrLater = function () {
      return true;
    };
  });

  afterEach(function () {
    utils.fileCommandJson = originalFileCommand;
    utils.registerMacNotifier = originalRegister;
    utils.isMojaveOrLater = originalMac;
  });

  it('should emit click for a clicked action button', function (done) {
    utils.fileCommandJson = function (n, args, cb) {
      cb(null, utils.parseMacResponse(args, 'Yes\n'));
    };
    const n = new NotificationCenter();
    n.on('click', function (notifier, options, metadata) {
      expect(metadata.activationValue).toBe('Yes');
      done();
    });
    n.notify({ message: 'Hello', actions: ['Yes', 'No'] }, function (err) {
      expect(err).toBeNull();
    });
  });

  it('should emit replied with the typed text', function (done) {
    utils.fileCommandJson = function (n, args, cb) {
      cb(null, utils.parseMacResponse(args, 'Sure thing\n'));
    };
    const n = new NotificationCenter();
    n.on('replied', function (notifier, options, metadata) {
      expect(metadata.activationValue).toBe('Sure thing');
      done();
    });
    n.notify({ message: 'Hello', reply: true });
  });

  it('should emit timeout for @TIMEOUT', function (done) {
    utils.fileCommandJson = function (n, args, cb) {
      cb(null, utils.parseMacResponse(args, '@TIMEOUT\n'));
    };
    const n = new NotificationCenter();
    n.on('timeout', function () {
      done();
    });
    n.notify({ message: 'Hello', actions: 'OK', timeout: 1 });
  });

  it('should register the bundle with LaunchServices and retry when not authorized', function (done) {
    let calls = 0;
    let registered = false;
    utils.fileCommandJson = function (n, args, cb) {
      calls++;
      if (calls === 1) {
        const error = new Error(
          'Command failed: terminal-notifier\nCould not request notification permission: Notifications are not allowed for this application'
        );
        error.code = 3;
        return cb(error, '');
      }
      cb(null, {});
    };
    utils.registerMacNotifier = function (notifierPath, cb) {
      registered = true;
      expect(notifierPath).toMatch(
        /terminal-notifier\.app\/Contents\/MacOS\/terminal-notifier$/
      );
      cb(null);
    };
    const n = new NotificationCenter();
    n.notify({ message: 'Hello' }, function (err) {
      expect(err).toBeNull();
      expect(registered).toBe(true);
      expect(calls).toBe(2);
      done();
    });
  });
});
