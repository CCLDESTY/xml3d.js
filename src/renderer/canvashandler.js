// Create global symbol XML3D.webgl
XML3D.webgl.MAXFPS = 30;

/**
 * Creates the CanvasHandler.
 *
 * The Handler is the interface between the renderer, canvas and SpiderGL
 * elements. It responds to user interaction with the scene and manages
 * redrawing of the canvas.
 * The canvas handler also manages the rendering loop including triggering
 * of redraws.
 */
(function() {

    var canvas = document.createElement("canvas");
    XML3D.webgl.supported = function() {
        try {
            return !!(window.WebGLRenderingContext && (canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    };


    XML3D.webgl.configure = function(xml3ds) {
        var handlers = {};
        for(var i in xml3ds) {
            // Creates a HTML <canvas> using the style of the <xml3d> Element
            var canvas = XML3D.webgl.createCanvas(xml3ds[i], i);
            // Creates the CanvasHandler for the <canvas>  Element
            var canvasHandler = new XML3D.webgl.CanvasHandler(canvas, xml3ds[i]);
            handlers[i] = canvasHandler;
            canvasHandler._tick();
        }
    };

    /**
     * CanvasHandler class.
     * Own the GL context. Registers and handles the events that happen on the canvas element.
     * This includes context lost events.
     *
     * @param {HTMLCanvasElement} canvas
     *            the HTML Canvas element that this handler will be responsible
     *            for
     * @param xml3dElem
     *            the root xml3d node, containing the XML3D scene structure
     */
    function CanvasHandler(canvas, xml3dElem) {
        this.canvas = canvas;
        this.xml3dElem = xml3dElem;

        this.needDraw = true;
        this.needPickingDraw = true;
        this._pickingDisabled = false;
        /** @type {Drawable} */
        this.currentPickObj = null;
        this.lastPickObj = null;
        this.timeNow = Date.now() / 1000.0;

        // Register listeners on canvas
        this.registerCanvasListeners();

        // This function is called at regular intervals by requestAnimFrame to
        // determine if a redraw
        // is needed
        var handler = this;
        this._tick = function() {
            if (handler.update())
                handler.draw();

            window.requestAnimFrame(handler._tick, XML3D.webgl.MAXFPS);
        };

        this.redraw = function(reason, forcePickingRedraw) {
            forcePickingRedraw = forcePickingRedraw === undefined ? true : forcePickingRedraw;
            if (this.needDraw !== undefined) {
                this.needDraw = true;
                this.needPickingDraw = this.needPickingDraw || forcePickingRedraw;
            } else {
                // This is a callback from a texture, don't need to redraw the
                // picking buffers
                handler.needDraw = true;
            }
        };

        // Create Ressource Manager:
        this.resourceManager = new XML3D.webgl.ResourceManager();

        // Create renderer
        this.renderer = new XML3D.webgl.Renderer(this, canvas.clientWidth, canvas.clientHeight);
    }

    CanvasHandler.prototype.registerCanvasListeners = function() {
        var handler = this;
        var canvas = this.canvas;
        canvas.addEventListener("mousedown", function(e) {
            handler.mousedown(e);
        }, false);
        canvas.addEventListener("mouseup", function(e) {
            handler.mouseup(e);
        }, false);
        canvas.addEventListener("mousemove", function(e) {
            handler.mousemove(e);
        }, false);
        canvas.addEventListener("click", function(e) {
            handler.click(e);
        }, false);
        canvas.addEventListener("dblclick", function(e) {
            handler.click(e, true);
        }, false);
        canvas.addEventListener("mousewheel", function(e) {
            handler.mousewheel(e);
        }, false);
        canvas.addEventListener("DOMMouseScroll", function(e) {
            handler.mousewheel(e);
        }, false);
        canvas.addEventListener("mouseout", function(e) {
            handler.mouseout(e);
        }, false);
        canvas.addEventListener("drop", function(e) {
            handler.drop(e);
        }, false);
        canvas.addEventListener("dragover", function(e) {
            handler.dragover(e);
        }, false);

        // Block the right-click context menu on the canvas unless it's explicitly toggled
        var cm = this.xml3dElem.getAttribute("contextmenu");
        if (!cm || cm == "false") {
            this.canvas.addEventListener("contextmenu", function(e) {XML3D.webgl.stopEvent(e);}, false);
        }
    };



    // TODO: Connect resize listener with this function
    CanvasHandler.prototype.resize = function(gl, width, height) {
        if (width < 1 || height < 1)
            return false;

        this.renderer.resize(width, height);

        return true;
    };

    /**
     * Binds the picking buffer and passes the request for a picking pass to the
     * renderer
     *
     * @param {number} canvasX
     * @param {number} canvasY
     * @return {Drawable|null} newly picked object
     */
    CanvasHandler.prototype.updatePickObjectByPoint = function(canvasX, canvasY) {
        if (this._pickingDisabled)
            return null;
        if(this.needPickingDraw)
            this.renderer.renderSceneToPickingBuffer();
        this.currentPickObj = this.renderer.getDrawableFromPickingBuffer(canvasX, this.canvas.height - canvasY);
        this.needPickingDraw = false;
        return this.currentPickObj;
    };

    /**
     * @param {Object} pickedObj
     * @param {number} canvasX
     * @param {number} canvasY
     * @return {vec3|null} The world space normal on the object's surface at the given coordinates
     */
    CanvasHandler.prototype.getWorldSpaceNormalByPoint = function(pickedObj, canvasX, canvasY) {
        if (!pickedObj || this._pickingDisabled)
            return null;
        this.renderer.renderPickedNormals(pickedObj, canvasX, this.canvas.height - canvasY);
        return this.renderer.readNormalFromPickingBuffer(canvasX, this.canvas.height - canvasY);
    };

    /**
     * @param {Object} pickedObj
     * @param {number} canvasX
     * @param {number} canvasY
     * @return {vec3|null} The world space position on the object's surface at the given coordinates
     */
    CanvasHandler.prototype.getWorldSpacePositionByPoint = function(pickedObj, canvasX, canvasY) {
    	if (!pickedObj)
    		return null;
        this.renderer.renderPickedPosition(pickedObj);
        return this.renderer.readPositionFromPickingBuffer(canvasX, this.canvas.height - canvasY);
    };

    /**
     * Uses gluUnProject() to transform the 2D screen point to a 3D ray.
     * Not tested!!
     *
     * @param {number} glX
     * @param {number} glY
     */
    CanvasHandler.prototype.generateRay = function(glX, glY) {

        // setup input to unproject
        var viewport = new Array();
        viewport[0] = 0;
        viewport[1] = 0;
        viewport[2] = this.renderer.width;
        viewport[3] = this.renderer.height;

        // get view and projection matrix arrays
        var viewMat = this.renderer.camera.viewMatrix;
        var projMat = this.renderer.camera.getProjectionMatrix(viewport[2] / viewport[3]);

        var ray = new window.XML3DRay();

        var nearHit = new Array();
        var farHit = new Array();

        // do unprojections
        if (false === GLU.unProject(glX, glY, 0, viewMat, projMat, viewport, nearHit)) {
            return ray;
        }

        if (false === GLU.unProject(glX, glY, 1, viewMat, projMat, viewport, farHit)) {
            return ray;
        }

        // calculate ray

        ray.origin = this.renderer.currentView.position;
        ray.direction = new window.XML3DVec3(farHit[0] - nearHit[0], farHit[1] - nearHit[1], farHit[2] - nearHit[2]);
        ray.direction = ray.direction.normalize();

        return ray;
    };

    // This function is called by _tick() at regular intervals to determine if a
    // redraw of the scene is required
    CanvasHandler.prototype.update = function() {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('update', true, true, null);
        this.xml3dElem.dispatchEvent(event);

        return this.needDraw;
    };

    /**
     * Called by _tick() to redraw the scene if needed
     */
    CanvasHandler.prototype.draw = function() {
        try {

            var start = Date.now();
            var stats = this.renderer.render();
            var end = Date.now();

            this.needDraw = false;
            this.dispatchFrameDrawnEvent(start, end, stats);

        } catch (e) {
            XML3D.debug.logException(e);
            throw e;
        }

    };

    /**
     * Initalizes an DOM MouseEvent, picks the scene and sends the event to the
     * hit object, if one was hit.
     *
     * It dispatches it on two ways: calling dispatchEvent() on the target
     * element and going through the tree up to the root xml3d element invoking
     * all on[type] attribute code.
     *
     * @param type
     *            the type string according to the W3 DOM MouseEvent
     * @param button
     *            which mouse button is pressed, if any
     * @param x
     *            the screen x-coordinate
     * @param y
     *            the screen y-coordinate
     * @param event
     *            the W3 DOM MouseEvent, if present (currently not when
     *            SpiderGL's blur event occurs)
     * @param target
     *            the element to which the event is to be dispatched. If
     *            this is not given, the currentPickObj will be taken or the
     *            xml3d element, if no hit occured.
     *
     */
    CanvasHandler.prototype.dispatchMouseEvent = function(type, button, x, y, event, target) {
        // init event
        if (event === null || event === undefined) {
            event = document.createEvent("MouseEvents");
            event.initMouseEvent(type,
            // canBubble, cancelable, view, detail
            true, true, window, 0,
            // screenX, screenY, clientX, clientY
            0, 0, x, y,
            // ctrl, alt, shift, meta, button
            false, false, false, false, button,
            // relatedTarget
            null);
        }

        // Copy event to avoid DOM dispatch errors (cannot dispatch event more
        // than once)
        var evt = this.copyMouseEvent(event);
        this.initExtendedMouseEvent(evt, x, y);

        // find event target
        var tar = null;
        if (target !== undefined && target !== null)
            tar = target;
        else if (this.currentPickObj)
            tar = this.currentPickObj.meshNode;
        else
            tar = this.xml3dElem;

        tar.dispatchEvent(evt);
    };

    /**
     * Creates an DOM mouse event based on the given event and returns it
     *
     * @param event
     *            the event to copy
     * @return the new event
     */
    CanvasHandler.prototype.copyMouseEvent = function(event) {
        var evt = document.createEvent("MouseEvents");
        evt.initMouseEvent(event.type,
        // canBubble, cancelable, view, detail
        event.bubbles, event.cancelable, event.view, event.detail,
        // screenX, screenY, clientX, clientY
        event.screenX, event.screenY, event.clientX, event.clientY,
        // ctrl, alt, shift, meta, button
        event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, event.button,
        // relatedTarget
        event.relatedTarget);
        if (event.dataTransfer)
        	evt.data = {url: event.dataTransfer.getData("URL"), text: event.dataTransfer.getData("Text")};
        return evt;
    };

    /**
     * Adds position and normal attributes to the given event.
     *
     * @param {Event} event
     * @param {number} x
     * @param {number} y
     * @return {XML3DVec3}
     */
    CanvasHandler.prototype.initExtendedMouseEvent = function(event, x, y) {

        var handler = this;
        var xml3dElem = this.xml3dElem;

        (function(){
            var cachedPosition = undefined;
            var cachedNormal = undefined;

            event.__defineGetter__("normal", function(){
                if(cachedNormal !== undefined) return cachedNormal;
                var norm = (handler.getWorldSpaceNormalByPoint(handler.currentPickObj, x, y));
                cachedNormal = norm ? new window.XML3DVec3(norm[0], norm[1], norm[2]) : null;
                return cachedNormal;
            });
            event.__defineGetter__("position", function() {
                if (!cachedPosition) {
                    var pos = handler.getWorldSpacePositionByPoint(handler.currentPickObj, x, y);
                    cachedPosition = pos ? new window.XML3DVec3(pos[0], pos[1], pos[2]) : null;
                }
                return cachedPosition;
            });

        })();


    };


    /**
     *
     * @param evt
     */
    CanvasHandler.prototype.drop = function(evt) {
        var pos = this.getMousePosition(evt);

        this.updatePickObjectByPoint(pos.x, pos.y);
        this.dispatchMouseEvent("drop", evt.button, pos.x, pos.y, evt);
        evt.preventDefault();
    };

    /**
     *
     * @param evt
     */
    CanvasHandler.prototype.dragover = function(evt) {
    	evt.preventDefault();
    };

    /**
     * This method is called each time a 'mouseup' event is triggered on the
     * canvas
     *
     * @param {MouseEvent} evt
     */
    CanvasHandler.prototype.mouseup = function(evt) {
        var pos = this.getMousePosition(evt);

        this.updatePickObjectByPoint(pos.x, pos.y);
        this.dispatchMouseEvent("mouseup", evt.button, pos.x, pos.y, evt);
    };

    /**
     * This method is called each time a 'mousedown' event is triggered on the
     * canvas
     *
     * @param {MouseEvent} evt
     */
    CanvasHandler.prototype.mousedown = function(evt) {
        var pos = this.getMousePosition(evt);
        this.updatePickObjectByPoint(pos.x, pos.y);

        this.dispatchMouseEvent("mousedown", evt.button, pos.x, pos.y, evt);
    };

    /**
     * This method is called each time a click event is triggered on the canvas
     *
     * @param {MouseEvent} evt
     * @param {boolean} isdbl
     */
    CanvasHandler.prototype.click = function(evt, isdbl) {
        var pos = this.getMousePosition(evt);
        // Click follows always 'mouseup' => no update of pick object needed
        if (isdbl == true)
            this.dispatchMouseEvent("dblclick", evt.button, pos.x, pos.y, evt);
        else
            this.dispatchMouseEvent("click", evt.button, pos.x, pos.y, evt);
    };

    /**
     * This method is called each time a mouseMove event is triggered on the
     * canvas.
     *
     * This method also triggers mouseover and mouseout events of objects in the
     * scene.
     *
     * @param {MouseEvent} evt
     */
    CanvasHandler.prototype.mousemove = function(evt) {
        var pos = this.getMousePosition(evt);

        this.updatePickObjectByPoint(pos.x, pos.y);
        this.dispatchMouseEvent("mousemove", 0, pos.x, pos.y, evt);

        var curObj = this.currentPickObj ? this.currentPickObj.meshNode : null;

        // trigger mouseover and mouseout
        if (curObj !== this.lastPickObj) {
            if (this.lastPickObj) {
                // The mouse has left the last object
                this.dispatchMouseEvent("mouseout", 0, pos.x, pos.y, null, this.lastPickObj);
            }
            if (curObj) {
                // The mouse is now over a different object, so call the new
                // object's mouseover method
                this.dispatchMouseEvent("mouseover", 0, pos.x, pos.y);
            }

            this.lastPickObj = curObj;
        }
    };

    /**
     * This method is called each time the mouse leaves the canvas
     *
     * @param {MouseEvent} evt
     */
    CanvasHandler.prototype.mouseout = function(evt) {
        var pos = this.getMousePosition(evt);
        this.dispatchMouseEvent("mouseout", 0, pos.x, pos.y, null, this.lastPickObj);
    };

    /**
     * This method is called each time the mouse leaves the canvas
     *
     * @param {MouseEvent} evt
     */
    CanvasHandler.prototype.mousewheel = function(evt) {
        var pos = this.getMousePosition(evt);
        // note: mousewheel type is not W3C standard, used in WebKit!
        this.dispatchMouseEvent("mousewheel", 0, pos.x, pos.y, evt, this.xml3dElem);
    };

    /**
     * Dispatches a FrameDrawnEvent to listeners
     *
     * @param start
     * @param end
     * @param numObjDrawn
     * @return
     */
    CanvasHandler.prototype.dispatchFrameDrawnEvent = function(start, end, stats) {
        var event = document.createEvent('CustomEvent');
        var data = {
                timeStart : start,
                timeEnd : end,
                renderTimeInMilliseconds : end - start,
                numberOfObjectsDrawn : stats[0],
                numberOfTrianglesDrawn : Math.floor(stats[1])
        };
        event.initCustomEvent('framedrawn', true, true, data);

        this.xml3dElem.dispatchEvent(event);
    };

    // Destroys the renderer associated with this Handler
    CanvasHandler.prototype.shutdown = function(scene) {
        if (this.renderer) {
            this.renderer.dispose();
        }
    };

    CanvasHandler.prototype.getMousePosition = function(evt) {
        var rct = this.canvas.getBoundingClientRect();
        return {
            x : (evt.clientX - rct.left),
            y : (evt.clientY - rct.top)
        };
    };

    CanvasHandler.prototype.setMouseMovePicking = function(isEnabled) {
    };

    XML3D.webgl.CanvasHandler = CanvasHandler;
})();

XML3D.webgl.createCanvas = function(xml3dElement, index) {

    var parent = xml3dElement.parentNode;
    // Place xml3dElement inside an invisble div
    var hideDiv = parent.ownerDocument.createElement('div');
    hideDiv.style.display = "none";
    parent.insertBefore(hideDiv, xml3dElement);
    hideDiv.appendChild(xml3dElement);

    // Create canvas and append it where the xml3d element was before
    var canvas = xml3dElement._configured.canvas;
    parent.insertBefore(canvas, hideDiv);

    var style = canvas.ownerDocument.defaultView.getComputedStyle(xml3dElement);
    if (!canvas.style.backgroundColor) {
        var bgcolor = style.getPropertyValue("background-color");
        if (bgcolor && bgcolor != "transparent")
            canvas.style.backgroundColor = bgcolor;
    }
    // Need to be set for correct canvas size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    return canvas;
};


XML3D.webgl.stopEvent = function(ev) {
    if (ev.preventDefault)
        ev.preventDefault();
    if (ev.stopPropagation)
        ev.stopPropagation();
    ev.returnValue = false;
};
