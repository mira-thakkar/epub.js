"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _book = require("./book");

var _book2 = _interopRequireDefault(_book);

var _rendition = require("./rendition");

var _rendition2 = _interopRequireDefault(_rendition);

var _epubcfi = require("./epubcfi");

var _epubcfi2 = _interopRequireDefault(_epubcfi);

var _contents = require("./contents");

var _contents2 = _interopRequireDefault(_contents);

var _core = require("./utils/core");

var core = _interopRequireWildcard(_core);

require("../libs/url/url-polyfill");

var _iframe = require("./managers/views/iframe");

var _iframe2 = _interopRequireDefault(_iframe);

var _default = require("./managers/default");

var _default2 = _interopRequireDefault(_default);

var _continuous = require("./managers/continuous");

var _continuous2 = _interopRequireDefault(_continuous);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Creates a new Book
 * @param {string|ArrayBuffer} url URL, Path or ArrayBuffer
 * @param {object} options to pass to the book
 * @returns {Book} a new Book object
 * @example ePub("/path/to/book.epub", {})
 */
function ePub(url, options) {
	return new _book2.default(url, options);
}

ePub.VERSION = "0.3";

if (typeof global !== "undefined") {
	global.EPUBJS_VERSION = ePub.VERSION;
}

ePub.CFI = _epubcfi2.default;
ePub.Rendition = _rendition2.default;
ePub.Contents = _contents2.default;
ePub.utils = core;

ePub.ViewManagers = {};
ePub.Views = {};
/**
 * Register Managers and Views
 */
ePub.register = {
	/**
  * register a new view manager
  */
	manager: function manager(name, _manager) {
		return ePub.ViewManagers[name] = _manager;
	},
	/**
  * register a new view
  */
	view: function view(name, _view) {
		return ePub.Views[name] = _view;
	}
};

// Default Views
ePub.register.view("iframe", _iframe2.default);

// Default View Managers
ePub.register.manager("default", _default2.default);
ePub.register.manager("continuous", _continuous2.default);

exports.default = ePub;
module.exports = exports["default"];