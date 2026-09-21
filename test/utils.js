const path = require('path');
const fs = require('fs');
const _ = require('../lib/utils');

describe('utils', function () {
  describe('clone', function () {
    it('should clone nested objects', function () {
      const obj = { a: { b: 42 }, c: 123 };
      const obj2 = _.clone(obj);

      expect(obj).toEqual(obj2);
      obj.a.b += 2;
      obj.c += 2;
      expect(obj).not.toEqual(obj2);
    });
  });

  describe('mapping', function () {
    it('should map icon for notify-send', function () {
      const expected = {
        title: 'Foo',
        message: 'Bar',
        icon: 'foobar',
        'expire-time': 10000
      };

      expect(
        _.mapToNotifySend({ title: 'Foo', message: 'Bar', appIcon: 'foobar' })
      ).toEqual(expected);

      expect(
        _.mapToNotifySend({ title: 'Foo', message: 'Bar', i: 'foobar' })
      ).toEqual(expected);
    });

    it('should map short hand for notify-sned', function () {
      const expected = {
        urgency: 'a',
        'expire-time': 'b',
        category: 'c',
        icon: 'd',
        hint: 'e'
      };

      expect(
        _.mapToNotifySend({ u: 'a', e: 'b', c: 'c', i: 'd', h: 'e' })
      ).toEqual(expected);
    });

    it('should drop icon for notification center (unsupported by terminal-notifier 3)', function () {
      const expected = {
        title: 'Foo',
        message: 'Bar',
        timeout: 10
      };

      expect(
        _.mapToMac({ title: 'Foo', message: 'Bar', icon: 'foobar' })
      ).toEqual(expected);

      expect(_.mapToMac({ title: 'Foo', message: 'Bar', i: 'foobar' })).toEqual(
        expected
      );
    });

    it('should parse terminal-notifier responses', function () {
      expect(
        _.parseMacResponse([], '{"activationType":"contentsClicked"}')
      ).toEqual({
        activationType: 'contentsClicked'
      });
      expect(_.parseMacResponse(['-action', 'Yes'], '@TIMEOUT\n')).toEqual({
        activationType: 'timedOut'
      });
      expect(_.parseMacResponse(['-action', 'Yes'], '@CLOSED\n')).toEqual({
        activationType: 'closed'
      });
      expect(
        _.parseMacResponse(['-action', 'Yes'], '@ACTIONCLICKED\n')
      ).toEqual({
        activationType: 'contentsClicked'
      });
      expect(_.parseMacResponse(['-action', 'Yes'], 'Yes\n')).toEqual({
        activationType: 'actionClicked',
        activationValue: 'Yes'
      });
      expect(_.parseMacResponse(['-reply'], 'Hello\n')).toEqual({
        activationType: 'replied',
        activationValue: 'Hello'
      });
      expect(_.parseMacResponse(['-list', '"ALL"'], 'GroupID\tTitle\n')).toBe(
        'GroupID\tTitle\n'
      );
    });

    it('should map icon for growl', function () {
      const icon = path.join(__dirname, 'fixture', 'coulson.jpg');
      const iconRead = fs.readFileSync(icon);

      const expected = { title: 'Foo', message: 'Bar', icon: iconRead };

      let obj = _.mapToGrowl({ title: 'Foo', message: 'Bar', icon: icon });
      expect(obj).toEqual(expected);

      expect(obj.icon).toBeTruthy();
      expect(Buffer.isBuffer(obj.icon)).toBeTruthy();

      obj = _.mapToGrowl({ title: 'Foo', message: 'Bar', appIcon: icon });

      expect(obj.icon).toBeTruthy();
      expect(Buffer.isBuffer(obj.icon)).toBeTruthy();
    });

    it('should not map icon url for growl', function () {
      const icon = 'http://hostname.com/logo.png';

      const expected = { title: 'Foo', message: 'Bar', icon: icon };

      expect(
        _.mapToGrowl({ title: 'Foo', message: 'Bar', icon: icon })
      ).toEqual(expected);

      expect(
        _.mapToGrowl({ title: 'Foo', message: 'Bar', appIcon: icon })
      ).toEqual(expected);
    });
  });
});
