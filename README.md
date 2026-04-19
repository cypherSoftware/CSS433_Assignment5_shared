Template code for A05
------------

Author: Your name [youremail@email.arizona.edu]
Date: April 17, 2026

**PLEASE UPDATE THIS README**

For mirror, you need to render the scene with a fake camera on the other side of the mirror.
The fake camera should render the obj file and billboard but not the mirror.
The output of the fake camera should go on a texture. To render into a texture you need to first prepare the texture.
When you are programming your shader for mirror, you need to create texture and framebuffer:

```
	// Create a texture to render to
	var mirrorTextureBuffer = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, mirrorTextureBuffer);
	let targetTextureWidth = 512;// The quality of texture in the mirror
	let targetTextureHeight = 512;// The quality of texture in the mirror
	let level = 0;
	let internalFormat = gl.RGBA;
	let border = 0;
	let format = gl.RGBA;
	let type = gl.UNSIGNED_BYTE;
	let data = null;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  targetTextureWidth, targetTextureHeight, border,
                  format, type, data);
	
	// set the filtering so we don't need mips
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
	// Create and bind the framebuffer
	var mirrorFrameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, mirrorFrameBuffer);

	// attach the texture as the first color attachment
	let attachmentPoint = gl.COLOR_ATTACHMENT0;
	level = 0;
	gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, mirrorTextureBuffer, level);
```
Then in your rendering loop, you need to first draw obj and billboard from your fake camera. You can switch the rending output to the texture:

```
	// render to our targetTexture by binding the framebuffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, currentScene.mirror.mirrorFrameBuffer);
```
To bind the rendering output back to the canvas you need the following command:
```
	// Return to rendering on the canvas
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
```
After you rendered the fake camera output into a texture, now you need to draw the obj, billboard, and mirror (a billboard with special texture) from the original camera.
OpenGL can use bind different textures to different texture channels by:
```
gl.activeTexture(gl.TEXTURE1);
```
In this case you don't need to bind a new texture to the dedault gl.TEXTURE0 multiple times. You can tell GPU which texture to be used by texture uniform by the following command which the number is the index of the texture:
```
	// Tell the shader to use texture unit 1 for u_texture
    gl.uniform1i(billboardProgram.textureUniformLocation, 1);
```

Included files (**PLEASE ADD/UPDATE THIS LIST**):
* materials/ -- a folder with obj file, one texture, and one scene
* a05.js -- the main rendering codes
* m4.js -- the JS file which contains math functions for 4x4 matrices. The output matrices are by default Float32Array
* OBJFile.js -- the parser for OBJ files
* webgl-utils.js -- the file containing utilities for making shader program and sending data to GPU


PLEASE PROVIDE ANY ATTRIBUTION HERE**
* First Obj parser: https://webglfundamentals.org/
* Second Obj parser: https://github.com/WesUnwin/obj-file-parser
* The library for decoding PNG files is from: https://github.com/arian/pngjs
* webgl-utils.js is from: GFXFundamentals
* The example obj files are from Blender and 3DsMax softwares
