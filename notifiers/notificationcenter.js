/**
 * A Node.js wrapper for terminal-notify (with fallback).
 */
const utils = require('../lib/utils');
const Growl = require('./growl');
const path = require('path');
const notifier = path.join(
  __dirname,
  '../vendor/mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier'
);

const EventEmitter = require('events').EventEmitter;
const util = require('util');

const errorMessageOsX =
  'You need macOS 10.14 or above to use NotificationCenter,' +
  ' or use Growl fallback with constructor option {withFallback: true}.';

module.exports = NotificationCenter;

function NotificationCenter(options) {
  options = utils.clone(options || {});
  if (!(this instanceof NotificationCenter)) {
    return new NotificationCenter(options);
  }
  this.options = options;

  EventEmitter.call(this);
}
util.inherits(NotificationCenter, EventEmitter);
let activeId = null;

function noop() {}
function notifyRaw(options, callback) {
  let fallbackNotifier;
  const id = identificator();
  options = utils.clone(options || {});
  activeId = id;

  if (typeof options === 'string') {
    options = { title: 'node-notifier', message: options };
  }
  callback = callback || noop;

  if (typeof callback !== 'function') {
    throw new TypeError(
      'The second argument must be a function callback. You have passed ' +
        typeof fn
    );
  }

  const actionJackedCallback = utils.actionJackerDecorator(
    this,
    options,
    callback,
    function (data) {
      if (activeId !== id) return false;

      if (data === 'activate') {
        return 'click';
      }
      if (data === 'timeout') {
        return 'timeout';
      }
      if (data === 'replied') {
        return 'replied';
      }
      return false;
    }
  );

  options = utils.mapToMac(options);

  if (!options.message && !options.group && !options.list && !options.remove) {
    callback(new Error('Message, group, remove or list property is required.'));
    return this;
  }

  const argsList = constructMacArgumentList(options);
  if (utils.isMojaveOrLater()) {
    runNotifier(
      this.options.customPath || notifier,
      argsList,
      actionJackedCallback
    );
    return this;
  }

  if (fallbackNotifier || !!this.options.withFallback) {
    fallbackNotifier = fallbackNotifier || new Growl(this.options);
    return fallbackNotifier.notify(options, callback);
  }

  callback(new Error(errorMessageOsX));
  return this;
}

/**
 * terminal-notifier >= 3 reads `-action` and `-reply` straight from argv
 * instead of through NSUserDefaults, so they must not be wrapped in quotes,
 * `-action` may repeat (one per button) and `-reply` may stand alone.
 */
function constructMacArgumentList(options) {
  let actions = options.actions;
  const reply = options.reply;
  delete options.actions;
  delete options.reply;

  const argsList = utils.constructArgumentList(options);

  if (actions) {
    actions = utils.isArray(actions) ? actions : [actions];
    actions.forEach(function (action) {
      argsList.push('-action', String(action));
    });
  }

  if (typeof reply === 'string') {
    argsList.push('-reply', reply);
  } else if (reply) {
    argsList.push('-reply');
  }

  return argsList;
}

function runNotifier(notifierPath, argsList, callback) {
  utils.fileCommandJson(notifierPath, argsList, function (error, data) {
    if (!utils.isMacNotAuthorizedError(error, data)) {
      return callback(error, data);
    }

    // First run of the bundled binary on this machine: make LaunchServices
    // aware of the app bundle so macOS can show the permission prompt, then
    // try once more.
    utils.registerMacNotifier(notifierPath, function (registerError) {
      if (registerError) return callback(error, data);
      utils.fileCommandJson(notifierPath, argsList, callback);
    });
  });
}

Object.defineProperty(NotificationCenter.prototype, 'notify', {
  get: function () {
    if (!this._notify) this._notify = notifyRaw.bind(this);
    return this._notify;
  }
});

function identificator() {
  return { _ref: 'val' };
}
