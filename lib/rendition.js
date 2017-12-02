"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _eventEmitter = require("event-emitter");

var _eventEmitter2 = _interopRequireDefault(_eventEmitter);

var _core = require("./utils/core");

var _hook = require("./utils/hook");

var _hook2 = _interopRequireDefault(_hook);

var _epubcfi = require("./epubcfi");

var _epubcfi2 = _interopRequireDefault(_epubcfi);

var _queue = require("./utils/queue");

var _queue2 = _interopRequireDefault(_queue);

var _layout = require("./layout");

var _layout2 = _interopRequireDefault(_layout);

var _mapping = require("./mapping");

var _mapping2 = _interopRequireDefault(_mapping);

var _themes = require("./themes");

var _themes2 = _interopRequireDefault(_themes);

var _contents = require("./contents");

var _contents2 = _interopRequireDefault(_contents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * [Rendition description]
 * @class
 * @param {Book} book
 * @param {object} options
 * @param {int} options.width
 * @param {int} options.height
 * @param {string} options.ignoreClass
 * @param {string} options.manager
 * @param {string} options.view
 * @param {string} options.layout
 * @param {string} options.spread
 * @param {int} options.minSpreadWidth overridden by spread: none (never) / both (always)
 * @param {string} options.stylesheet url of stylesheet to be injected
 */
var Rendition = function () {
	function Rendition(book, options) {
		_classCallCheck(this, Rendition);

		this.settings = (0, _core.extend)(this.settings || {}, {
			width: null,
			height: null,
			ignoreClass: "",
			manager: "default",
			view: "iframe",
			flow: null,
			layout: null,
			spread: null,
			minSpreadWidth: 800,
			stylesheet: null,
			script: null
		});

		(0, _core.extend)(this.settings, options);

		if (_typeof(this.settings.manager) === "object") {
			this.manager = this.settings.manager;
		}

		this.viewSettings = {
			ignoreClass: this.settings.ignoreClass
		};

		this.book = book;

		this.views = null;

		/**
   * Adds Hook methods to the Rendition prototype
   * @property {Hook} hooks
   */
		this.hooks = {};
		this.hooks.display = new _hook2.default(this);
		this.hooks.serialize = new _hook2.default(this);
		/**
   * @property {method} hooks.content
   * @type {Hook}
   */
		this.hooks.content = new _hook2.default(this);
		this.hooks.layout = new _hook2.default(this);
		this.hooks.render = new _hook2.default(this);
		this.hooks.show = new _hook2.default(this);

		this.hooks.content.register(this.handleLinks.bind(this));
		this.hooks.content.register(this.passEvents.bind(this));
		this.hooks.content.register(this.adjustImages.bind(this));

		if (this.settings.stylesheet) {
			this.book.spine.hooks.content.register(this.injectStylesheet.bind(this));
		}

		if (this.settings.script) {
			this.book.spine.hooks.content.register(this.injectScript.bind(this));
		}

		// this.hooks.display.register(this.afterDisplay.bind(this));
		this.themes = new _themes2.default(this);

		this.epubcfi = new _epubcfi2.default();

		this.q = new _queue2.default(this);

		this.q.enqueue(this.book.opened);

		// Block the queue until rendering is started
		this.starting = new _core.defer();
		this.started = this.starting.promise;
		this.q.enqueue(this.start);
	}

	/**
  * Set the manager function
  * @param {function} manager
  */


	_createClass(Rendition, [{
		key: "setManager",
		value: function setManager(manager) {
			this.manager = manager;
		}

		/**
   * Require the manager from passed string, or as a function
   * @param  {string|function} manager [description]
   * @return {method}
   */

	}, {
		key: "requireManager",
		value: function requireManager(manager) {
			var viewManager;

			// If manager is a string, try to load from register managers,
			// or require included managers directly
			if (typeof manager === "string") {
				// Use global or require
				viewManager = typeof ePub != "undefined" ? ePub.ViewManagers[manager] : undefined; //require("./managers/"+manager);
			} else {
				// otherwise, assume we were passed a function
				viewManager = manager;
			}

			return viewManager;
		}

		/**
   * Require the view from passed string, or as a function
   * @param  {string|function} view
   * @return {view}
   */

	}, {
		key: "requireView",
		value: function requireView(view) {
			var View;

			if (typeof view == "string") {
				View = typeof ePub != "undefined" ? ePub.Views[view] : undefined; //require("./views/"+view);
			} else {
				// otherwise, assume we were passed a function
				View = view;
			}

			return View;
		}

		/**
   * Start the rendering
   * @return {Promise} rendering has started
   */

	}, {
		key: "start",
		value: function start() {

			if (!this.manager) {
				this.ViewManager = this.requireManager(this.settings.manager);
				this.View = this.requireView(this.settings.view);

				this.manager = new this.ViewManager({
					view: this.View,
					queue: this.q,
					request: this.book.load.bind(this.book),
					settings: this.settings
				});
			}

			// Parse metadata to get layout props
			this.settings.globalLayoutProperties = this.determineLayoutProperties(this.book.package.metadata);

			this.flow(this.settings.globalLayoutProperties.flow);

			this.layout(this.settings.globalLayoutProperties);

			// Listen for displayed views
			this.manager.on("added", this.afterDisplayed.bind(this));

			// Listen for resizing
			this.manager.on("resized", this.onResized.bind(this));

			// Listen for scroll changes
			this.manager.on("scrolled", this.reportLocation.bind(this));

			// Trigger that rendering has started
			this.emit("started");

			// Start processing queue
			this.starting.resolve();
		}

		/**
   * Call to attach the container to an element in the dom
   * Container must be attached before rendering can begin
   * @param  {element} element to attach to
   * @return {Promise}
   */

	}, {
		key: "attachTo",
		value: function attachTo(element) {

			return this.q.enqueue(function () {

				// Start rendering
				this.manager.render(element, {
					"width": this.settings.width,
					"height": this.settings.height
				});

				// Trigger Attached
				this.emit("attached");
			}.bind(this));
		}

		/**
   * Display a point in the book
   * The request will be added to the rendering Queue,
   * so it will wait until book is opened, rendering started
   * and all other rendering tasks have finished to be called.
   * @param  {string} target Url or EpubCFI
   * @return {Promise}
   */

	}, {
		key: "display",
		value: function display(target) {

			return this.q.enqueue(this._display, target);
		}

		/**
   * Tells the manager what to display immediately
   * @private
   * @param  {string} target Url or EpubCFI
   * @return {Promise}
   */

	}, {
		key: "_display",
		value: function _display(target) {
			if (!this.book) {
				return;
			}
			var isCfiString = this.epubcfi.isCfiString(target);
			var displaying = new _core.defer();
			var displayed = displaying.promise;
			var section;
			var moveTo;

			// Check if this is a book percentage
			if (this.book.locations.length && (0, _core.isFloat)(target)) {
				target = this.book.locations.cfiFromPercentage(target);
			}

			section = this.book.spine.get(target);

			if (!section) {
				displaying.reject(new Error("No Section Found"));
				return displayed;
			}

			return this.manager.display(section, target).then(function () {
				this.emit("displayed", section);
				this.reportLocation();
			}.bind(this));
		}

		/*
  render(view, show) {
  		// view.onLayout = this.layout.format.bind(this.layout);
  	view.create();
  		// Fit to size of the container, apply padding
  	this.manager.resizeView(view);
  		// Render Chain
  	return view.section.render(this.book.request)
  		.then(function(contents){
  			return view.load(contents);
  		}.bind(this))
  		.then(function(doc){
  			return this.hooks.content.trigger(view, this);
  		}.bind(this))
  		.then(function(){
  			this.layout.format(view.contents);
  			return this.hooks.layout.trigger(view, this);
  		}.bind(this))
  		.then(function(){
  			return view.display();
  		}.bind(this))
  		.then(function(){
  			return this.hooks.render.trigger(view, this);
  		}.bind(this))
  		.then(function(){
  			if(show !== false) {
  				this.q.enqueue(function(view){
  					view.show();
  				}, view);
  			}
  			// this.map = new Map(view, this.layout);
  			this.hooks.show.trigger(view, this);
  			this.trigger("rendered", view.section);
  			}.bind(this))
  		.catch(function(e){
  			this.trigger("loaderror", e);
  		}.bind(this));
  	}
  */

		/**
   * Report what has been displayed
   * @private
   * @param  {*} view
   */

	}, {
		key: "afterDisplayed",
		value: function afterDisplayed(view) {
			this.hooks.content.trigger(view.contents, this);
			this.emit("rendered", view.section, view);
			// this.reportLocation();
		}

		/**
   * Report resize events and display the last seen location
   * @private
   */

	}, {
		key: "onResized",
		value: function onResized(size) {

			if (this.location) {
				this.display(this.location.start);
			}

			this.emit("resized", {
				width: size.width,
				height: size.height
			});
		}

		/**
   * Move the Rendition to a specific offset
   * Usually you would be better off calling display()
   * @param {object} offset
   */

	}, {
		key: "moveTo",
		value: function moveTo(offset) {
			this.manager.moveTo(offset);
		}

		/**
   * Go to the next "page" in the rendition
   * @return {Promise}
   */

	}, {
		key: "next",
		value: function next() {
			return this.q.enqueue(this.manager.next.bind(this.manager)).then(this.reportLocation.bind(this));
		}

		/**
   * Go to the previous "page" in the rendition
   * @return {Promise}
   */

	}, {
		key: "prev",
		value: function prev() {
			return this.q.enqueue(this.manager.prev.bind(this.manager)).then(this.reportLocation.bind(this));
		}

		//-- http://www.idpf.org/epub/301/spec/epub-publications.html#meta-properties-rendering
		/**
   * Determine the Layout properties from metadata and settings
   * @private
   * @param  {object} metadata
   * @return {object} properties
   */

	}, {
		key: "determineLayoutProperties",
		value: function determineLayoutProperties(metadata) {
			var properties;
			var layout = this.settings.layout || metadata.layout || "reflowable";
			var spread = this.settings.spread || metadata.spread || "auto";
			var orientation = this.settings.orientation || metadata.orientation || "auto";
			var flow = this.settings.flow || metadata.flow || "auto";
			var viewport = metadata.viewport || "";
			var minSpreadWidth = this.settings.minSpreadWidth || metadata.minSpreadWidth || 800;

			if (this.settings.width >= 0 && this.settings.height >= 0) {
				viewport = "width=" + this.settings.width + ", height=" + this.settings.height + "";
			}

			properties = {
				layout: layout,
				spread: spread,
				orientation: orientation,
				flow: flow,
				viewport: viewport,
				minSpreadWidth: minSpreadWidth
			};

			return properties;
		}

		// applyLayoutProperties(){
		// 	var settings = this.determineLayoutProperties(this.book.package.metadata);
		//
		// 	this.flow(settings.flow);
		//
		// 	this.layout(settings);
		// };

		/**
   * Adjust the flow of the rendition to paginated or scrolled
   * (scrolled-continuous vs scrolled-doc are handled by different view managers)
   * @param  {string} flow
   */

	}, {
		key: "flow",
		value: function flow(_flow2) {
			var _flow = _flow2;
			if (_flow2 === "scrolled-doc" || _flow2 === "scrolled-continuous") {
				_flow = "scrolled";
			}

			if (_flow2 === "auto" || _flow2 === "paginated") {
				_flow = "paginated";
			}

			if (this._layout) {
				this._layout.flow(_flow);
			}

			if (this.manager) {
				this.manager.updateFlow(_flow);
			}
		}

		/**
   * Adjust the layout of the rendition to reflowable or pre-paginated
   * @param  {object} settings
   */

	}, {
		key: "layout",
		value: function layout(settings) {
			if (settings) {
				this._layout = new _layout2.default(settings);
				this._layout.spread(settings.spread, this.settings.minSpreadWidth);

				this.mapping = new _mapping2.default(this._layout.props);
			}

			if (this.manager && this._layout) {
				this.manager.applyLayout(this._layout);
			}

			return this._layout;
		}

		/**
   * Adjust if the rendition uses spreads
   * @param  {string} spread none | auto (TODO: implement landscape, portrait, both)
   * @param  {int} min min width to use spreads at
   */

	}, {
		key: "spread",
		value: function spread(_spread, min) {

			this._layout.spread(_spread, min);

			if (this.manager.isRendered()) {
				this.manager.updateLayout();
			}
		}

		/**
   * Report the current location
   * @private
   */

	}, {
		key: "reportLocation",
		value: function reportLocation() {
			return this.q.enqueue(function () {
				var location = this.manager.currentLocation();
				if (location && location.then && typeof location.then === "function") {
					location.then(function (result) {
						this.location = result;

						this.percentage = this.book.locations.percentageFromCfi(result);
						if (this.percentage != null) {
							this.location.percentage = this.percentage;
						}

						this.emit("locationChanged", this.location);
					}.bind(this));
				} else if (location) {
					this.location = location;
					this.percentage = this.book.locations.percentageFromCfi(location);
					if (this.percentage != null) {
						this.location.percentage = this.percentage;
					}

					this.emit("locationChanged", this.location);
				}
			}.bind(this));
		}

		/**
   * Get the Current Location CFI
   * @return {EpubCFI} location (may be a promise)
   */

	}, {
		key: "currentLocation",
		value: function currentLocation() {
			var location = this.manager.currentLocation();
			if (location && location.then && typeof location.then === "function") {
				location.then(function (result) {
					var percentage = this.book.locations.percentageFromCfi(result);
					if (percentage != null) {
						result.percentage = percentage;
					}
					return result;
				}.bind(this));
			} else if (location) {
				var percentage = this.book.locations.percentageFromCfi(location);
				if (percentage != null) {
					location.percentage = percentage;
				}
				return location;
			}
		}

		/**
   * Remove and Clean Up the Rendition
   */

	}, {
		key: "destroy",
		value: function destroy() {
			// Clear the queue
			// this.q.clear();
			// this.q = undefined;

			this.manager && this.manager.destroy();

			this.book = undefined;

			this.views = null;

			// this.hooks.display.clear();
			// this.hooks.serialize.clear();
			// this.hooks.content.clear();
			// this.hooks.layout.clear();
			// this.hooks.render.clear();
			// this.hooks.show.clear();
			// this.hooks = {};

			// this.themes.destroy();
			// this.themes = undefined;

			// this.epubcfi = undefined;

			// this.starting = undefined;
			// this.started = undefined;

		}

		/**
   * Pass the events from a view
   * @private
   * @param  {View} view
   */

	}, {
		key: "passEvents",
		value: function passEvents(contents) {
			var _this = this;

			var listenedEvents = _contents2.default.listenedEvents;

			listenedEvents.forEach(function (e) {
				contents.on(e, function (ev) {
					return _this.triggerViewEvent(ev, contents);
				});
			});

			contents.on("selected", function (e) {
				return _this.triggerSelectedEvent(e, contents);
			});
			contents.on("markClicked", function (cfiRange, data) {
				return _this.triggerMarkEvent(cfiRange, data, contents);
			});
		}

		/**
   * Emit events passed by a view
   * @private
   * @param  {event} e
   */

	}, {
		key: "triggerViewEvent",
		value: function triggerViewEvent(e, contents) {
			this.emit(e.type, e, contents);
		}

		/**
   * Emit a selection event's CFI Range passed from a a view
   * @private
   * @param  {EpubCFI} cfirange
   */

	}, {
		key: "triggerSelectedEvent",
		value: function triggerSelectedEvent(cfirange, contents) {
			this.emit("selected", cfirange, contents);
		}

		/**
   * Emit a markClicked event with the cfiRange and data from a mark
   * @private
   * @param  {EpubCFI} cfirange
   */

	}, {
		key: "triggerMarkEvent",
		value: function triggerMarkEvent(cfiRange, data, contents) {
			this.emit("markClicked", cfiRange, data, contents);
		}

		/**
   * Get a Range from a Visible CFI
   * @param  {string} cfi EpubCfi String
   * @param  {string} ignoreClass
   * @return {range}
   */

	}, {
		key: "getRange",
		value: function getRange(cfi, ignoreClass) {
			var _cfi = new _epubcfi2.default(cfi);
			var found = this.manager.visible().filter(function (view) {
				if (_cfi.spinePos === view.index) return true;
			});

			// Should only every return 1 item
			if (found.length) {
				return found[0].contents.range(_cfi, ignoreClass);
			}
		}

		/**
   * Hook to adjust images to fit in columns
   * @param  {View} view
   */

	}, {
		key: "adjustImages",
		value: function adjustImages(contents) {

			if (this._layout.name === "pre-paginated") {
				return new Promise(function (resolve) {
					resolve();
				});
			}

			contents.addStylesheetRules({
				"img": {
					"max-width": this._layout.columnWidth + "px !important",
					"max-height": this._layout.height + "px !important",
					"object-fit": "contain",
					"page-break-inside": "avoid"
				}
			});

			return new Promise(function (resolve, reject) {
				// Wait to apply
				setTimeout(function () {
					resolve();
				}, 1);
			});
		}
	}, {
		key: "getContents",
		value: function getContents() {
			return this.manager ? this.manager.getContents() : [];
		}
	}, {
		key: "handleLinks",
		value: function handleLinks(contents) {
			var _this2 = this;

			contents.on("link", function (href) {
				var relative = _this2.book.path.relative(href);
				_this2.display(relative);
			});
		}
	}, {
		key: "injectStylesheet",
		value: function injectStylesheet(doc, section) {
			var style = doc.createElement("link");
			style.setAttribute("type", "text/css");
			style.setAttribute("rel", "stylesheet");
			style.setAttribute("href", this.settings.stylesheet);
			doc.getElementsByTagName("head")[0].appendChild(style);
		}
	}, {
		key: "injectScript",
		value: function injectScript(doc, section) {
			var script = doc.createElement("script");
			script.setAttribute("type", "text/javascript");
			script.setAttribute("src", this.settings.script);
			script.textContent = " "; // Needed to prevent self closing tag
			doc.getElementsByTagName("head")[0].appendChild(script);
		}
	}]);

	return Rendition;
}();

//-- Enable binding events to Renderer


(0, _eventEmitter2.default)(Rendition.prototype);

exports.default = Rendition;
module.exports = exports["default"];