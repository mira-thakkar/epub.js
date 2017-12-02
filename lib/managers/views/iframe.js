"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _eventEmitter = require("event-emitter");

var _eventEmitter2 = _interopRequireDefault(_eventEmitter);

var _core = require("../../utils/core");

var _epubcfi = require("../../epubcfi");

var _epubcfi2 = _interopRequireDefault(_epubcfi);

var _contents = require("../../contents");

var _contents2 = _interopRequireDefault(_contents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var IframeView = function () {
	function IframeView(section, options) {
		_classCallCheck(this, IframeView);

		this.settings = (0, _core.extend)({
			ignoreClass: "",
			axis: "vertical",
			width: 0,
			height: 0,
			layout: undefined,
			globalLayoutProperties: {}
		}, options || {});

		this.id = "epubjs-view-" + (0, _core.uuid)();
		this.section = section;
		this.index = section.index;

		this.element = this.container(this.settings.axis);

		this.added = false;
		this.displayed = false;
		this.rendered = false;

		this.width = this.settings.width;
		this.height = this.settings.height;

		this.fixedWidth = 0;
		this.fixedHeight = 0;

		// Blank Cfi for Parsing
		this.epubcfi = new _epubcfi2.default();

		this.layout = this.settings.layout;
		// Dom events to listen for
		// this.listenedEvents = ["keydown", "keyup", "keypressed", "mouseup", "mousedown", "click", "touchend", "touchstart"];
	}

	_createClass(IframeView, [{
		key: "container",
		value: function container(axis) {
			var element = document.createElement("div");

			element.classList.add("epub-view");

			// this.element.style.minHeight = "100px";
			element.style.height = "0px";
			element.style.width = "0px";
			element.style.overflow = "hidden";

			if (axis && axis == "horizontal") {
				element.style.display = "inline-block";
			} else {
				element.style.display = "block";
			}

			return element;
		}
	}, {
		key: "create",
		value: function create() {

			if (this.iframe) {
				return this.iframe;
			}

			if (!this.element) {
				this.element = this.createContainer();
			}

			this.iframe = document.createElement("iframe");
			this.iframe.id = this.id;
			this.iframe.scrolling = "no"; // Might need to be removed: breaks ios width calculations
			this.iframe.style.overflow = "hidden";
			this.iframe.seamless = "seamless";
			// Back up if seamless isn't supported
			this.iframe.style.border = "none";

			this.resizing = true;

			// this.iframe.style.display = "none";
			this.element.style.visibility = "hidden";
			this.iframe.style.visibility = "hidden";

			this.iframe.style.width = "0";
			this.iframe.style.height = "0";
			this._width = 0;
			this._height = 0;

			this.element.appendChild(this.iframe);
			this.added = true;

			this.elementBounds = (0, _core.bounds)(this.element);

			// if(width || height){
			//   this.resize(width, height);
			// } else if(this.width && this.height){
			//   this.resize(this.width, this.height);
			// } else {
			//   this.iframeBounds = bounds(this.iframe);
			// }

			// Firefox has trouble with baseURI and srcdoc
			// TODO: Disable for now in firefox

			if ("srcdoc" in this.iframe && !this.settings.globalOptions.disableSrcdoc) {
				this.supportsSrcdoc = true;
			} else {
				this.supportsSrcdoc = false;
			}

			return this.iframe;
		}
	}, {
		key: "render",
		value: function render(request, show) {

			// view.onLayout = this.layout.format.bind(this.layout);
			this.create();

			// Fit to size of the container, apply padding
			this.size();

			if (!this.sectionRender) {
				this.sectionRender = this.section.render(request);
			}

			// Render Chain
			return this.sectionRender.then(function (contents) {
				return this.load(contents);
			}.bind(this))
			// .then(function(doc){
			// 	return this.hooks.content.trigger(view, this);
			// }.bind(this))
			.then(function () {
				// this.settings.layout.format(view.contents);
				// return this.hooks.layout.trigger(view, this);
			}.bind(this))
			// .then(function(){
			// 	return this.display();
			// }.bind(this))
			// .then(function(){
			// 	return this.hooks.render.trigger(view, this);
			// }.bind(this))
			.then(function () {
				var _this = this;

				// apply the layout function to the contents
				this.settings.layout.format(this.contents);

				// Listen for events that require an expansion of the iframe
				this.addListeners();

				// Wait for formating to apply
				return new Promise(function (resolve, reject) {
					setTimeout(function () {
						// Expand the iframe to the full size of the content
						_this.expand();
						resolve();
					}, 1);
				});
			}.bind(this)).then(function () {
				this.emit("rendered", this.section);
			}.bind(this)).catch(function (e) {
				this.emit("loaderror", e);
			}.bind(this));
		}

		// Determine locks base on settings

	}, {
		key: "size",
		value: function size(_width, _height) {
			var width = _width || this.settings.width;
			var height = _height || this.settings.height;

			if (this.layout.name === "pre-paginated") {
				this.lock("both", width, height);
			} else if (this.settings.axis === "horizontal") {
				this.lock("height", width, height);
			} else {
				this.lock("width", width, height);
			}
		}

		// Lock an axis to element dimensions, taking borders into account

	}, {
		key: "lock",
		value: function lock(what, width, height) {
			var elBorders = (0, _core.borders)(this.element);
			var iframeBorders;

			if (this.iframe) {
				iframeBorders = (0, _core.borders)(this.iframe);
			} else {
				iframeBorders = { width: 0, height: 0 };
			}

			if (what == "width" && (0, _core.isNumber)(width)) {
				this.lockedWidth = width - elBorders.width - iframeBorders.width;
				this.resize(this.lockedWidth, width); //  width keeps ratio correct
			}

			if (what == "height" && (0, _core.isNumber)(height)) {
				this.lockedHeight = height - elBorders.height - iframeBorders.height;
				this.resize(width, this.lockedHeight);
			}

			if (what === "both" && (0, _core.isNumber)(width) && (0, _core.isNumber)(height)) {

				this.lockedWidth = width - elBorders.width - iframeBorders.width;
				this.lockedHeight = height - elBorders.height - iframeBorders.height;
				this.resize(this.lockedWidth, this.lockedHeight);
			}

			if (this.displayed && this.iframe) {

				// this.contents.layout();
				this.expand();
			}
		}

		// Resize a single axis based on content dimensions

	}, {
		key: "expand",
		value: function expand(force) {
			var width = this.lockedWidth;
			var height = this.lockedHeight;
			var columns;

			var textWidth, textHeight;

			if (!this.iframe || this._expanding) return;

			if (this.layout.name === "pre-paginated") return;

			this._expanding = true;
			// Expand Horizontally
			// if(height && !width) {
			if (this.settings.axis === "horizontal") {
				// Get the width of the text
				textWidth = this.contents.textWidth();
				width = this.contentWidth(textWidth);

				// Check if the textWidth has changed
				if (width != this._width) {
					// Get the contentWidth by resizing the iframe
					// Check with a min reset of the textWidth

					// width = this.contentWidth(textWidth);

					columns = Math.ceil(width / (this.settings.layout.columnWidth + this.settings.layout.gap));

					if (this.settings.layout.divisor > 1 && this.settings.layout.name === "reflowable" && columns % 2 > 0) {
						// add a blank page
						width += this.settings.layout.gap + this.settings.layout.columnWidth;
					}

					// Save the textWdith
					this._textWidth = textWidth;

					// Save the contentWidth
					this._contentWidth = width;
				} else {
					// Otherwise assume content height hasn't changed
					width = this._contentWidth;
				}
			} // Expand Vertically
			else if (this.settings.axis === "vertical") {
					textHeight = this.contents.textHeight();
					if (textHeight != this._textHeight) {
						height = this.contentHeight(textHeight);
						this._textHeight = textHeight;
						this._contentHeight = height;
					} else {
						height = this._contentHeight;
					}
				}

			// Only Resize if dimensions have changed or
			// if Frame is still hidden, so needs reframing
			if (this._needsReframe || width != this._width || height != this._height) {
				this.resize(width, height);
			}

			this._expanding = false;
		}
	}, {
		key: "contentWidth",
		value: function contentWidth(min) {
			var prev;
			var width;

			// Save previous width
			prev = this.iframe.style.width;
			// Set the iframe size to min, width will only ever be greater
			// Will preserve the aspect ratio
			this.iframe.style.width = (min || 0) + "px";
			// Get the scroll overflow width
			width = this.contents.scrollWidth();
			// Reset iframe size back
			this.iframe.style.width = prev;
			return width;
		}
	}, {
		key: "contentHeight",
		value: function contentHeight(min) {
			var prev;
			var height;

			prev = this.iframe.style.height;
			this.iframe.style.height = (min || 0) + "px";
			height = this.contents.scrollHeight();

			this.iframe.style.height = prev;
			return height;
		}
	}, {
		key: "resize",
		value: function resize(width, height) {

			if (!this.iframe) return;

			if ((0, _core.isNumber)(width)) {
				this.iframe.style.width = width + "px";
				this._width = width;
			}

			if ((0, _core.isNumber)(height)) {
				this.iframe.style.height = height + "px";
				this._height = height;
			}

			this.iframeBounds = (0, _core.bounds)(this.iframe);

			this.reframe(this.iframeBounds.width, this.iframeBounds.height);
		}
	}, {
		key: "reframe",
		value: function reframe(width, height) {
			var size;

			// if(!this.displayed) {
			//   this._needsReframe = true;
			//   return;
			// }

			if ((0, _core.isNumber)(width)) {
				this.element.style.width = width + "px";
			}

			if ((0, _core.isNumber)(height)) {
				this.element.style.height = height + "px";
			}

			this.prevBounds = this.elementBounds;

			this.elementBounds = (0, _core.bounds)(this.element);

			size = {
				width: this.elementBounds.width,
				height: this.elementBounds.height,
				widthDelta: this.elementBounds.width - this.prevBounds.width,
				heightDelta: this.elementBounds.height - this.prevBounds.height
			};

			this.onResize(this, size);

			if (this.contents) {
				this.settings.layout.format(this.contents);
			}

			this.emit("resized", size);
		}
	}, {
		key: "load",
		value: function load(contents) {
			var loading = new _core.defer();
			var loaded = loading.promise;

			if (!this.iframe) {
				loading.reject(new Error("No Iframe Available"));
				return loaded;
			}

			this.iframe.onload = function (event) {

				this.onLoad(event, loading);
			}.bind(this);

			if (this.supportsSrcdoc) {
				this.iframe.srcdoc = contents;
			} else {

				this.document = this.iframe.contentDocument;

				if (!this.document) {
					loading.reject(new Error("No Document Available"));
					return loaded;
				}

				this.iframe.contentDocument.open();
				this.iframe.contentDocument.write(contents);
				this.iframe.contentDocument.close();
			}

			return loaded;
		}
	}, {
		key: "onLoad",
		value: function onLoad(event, promise) {
			var _this2 = this;

			this.window = this.iframe.contentWindow;
			this.document = this.iframe.contentDocument;

			this.contents = new _contents2.default(this.document, this.document.body, this.section.cfiBase);

			this.rendering = false;

			var link = this.document.querySelector("link[rel='canonical']");
			if (link) {
				link.setAttribute("href", this.section.url);
			} else {
				link = this.document.createElement("link");
				link.setAttribute("rel", "canonical");
				link.setAttribute("href", this.section.url);
				this.document.querySelector("head").appendChild(link);
			}

			this.contents.on("expand", function () {
				if (_this2.displayed && _this2.iframe) {
					_this2.expand();
				}
			});

			this.contents.on("resize", function (e) {
				if (_this2.displayed && _this2.iframe) {
					_this2.expand();
				}
			});

			promise.resolve(this.contents);
		}

		// layout(layoutFunc) {
		//
		//   this.iframe.style.display = "inline-block";
		//
		//   // Reset Body Styles
		//   // this.document.body.style.margin = "0";
		//   //this.document.body.style.display = "inline-block";
		//   //this.document.documentElement.style.width = "auto";
		//
		//   if(layoutFunc){
		//     this.layoutFunc = layoutFunc;
		//   }
		//
		//   this.contents.layout(this.layoutFunc);
		//
		// };
		//
		// onLayout(view) {
		//   // stub
		// };

	}, {
		key: "setLayout",
		value: function setLayout(layout) {
			this.layout = layout;
		}
	}, {
		key: "setAxis",
		value: function setAxis(axis) {
			this.settings.axis = axis;
		}
	}, {
		key: "resizeListenters",
		value: function resizeListenters() {
			// Test size again
			clearTimeout(this.expanding);
			this.expanding = setTimeout(this.expand.bind(this), 350);
		}
	}, {
		key: "addListeners",
		value: function addListeners() {
			//TODO: Add content listeners for expanding
		}
	}, {
		key: "removeListeners",
		value: function removeListeners(layoutFunc) {
			//TODO: remove content listeners for expanding
		}
	}, {
		key: "display",
		value: function display(request) {
			var displayed = new _core.defer();

			if (!this.displayed) {

				this.render(request).then(function () {

					this.emit("displayed", this);
					this.onDisplayed(this);

					this.displayed = true;
					displayed.resolve(this);
				}.bind(this));
			} else {
				displayed.resolve(this);
			}

			return displayed.promise;
		}
	}, {
		key: "show",
		value: function show() {

			this.element.style.visibility = "visible";

			if (this.iframe) {
				this.iframe.style.visibility = "visible";
			}

			this.emit("shown", this);
		}
	}, {
		key: "hide",
		value: function hide() {
			// this.iframe.style.display = "none";
			this.element.style.visibility = "hidden";
			this.iframe.style.visibility = "hidden";

			this.stopExpanding = true;
			this.emit("hidden", this);
		}
	}, {
		key: "position",
		value: function position() {
			return this.element.getBoundingClientRect();
		}
	}, {
		key: "locationOf",
		value: function locationOf(target) {
			var parentPos = this.iframe.getBoundingClientRect();
			var targetPos = this.contents.locationOf(target, this.settings.ignoreClass);

			return {
				"left": window.scrollX + parentPos.left + targetPos.left,
				"top": window.scrollY + parentPos.top + targetPos.top
			};
		}
	}, {
		key: "onDisplayed",
		value: function onDisplayed(view) {
			// Stub, override with a custom functions
		}
	}, {
		key: "onResize",
		value: function onResize(view, e) {
			// Stub, override with a custom functions
		}
	}, {
		key: "bounds",
		value: function bounds() {
			if (!this.elementBounds) {
				this.elementBounds = (0, _core.bounds)(this.element);
			}
			return this.elementBounds;
		}
	}, {
		key: "destroy",
		value: function destroy() {

			if (this.displayed) {
				this.displayed = false;

				this.removeListeners();

				this.stopExpanding = true;
				this.element.removeChild(this.iframe);
				this.displayed = false;
				this.iframe = null;

				this._textWidth = null;
				this._textHeight = null;
				this._width = null;
				this._height = null;
			}
			// this.element.style.height = "0px";
			// this.element.style.width = "0px";
		}
	}]);

	return IframeView;
}();

(0, _eventEmitter2.default)(IframeView.prototype);

exports.default = IframeView;
module.exports = exports["default"];