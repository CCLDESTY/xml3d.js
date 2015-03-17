if (window.XML3D !== undefined) {
    throw new Error("Tried to define the XML3D namespace a second time. Please ensure xml3d.js is only loaded once!");
}
/** @namespace * */
var XML3D = XML3D || {};
var Xflow = Xflow || {};
window.XML3D = XML3D;
window.Xflow = Xflow;

/** @define {string} */
XML3D.version = '%VERSION%';
/** @const */
XML3D.xml3dNS = 'http://www.xml3d.org/2009/xml3d';
/** @const */
XML3D.xhtmlNS = 'http://www.w3.org/1999/xhtml';
/** @const */
XML3D.webglNS = 'http://www.xml3d.org/2009/xml3d/webgl';
XML3D._xml3d = document.createElementNS(XML3D.xml3dNS, "xml3d");
XML3D._parallel = XML3D._parallel != undefined ? XML3D._parallel : false;
XML3D.xhtml = (!!document.xmlEncoding) ||
    (document.URL.match(/\.xhtml/i) !== null) ||
    (document.doctype && document.doctype.publicId && document.doctype.publicId.match(/\.xhtml/i) !== null);

XML3D.createElement = function(tagName) {
    return document.createElementNS(XML3D.xml3dNS, tagName);
};

XML3D.extend = function(a, b) {
    for ( var prop in b) {
        var g = b.__lookupGetter__(prop), s = b.__lookupSetter__(prop);
        if (g||s) {
            if (g) {
                a.__defineGetter__(prop, g);
            }
            if (s) {
                a.__defineSetter__(prop, s);
            }
        } else {
            if (b[prop] === undefined) {
                delete a[prop];
            } else if (prop !== "constructor" || a !== window) {
                a[prop] = b[prop];
            }
        }
    }
    return a;
};

/**
 * Returns true if ctor is a superclass of subclassCtor.
 * @param ctor
 * @param subclassCtor
 * @return {Boolean}
 */
XML3D.isSuperclassOf = function(ctor, subclassCtor) {
    while (subclassCtor && subclassCtor.superclass) {
        if (subclassCtor.superclass === ctor.prototype)
            return true;
        subclassCtor = subclassCtor.superclass.constructor;
    }
    return false;
};

/**
 *
 * @param {Object} ctor Constructor
 * @param {Object} parent Parent class
 * @param {Object=} methods Methods to add to the class
 * @return {Object!}
 */
XML3D.createClass = function(ctor, parent, methods) {
    methods = methods || {};
    if (parent) {
        /** @constructor */
        var F = function() {
        };
        F.prototype = parent.prototype;
        ctor.prototype = new F();
        ctor.prototype.constructor = ctor;
        ctor.superclass = parent.prototype;
    }
    ctor.isSuperclassOf = XML3D.isSuperclassOf.bind(ctor, ctor);
    for ( var m in methods) {
        ctor.prototype[m] = methods[m];
    }
    return ctor;
};

XML3D.debug = require("./utils/debug.js");
XML3D.util = require("./utils/misc.js");
XML3D.options = require("./utils/options.js");
XML3D.shaders = require("./renderer/webgl/materials/urn/shaders.js");
XML3D.resource = require("./base/resourcemanager.js").Resource; //Required for the test library because the RM needs to "belong" to the same document as the XML3D element in order to resolve references correctly
XML3D.webcl = require("./utils/webcl.js").webcl;
XML3D.math = require("gl-matrix");
XML3D.math.bbox = require("./math/bbox.js");
require("./math/math.js")(XML3D.math);

window.XML3DBox = require("./types/box.js");
XML3D.extend(window, require("./types/data-observer.js"));
window.XML3DMatrix = require("./types/matrix.js");
window.XML3DRay = require("./types/ray.js");
window.XML3DRotation = require("./types/rotation.js");
window.XML3DVec3 = require("./types/vec3.js");

Xflow.registerOperator = require("./xflow/operator/operator.js").registerOperator;
Xflow.PLATFORM = require("./xflow/interface/constants.js").PLATFORM;
require("./xflow/operator/default");

module.exports = {
    XML3D : XML3D,
    Xflow : Xflow
};