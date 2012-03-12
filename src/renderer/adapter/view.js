// Adapter for <view>
(function() {
    var XML3DViewRenderAdapter = function(factory, node) {
        xml3d.webgl.RenderAdapter.call(this, factory, node);
        this.zFar = 100000;
        this.zNear = 0.1;
        this.parentTransform = null;
        this.viewMatrix = null;
        this.projMatrix = null;
        this.updateViewMatrix();
    };
    xml3d.createClass(XML3DViewRenderAdapter, xml3d.webgl.RenderAdapter);
    var p = XML3DViewRenderAdapter.prototype;

    p.updateViewMatrix = function() {
            var pos = this.node.position._data;
            var orient = this.node.orientation;
            var v = mat4.rotate(mat4.translate(mat4.identity(mat4.create()), pos), orient.angle, orient.axis._data);

            var p = this.factory.getAdapter(this.node.parentNode);
            this.parentTransform = p.applyTransformMatrix(mat4.identity(mat4.create()));

            if (this.parentTransform) {
                v = mat4.multiply(this.parentTransform, v, mat4.create());
            }
            this.viewMatrix = mat4.inverse(v);
    };

    p.getProjectionMatrix = function(aspect) {
        if (this.projMatrix == null) {
            var fovy = this.node.fieldOfView;
            var zfar = this.zFar;
            var znear = this.zNear;
            var f = 1 / Math.tan(fovy / 2);
            this.projMatrix = mat4.create([ f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (znear + zfar) / (znear - zfar), -1, 0, 0,
                   2 * znear * zfar / (znear - zfar), 0 ]);
            
        }
        return this.projMatrix;
    };

    p.getModelViewMatrix = function(model) {
        return mat4.multiply(this.viewMatrix, model, mat4.create());
    };

    p.getNormalMatrix = function(modelViewMatrix) {
        return mat3.transpose(mat4.toInverseMat3(modelViewMatrix));
    };

    p.getModelViewProjectionMatrix = function(modelViewMatrix) {
        return mat4.multiply(this.projMatrix, modelViewMatrix, mat4.create());
    };

    p.notifyChanged = function(evt) {
    	var target = evt.internalType || evt.attrName || evt.wrapped.attrName;

        switch (target) {
        case "parenttransform":
        	this.parentTransform = evt.newValue;
            this.updateViewMatrix();
        break;
        
        case "orientation":
        case "position":
        	 this.updateViewMatrix();
        break;
        
        case "fieldOfView":
        	 this.projMatrix = null;
        break;
        
        default:
        	 xml3d.debug.logWarning("Unhandled event in view adapter for parameter " + target);
        break;
        }
 
        this.factory.handler.redraw("View changed");
    };

    // Export to xml3d.webgl namespace
    xml3d.webgl.XML3DViewRenderAdapter = XML3DViewRenderAdapter;

}());