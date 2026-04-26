/*
 This file is a template for a05 CS433/533
 
 Author: Amir Mohammad Esmaieeli Sikaroudi
 Email: amesmaieeli@email.arizona.edu
 Date: March, 2022
 
 Sources uses for this template:
 First Obj parser:
 https://webglfundamentals.org/
 Second Obj parser:
 https://github.com/WesUnwin/obj-file-parser
 The library for decoding PNG files is from:
 https://github.com/arian/pngjs
*/

var input = document.getElementById("load_scene");
input.addEventListener("change", readScene);
var dummy_canvas = document.getElementById('dummy_canvas');
var ctx = dummy_canvas.getContext('2d');

var renderingCanvas = document.querySelector("#canvas");
var gl = renderingCanvas.getContext("webgl",{preserveDrawingBuffer: true});

var modelMatrix;

var currentScene;//Current rendering scene

var doneLoading=false;//Checks if the scene is done loading to prevent renderer draw premuturly.
var doneProgramming=false;
var filesToRead=[];//List of files to be read
var imageData;//The image contents are stored separately here
var scene;//The code can save multiple scenes but no HTML element is made to give user option of switching scenes without selecting file agail. By default the firt scene is shown and the other selected scenes are just stored.
var objParsed;

var billboardProgram;
var objProgram;
var mirrorProgram;
var phongExp=5;

var camX = document.getElementById("camXID");
var camY = document.getElementById("camYID");
var camZ = document.getElementById("camZID");

var objX = document.getElementById('objXID');//Slider for obj position
var objY = document.getElementById('objYID');//Slider for obj position
var objZ = document.getElementById('objZID');//Slider for obj position

var pexp = document.getElementById('pexpID');//Slider for phong
var isShowDepth = document.getElementById('isDepthBuffer');//checkbox for depth

var modelRotationRadians = degToRad(0);
var previousFrameTime = 0;

camX.addEventListener("input", function(evt) {
	if(doneLoading && currentScene){
		currentScene.camera.position.x=Number(camX.value);
		var camXLabel = document.getElementById("camXLabelID");
		camXLabel.innerHTML = camX.value;
		camX.label = "Cam X: "+camX.value;//refresh camX text
	}
},false);

camY.addEventListener("input", function(evt) {
	if(doneLoading && currentScene){
		currentScene.camera.position.y=Number(camY.value);
		var camYLabel = document.getElementById("camYLabelID");
		camYLabel.innerHTML = camY.value;
		camY.label = "Cam Y: "+camY.value;//refresh camY text
	}
},false);

camZ.addEventListener("input", function(evt) {
	if(doneLoading && currentScene){
		currentScene.camera.position.z=Number(camZ.value);
		var camZLabel = document.getElementById("camZLabelID");
		camZLabel.innerHTML = camZ.value;
		camZ.label = "Cam Z: "+camZ.value;//refresh camZ text
	}
},false);

objX.addEventListener("input", function(evt) {
	if(doneLoading && currentScene){
		console.log("objX[0]: " + currentScene.obj.position[0]);
		currentScene.obj.position[0] = Number(objX.value);
		console.log("objX[0]: " + currentScene.obj.position[0]);
		var objXLabel = document.getElementById("objXLabelID");
		objXLabel.innerHTML = objX.value;
		objX.label = "Obj X: "+objX.value;//refresh objX text
	}
},false);

objY.addEventListener("input", function(evt) {
	if(doneLoading && currentScene){
		currentScene.obj.position[1] = Number(objY.value);
		var objYLabel = document.getElementById("objYLabelID");
		objYLabel.innerHTML = objY.value;
		objY.label = "Obj Y: "+objY.value;//refresh objY text
	}
},false);

objZ.addEventListener("input", function(evt) {
	if(doneLoading && currentScene){
		currentScene.obj.position[2] = Number(objZ.value);
		var objZLabel = document.getElementById("objZLabelID");
		objZLabel.innerHTML = objZ.value;
		objZ.label = "Obj Y: "+objZ.value;//refresh objZ text
	}
},false);

pexp.addEventListener("input", function(evt){
	if(doneLoading==true){
		phongExp=Number(pexp.value);
		var phongLabel = document.getElementById("pexpLabelID");
		phongLabel.innerHTML = pexp.value;
		pexp.label = "Phong exponent: "+pexp.value;
	}
},false);



function readScene()//This is the function that is called after user selects multiple files of images and scenes
{
	if (input.files.length > 0) {
		if(doneLoading==true)//This condition checks if this is the first time user has selected a scene or not. If doneLoading==true, then the user has selected a new scene while rendering
		{
			newSceneRequested=true;
			filesToRead=[];//List of files to be read
			imageData=[];//The image contents are stored separately here
			objsData=[];
			scenes=[];//List of scenes
		}
		doneLoading=false;
		for(var i=0;i<input.files.length;i++)
		{
			var file = input.files[i];
			var reader = new FileReader();
			filesToRead[i]=true;
			reader.onload = (function(f,index) {
				return function(e) {
					//Get the file name
					let fileName = f.name;
					//Get the file Extension 
					let fileExtension = fileName.split('.').pop();
					if(fileExtension=='ppm')
					{
						var file_data = this.result;
						let img=parsePPM(file_data,fileName);//Parse image
						imageData.push(img);
						filesToRead[index]=false;
					}else if(fileExtension=='js')
					{
						var file_data = this.result;
						scene=parseScene(file_data);//Parse scene
						filesToRead[index]=false;
							//Verify adding Mirror parsing code worked
							console.log("Onlybillboard:", scene.billboard);
							console.log("Onlymirror:", scene.mirror);
					}else if(fileExtension=='json')
					{
						var file_data = this.result;
						scene=parseScene(file_data);//Parse scene
						filesToRead[index]=false;
					}else if(fileExtension=='obj')
					{
						var file_data = this.result;
						objParsed=parseOBJ(file_data);//Parse obj to almost buffer-ready Float32Array arrays.
						//Todo: For gouraud shading you may need to edit the normals of the object.
						//For your convenience another parser is provided. In this parser more details are stored.
						//You are free to use your own parser or any of the provided parsers.
						const objFile = new OBJFile(file_data);
						const output = objFile.parse();
						
						//Todo: You may call a function to calculate new normal for each vertex.
						
						filesToRead[index]=false;
					}else if(fileExtension=='png')
					{
						var file_data = this.result;
						
						var pngImage = new PNGReader(file_data);
						
						pngImage.parse(function(err, png){
							if (err) throw err;
							
							let img = parsePNG(png,fileName);
							
							let width=img.width;
							let height=img.height;
							document.getElementById("dummy_canvas").setAttribute("width", img.width);
							document.getElementById("dummy_canvas").setAttribute("height", img.height);
							let showCaseData = ctx.createImageData(width, height);
							for(var i = 0; i < img.data.length; i+=1){
								showCaseData.data[i*4]=img.data[i].r;
								showCaseData.data[i*4+1]=img.data[i].g;
								showCaseData.data[i*4+2]=img.data[i].b;
								showCaseData.data[i*4+3]=img.data[i].a;
							}
							ctx.putImageData(showCaseData, dummy_canvas.width/2 - width/2, dummy_canvas.height/2 - height/2);
							
							let imageRead=ctx.getImageData(0, 0, dummy_canvas.width, dummy_canvas.height);
							imageData=imageRead;
							filesToRead[index]=false;
						});
					}
				};
			})(file,i);
			let fileName = file.name;
			let fileExtension = fileName.split('.').pop();
			if(fileExtension=='ppm' || fileExtension=='js' || fileExtension=='json' || fileExtension=='obj')
			{
				reader.readAsBinaryString(file);
			}else if(fileExtension=='png'){
				reader.readAsArrayBuffer(file);
			}
			
		}
		
		drawScene();//Enter the drawing loop();
	}
}

// Draw the scene.
function drawScene() {
	if(doneLoading==false)
	{
		var isReaminingRead=false;
		for(let j=0;j<filesToRead.length;j++)
		{
			if(filesToRead[j]==true)//Check if each file is read
			{
				isReaminingRead=true;//If one is not read, then make sure drawing scene will wait for files to be read
			}
		}
		if(isReaminingRead==false)//If all files are read
		{
			currentScene=scene;
			currentScene.billboard.img=imageData;
			
			doneLoading=true;
		}
	}else if(doneLoading==true)//If scene is completely read
	{
		if(doneProgramming==false){
			programAll();
			preprocessBuffers();
			doneProgramming=true;
			
			// Support for Alpha
			gl.enable(gl.BLEND)
			gl.colorMask(true, true, true, true);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		}else{
			renderingFcn();
		}
	}
	
	// Call drawScene again next frame with delay to give user chance of interacting GUI
	setTimeout(function() { requestAnimationFrame(drawScene)}, 500);
}

// function renderingFcn(){
// 	gl.clearColor(currentScene.camera.DefaulColor[0], currentScene.camera.DefaulColor[1], currentScene.camera.DefaulColor[2], 1.0);
// 	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
// 	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
// 	webglUtils.resizeCanvasToDisplaySize(gl.canvas);
// 	renderObj();
// 	renderBillboard();

// }

//Acposey Note: Break up rendering function into two passes one to get reflection with seperate camera then second is real pass with grabbed texture
function renderingFcn(){
	//renderMainPass();
	renderReflectionPass();
	renderMainPass();
}

function renderReflectionPass(){
	if(!currentScene.mirror || !currentScene.mirror.framebuffer){
		return;
	}

	// Render into the mirror framebuffer
	gl.bindFramebuffer(
		gl.FRAMEBUFFER,
		currentScene.mirror.framebuffer
	);

	// The mirror texture is 512x512 or whatever size is created.
	// So the viewport should match the texture, not the canvas.
	var renderTargetWidth = currentScene.mirror.renderTargetWidth;
	var renderTargetHeight = currentScene.mirror.renderTargetHeight;

	gl.viewport(
		0,
		0,
		renderTargetWidth,
		renderTargetHeight
	);

	// Debug clear color suggested in assignment.
	// Blue means: this came from the reflection pass.
	gl.clearColor(0.66, .67, .68, 1.0);

	gl.clear(
		gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT
	);

	// Aposey Note: TEMPORARY:
	// For now, use the real camera.
	// Later this will be replaced with the reflected fake camera.
	//Romero Note: Added function call to compute "fake" camera (called refleciton camera)
	var reflectionCamera = computeReflectionCamera(currentScene.camera, currentScene.mirror);

	// Render the scene into the mirror texture.
	// Important: do NOT render the mirror here,
	// or the mirror will try to reflect itself.
	renderObjWithCamera(reflectionCamera);
	renderBillboardWithCamera(reflectionCamera);

	// Return to the normal/default framebuffer.
	// This means future rendering goes to the screen again.
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
/*
	Name: computeReflectionCamera()
	Purpose: take a "real" camera and mirror billboard position and compute the plane and points 
	to map the reflection texture to.
	Arguments: camera - the scene Camera
			   mirror - the billboard that represents the Mirror
	Return: a new instance of camera class that represent the "fake" camera
*/
function computeReflectionCamera(camera, mirror){
	let eye = camera.position;
	let target = camera.target;
	let up = camera.up;
	
	//build normal
	let v = Vector3.minusTwoVectors(mirror.UpperLeft, mirror.LowerLeft);
	let u = Vector3.minusTwoVectors(mirror.LowerRight, mirror.LowerLeft);
	let normal = Vector3.normalizeVector(Vector3.crossProduct(u,v));
	
	//plane = n * P + d = 0
	let d = -Vector3.dotProduct(normal, mirror.LowerLeft);
	
	//compute reflection points -- used to translate new eye and target
	function reflectPoint(p){
		let dist = Vector3.dotProduct(normal, p) + d;
		let scaled = Vector3.multiplyVectorScalar(normal, 2 * dist);
		return Vector3.minusTwoVectors(p, scaled);
	}
	
	let newEye = reflectPoint(eye)
	let newTarget = reflectPoint(target)
	
	return new Camera(
		newEye,
		newTarget,
		up,
		camera.fov,
		camera.far,
		camera.near,
		camera.DefaulColor
	)
}

function renderMainPass(){
	// Render to the actual canvas
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	webglUtils.resizeCanvasToDisplaySize(gl.canvas);

	gl.viewport(
		0,
		0,
		gl.canvas.width,
		gl.canvas.height
	);

	// Use the scene's normal background color.
	gl.clearColor(
		currentScene.camera.DefaulColor[0],
		currentScene.camera.DefaulColor[1],
		currentScene.camera.DefaulColor[2],
		1.0
	);

	gl.clear(
		gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT
	);

	// Render normal scene from the real camera.
	renderObjWithCamera(currentScene.camera);
	renderBillboardWithCamera(currentScene.camera);

	// Render the mirror last-ish, using the texture created in renderReflectionPass().
	renderMirror();
}


function renderBillboardWithCamera(camera){
	gl.disable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);

	// Tell it to use our program (pair of shaders)
	gl.useProgram(billboardProgram.program);

	// Turn on the Position attribute
	gl.enableVertexAttribArray(billboardProgram.positionLocationAttrib);
	
	// Bind the position buffer.
	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.billboard.positionBuffer);

	// Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
	var size = 3;          // 3 components per iteration
	var type = gl.FLOAT;   // the data is 32bit floats
	var normalize = false; // don't normalize the data
	var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
	var offset = 0;        // start at the beginning of the buffer

	gl.vertexAttribPointer(
		billboardProgram.positionLocationAttrib, size, type, normalize, stride, offset);

	// Turn on the Normal attribute
	gl.enableVertexAttribArray(billboardProgram.normalLocationAttrib);
	
	//Bind the normal buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.billboard.normalBuffer);

	// Tell the normal attribute how to get data out of normalBuffer
	var normalSize = 3;          // 3 components per iteration
	var normalType = gl.FLOAT;   //the data is 32bit floats
	var normalNormalize = false; //don't normalize the data
	var normalStride = 0;		 //0 = move forward size * sizeof(type) each iteration
	var normalOffset = 0;        //start at the begininng of the buffer

	gl.vertexAttribPointer(
		billboardProgram.normalLocationAttrib, normalSize, normalType, normalNormalize, normalStride, normalOffset);

	// Turn on Texture attribute
	gl.enableVertexAttribArray(billboardProgram.textureLocationAttrib);
	
	//bind the texture buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.billboard.textureBuffer);

	// Tell the texture coordinate attribute how to get data out of textureBuffer
	var texcoordSize = 2;          // u, v
	var texcoordType = gl.FLOAT;
	var texcoordNormalize = false;
	var texcoordStride = 0;
	var texcoordOffset = 0;

	gl.vertexAttribPointer(
		billboardProgram.textureLocationAttrib, texcoordSize, texcoordType, texcoordNormalize, texcoordStride, texcoordOffset);

	// Camera / projection setup
	var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

	var projectionMatrix = m4.perspective(degToRad(camera.fov), aspect, camera.near, camera.far);

	var cameraPosition = [
		camera.position.x,
		camera.position.y,
		camera.position.z
	];

	var cameraTarget = [
		camera.target.x,
		camera.target.y,
		camera.target.z
	];

	var cameraUp = [
		camera.up.x,
		camera.up.y,
		camera.up.z
	];

	var cameraMatrix = m4.lookAt(
		cameraPosition,
		cameraTarget,
		cameraUp
	);

	var viewMatrix = m4.inverse(cameraMatrix);
	var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

	gl.uniformMatrix4fv(
		billboardProgram.worldViewProjectionUniformLocation,
		false,
		viewProjectionMatrix
	);

	// Light setup
	var lightDirection = new Float32Array([
		currentScene.light.locationPoint.x,
		currentScene.light.locationPoint.y,
		currentScene.light.locationPoint.z
	]);

	gl.uniform3fv(
		billboardProgram.lightDirectionUniformLocation,
		lightDirection
	);

	// Texture setup
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, currentScene.billboard.billboardTextureBuffer);
	gl.uniform1i(billboardProgram.textureUniformLocation, 0);

	// Other uniforms
	var phongExponent = document.getElementById("pexpID").value;
	/*
	gl.uniform1f(
		billboardProgram.phongExponentLocationUniform,
		phongExponent
	);

	var showDepthBuffer = document.getElementById("depthBuffer").checked;

	if(showDepthBuffer){
		gl.uniform1i(billboardProgram.isDepthBuffer, 1);
	}else{
		gl.uniform1i(billboardProgram.isDepthBuffer, 0);
	}
	*/
	// Draw the billboard: 2 triangles, 6 vertices total
	gl.drawArrays(gl.TRIANGLES, 0, 6);
}
function renderMirror(){
	gl.disable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);

	gl.useProgram(billboardProgram.program);

	// Position attribute
	gl.enableVertexAttribArray(billboardProgram.positionLocationAttrib);

	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.mirror.positionBuffer);

	// Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
	var size = 3;          // 3 components per iteration:
	var type = gl.FLOAT;   // the data is 32bit floats
	var normalize = false; // don't normalize the data
	var stride = 0;        // 0 = move forward size * sizeof(type) each iteration
	var offset = 0;        // start at the beginning of the buffer

	gl.vertexAttribPointer(
		billboardProgram.positionLocationAttrib,
		size,
		type,
		normalize,
		stride,
		offset
	);

	// turn on Normal attribute
	gl.enableVertexAttribArray(billboardProgram.normalLocationAttrib);

	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.mirror.normalBuffer);

	var normalSize = 3;
	var normalType = gl.FLOAT;
	var normalNormalize = false;
	var normalStride = 0;
	var normalOffset = 0;

	gl.vertexAttribPointer(
		billboardProgram.normalLocationAttrib,
		normalSize,
		normalType,
		normalNormalize,
		normalStride,
		normalOffset
	);

	// Turn on Texture coordinate attribute
	gl.enableVertexAttribArray(billboardProgram.textureLocationAttrib);

	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.mirror.textureBuffer);

	var texcoordSize = 2;
	var texcoordType = gl.FLOAT;
	var texcoordNormalize = false;
	var texcoordStride = 0;
	var texcoordOffset = 0;

	gl.vertexAttribPointer(
		billboardProgram.textureLocationAttrib,
		texcoordSize,
		texcoordType,
		texcoordNormalize,
		texcoordStride,
		texcoordOffset
	);

	// Use the real camera to draw the mirror surface
	var camera = currentScene.camera;

	var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

	var projectionMatrix = m4.perspective(
		degToRad(camera.fov),
		aspect,
		camera.near,
		camera.far
	);

	var cameraPosition = [
		camera.position.x,
		camera.position.y,
		camera.position.z
	];

	var cameraTarget = [
		camera.target.x,
		camera.target.y,
		camera.target.z
	];

	var cameraUp = [
		camera.up.x,
		camera.up.y,
		camera.up.z
	];

	var cameraMatrix = m4.lookAt(
		cameraPosition,
		cameraTarget,
		cameraUp
	);

	var viewMatrix = m4.inverse(cameraMatrix);
	var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

	gl.uniformMatrix4fv(
		billboardProgram.worldViewProjectionUniformLocation,
		false,
		viewProjectionMatrix
	);

	// Light setup
	var lightDirection = new Float32Array([
		currentScene.light.locationPoint.x,
		currentScene.light.locationPoint.y,
		currentScene.light.locationPoint.z
	]);

	gl.uniform3fv(
		billboardProgram.lightDirectionUniformLocation,
		lightDirection
	);

	// Use the reflection texture instead of a PNG
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, currentScene.mirror.renderTexture);
	gl.uniform1i(billboardProgram.textureUniformLocation, 0);

	var phongExponent = document.getElementById("pexpID").value;
	/*
	gl.uniform1f(
		billboardProgram.phongExponentLocationUniform,
		phongExponent
	);
	*/
	var showDepthBuffer = document.getElementById("isDepthBuffer").checked;
	/*
	if(showDepthBuffer){
		gl.uniform1i(billboardProgram.isDepthBuffer, 1);
	}else{
		gl.uniform1i(billboardProgram.isDepthBuffer, 0);
	}
	*/
	// Draw the mirror: 2 triangles, 6 vertices total
	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderObjWithCamera(camera){
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);
	/*
	// Convert to seconds
    now *= 0.001;
    // Subtract the previous time from the current time
    var deltaTime = now - previousFrameTime;
    // Remember the current time for the next frame.
    previousFrameTime = now;
	
	// Model rotation angle
	modelRotationRadians += 2.1 * deltaTime;
	*/
	gl.useProgram(objProgram.program);

	// Turn on Position attribute
	gl.enableVertexAttribArray(objProgram.positionLocationAttrib);

	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.obj.positionBuffer);

	// Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
	var size = 3;          // 3 components per iteration: x, y, z
	var type = gl.FLOAT;   // the data is 32-bit floats
	var normalize = false; // don't normalize the data
	var stride = 0;        // 0 = move forward size * sizeof(type) each iteration
	var offset = 0;        // start at the beginning of the buffer

	gl.vertexAttribPointer(
		objProgram.positionLocationAttrib,
		size,
		type,
		normalize,
		stride,
		offset
	);

	// Turn on the Normal attribute
	gl.enableVertexAttribArray(objProgram.normalLocationAttrib);

	gl.bindBuffer(gl.ARRAY_BUFFER, currentScene.obj.normalBuffer);

	// Tell the normal attribute how to get data out of normalBuffer
	var normalSize = 3;          // nx, ny, nz
	var normalType = gl.FLOAT;
	var normalNormalize = false;
	var normalStride = 0;
	var normalOffset = 0;

	gl.vertexAttribPointer(
		objProgram.normalLocationAttrib,
		normalSize,
		normalType,
		normalNormalize,
		normalStride,
		normalOffset
	);

	// Camera / projection setup
	var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

	var projectionMatrix = m4.perspective(
		degToRad(camera.fov),
		aspect,
		camera.near,
		camera.far
	);

	var cameraPosition = [
		camera.position.x,
		camera.position.y,
		camera.position.z
	];

	var cameraTarget = [
		camera.target.x,
		camera.target.y,
		camera.target.z
	];

	var cameraUp = [
		camera.up.x,
		camera.up.y,
		camera.up.z
	];

	var cameraMatrix = m4.lookAt(
		cameraPosition,
		cameraTarget,
		cameraUp
	);

	var viewMatrix = m4.inverse(cameraMatrix);

	// Aposey: Note: For now, the object is not translated/rotated/scaled.
	// Aposey: Note: Later, this is where object positioning can be applied.
	var modelMatrix = m4.identity();
	//m4.scale(modelMatrix,1,1,1,modelMatrix);
	m4.translate(modelMatrix,currentScene.obj.position[0],currentScene.obj.position[1],currentScene.obj.position[2],modelMatrix);
	//m4.yRotate(modelMatrix,modelRotationRadians,modelMatrix);


	var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);
	var worldViewProjectionMatrix = m4.multiply(viewProjectionMatrix, modelMatrix);

	gl.uniformMatrix4fv(
		objProgram.worldViewProjectionUniformLocation,
		false,
		worldViewProjectionMatrix
	);

	// Color setup
	var objectColor = new Float32Array([1.0, 0.1, 0.1]);

	gl.uniform3fv(
		objProgram.colorUniformLocation,
		objectColor
	);

	// Light setup
	var lightDirection = new Float32Array([
		currentScene.light.locationPoint.x,
		currentScene.light.locationPoint.y,
		currentScene.light.locationPoint.z
	]);

	gl.uniform3fv(
		objProgram.lightDirectionUniformLocation,
		lightDirection
	);

	// Other uniforms
	var phongExponent = document.getElementById("pexpID").value;
	/*
	gl.uniform1f(
		objProgram.phongExponentLocationUniform,
		phongExponent
	);
	*/
	var showDepthBuffer = document.getElementById("isDepthBuffer").checked;
	/*
	if(showDepthBuffer){
		gl.uniform1i(objProgram.isDepthBuffer, 1);
	}
	else{
		gl.uniform1i(objProgram.isDepthBuffer, 0);
	}
	*/
	gl.drawArrays(gl.TRIANGLES, 0, currentScene.obj.numVertices);
}

function programAll(){
	programObj();
	programBillboard();
}

function preprocessBuffers(){
	makeObjBuffers();
	makeBillboardBuffers();
	makeMirrorBuffers();
	//Check making the buffers works
	console.log("mirror object:", currentScene.mirror);
	console.log("mirror framebuffer:", currentScene.mirror.framebuffer);
	console.log("mirror render texture:", currentScene.mirror.renderTexture);
}

function makeBillboardBuffers(){
	let sceneBillboard=currentScene.billboard;
	
	// Create a buffer for positions
    let billboardPositionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, billboardPositionBuffer);
    // Put the positions in the buffer
    setBillboardGeometry(gl,sceneBillboard);
	
    // provide texture coordinates for the rectangle.
    let billboardTextcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, billboardTextcoordBuffer);
    // Set Texcoords.
    setBillboardTexcoords(gl,sceneBillboard);
  
    // Create a buffer to put normals in
    let billboardNormalBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = normalBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, billboardNormalBuffer);
    // Put normals data into buffer
    setBillboardNormals(gl,sceneBillboard);
	
	// Create a texture.
	var billboardTextureBuffer = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, billboardTextureBuffer);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, imageData);
    gl.generateMipmap(gl.TEXTURE_2D);
  
    sceneBillboard.setBuffers(billboardPositionBuffer,billboardTextcoordBuffer,billboardNormalBuffer,billboardTextureBuffer);
}

function makeMirrorBuffers(){
	let sceneMirror = currentScene.mirror;

	//Skip if no mirror exists in scene
	if(!sceneMirror){
		return; // no mirror in this scene
	}

	// Create a buffer for positions
	let mirrorPositionBuffer = gl.createBuffer();
	// Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
	gl.bindBuffer(gl.ARRAY_BUFFER, mirrorPositionBuffer);
	 // Set Texcoords.
	setBillboardGeometry(gl, sceneMirror);
	
	 // provide texture coordinates for the rectangle.
	let mirrorTextcoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, mirrorTextcoordBuffer);
	//setBillboardTexcoords(gl, sceneMirror);
	
	let fakeCam = computeReflectionCamera(currentScene.camera, sceneMirror);
	setMirrorTextcoords(gl, sceneMirror, fakeCam);
	
    // Create a buffer to put normals in
	let mirrorNormalBuffer = gl.createBuffer();
	// Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = normalBuffer)
	gl.bindBuffer(gl.ARRAY_BUFFER, mirrorNormalBuffer);
	// Put normals data into buffer
	setBillboardNormals(gl, sceneMirror);


	// Pick a fixed texture size for now.
	// 512x512 is a good starting point.
	let targetTextureWidth = 512;
	let targetTextureHeight = 512;

	//Create a texture
	let mirrorRenderTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, mirrorRenderTexture);
	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,targetTextureWidth,targetTextureHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);

	// For render-to-texture, clamp + linear is a safe starter setup
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	//Depth buffer for offscreen rendering
	let mirrorDepthBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, mirrorDepthBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,targetTextureWidth,targetTextureHeight);

	//Freame Buffer
	let mirrorFramebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, mirrorFramebuffer);

	// Attach color texture
	gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,mirrorRenderTexture,0);

	// Attach depth renderbuffer
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,mirrorDepthBuffer);

	// Optional but very useful check (Googlesays this is a good idea)
	let fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
		console.error("Mirror framebuffer is incomplete. Status:", fbStatus);
	}

	// Clean up bindings so later code starts from a normal state
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);

	//Store everything on mirror
	sceneMirror.setBuffers(mirrorPositionBuffer,mirrorTextcoordBuffer,mirrorNormalBuffer,mirrorRenderTexture);

	sceneMirror.setRenderTarget(mirrorFramebuffer,mirrorRenderTexture,mirrorDepthBuffer,targetTextureWidth,targetTextureHeight);
}

function makeObjBuffers(){
	let sceneObj=currentScene.obj;
	sceneObj.setParsedObj(objParsed);
	let parsedObj=sceneObj.parsedObj;
	
	// Create a buffer for positions
    let objPositionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, objPositionBuffer);
    // Put the positions in the buffer
    setGeometryPositionBuffer(gl,parsedObj);
	
    // provide texture coordinates for the rectangle.
    let objTextcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objTextcoordBuffer);
    // Set Texcoords.
    setTextureCoordBuffer(gl,parsedObj);
  
    // Create a buffer to put normals in
    let billboardNormalBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = normalBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, billboardNormalBuffer);
    // Put normals data into buffer
    setNormalBuffer(gl,parsedObj);
  
    sceneObj.setBuffers(objPositionBuffer,objTextcoordBuffer,billboardNormalBuffer);
}

function programObj(){
	//Todo: Change the shader programs to support diffuse and specular (graduates) shading. For gouraud shading you need to calculate new normals when processing the OBJ file.
	var vShaderObj = "attribute vec4 a_position;\n"+
				"attribute vec3 a_normal;\n"+
				"varying vec3 v_normal;\n"+
				"uniform mat4 u_worldViewProjection;\n"+
				"void main() {\n"+
					"// Sending the interpolated normal to the fragment shader.\n"+
					"v_normal = a_normal;\n"+
					"// Multiply the position by the matrix.\n"+
					"gl_Position = u_worldViewProjection * a_position;\n"+
				"}";
	var fShaderObj = 	"precision mediump float;\n"+
					"varying vec3 v_normal;\n"+
					"uniform vec3 u_color;\n"+
					"uniform vec3 u_lightDirection;\n"+
					"uniform float u_near;\n"+
					"uniform float u_far;\n"+
					"uniform float u_isDepthBuffer;\n"+
					"void main() {\n"+
						"if(u_isDepthBuffer==1.0){\n"+
							"float z = gl_FragCoord.z;  // depth value [0,1]\n"+
							"float ndcZ = 2.0*z - 1.0;  // [-1,1]\n"+
							"float linearDepth = (2.0 * (u_near * u_far)/0.1) / ((u_near * u_far)/0.1 - ndcZ * (u_near * u_far)/0.1);\n"+
							"gl_FragColor = vec4(vec3(linearDepth)/(u_far/0.5), 1.0);\n"+
						"}else{\n"+
							"vec3 normal = normalize(v_normal);\n"+
							"float dLight = dot(normal, u_lightDirection);\n"+
							"gl_FragColor = vec4(u_color,1.0);\n"+
							"gl_FragColor.rgb *= dLight*0.2;\n"+
						"}\n"+
					"}";
	programObject = webglUtils.createProgramFromSources(gl, [vShaderObj,fShaderObj])
	
	//Todo: Add new varialbes for linking to the shader program.
	//The attribute variables from the shader program can be obtained as below.
	// look up where the vertex data needs to go.
    positionLocationAttrib = gl.getAttribLocation(programObject, "a_position");
	normalLocationAttrib = gl.getAttribLocation(programObject, "a_normal");
	
	//Todo: Add new varialbes for linking to the shader program.
	//The uniform variables from the shader program can be obtained as below.
	// lookup uniforms
    colorUniformLocation = gl.getUniformLocation(programObject, "u_color");
	worldViewProjectionUniformLocation = gl.getUniformLocation(programObject, "u_worldViewProjection");
	lightDirectionUniformLocation = gl.getUniformLocation(programObject, "u_lightDirection");
	
	//Todo: You can store the variable addresses into a class similar to what is shown below so that in the rendering loop you don't get the variables each time.
	objProgram=new ObjProgram(programObject,positionLocationAttrib,normalLocationAttrib,colorUniformLocation,worldViewProjectionUniformLocation,lightDirectionUniformLocation);
}

class ObjProgram{
	constructor(program,positionLocationAttrib,normalLocationAttrib,colorUniformLocation,worldViewProjectionUniformLocation){
		this.program=program;
		this.positionLocationAttrib=positionLocationAttrib;
		this.normalLocationAttrib=normalLocationAttrib;
		this.colorUniformLocation=colorUniformLocation;
		this.worldViewProjectionUniformLocation=worldViewProjectionUniformLocation;
		this.lightDirectionUniformLocation=lightDirectionUniformLocation;
	}
}

class BillboardProgram{
	constructor(program,positionLocationAttrib,normalLocationAttrib,textureLocationAttrib,textureUniformLocation,worldViewProjectionUniformLocation,lightDirectionUniformLocation){
		this.program=program;
		this.positionLocationAttrib=positionLocationAttrib;
		this.normalLocationAttrib=normalLocationAttrib;
		this.textureLocationAttrib=textureLocationAttrib;
		this.textureUniformLocation=textureUniformLocation;
		this.worldViewProjectionUniformLocation=worldViewProjectionUniformLocation;
		this.lightDirectionUniformLocation=lightDirectionUniformLocation;
	}
}

function programBillboard(){
	//Todo: Change the shader programs to support diffuse and specular (graduates) shading. For gouraud shading you need to calculate new normals when processing the OBJ file.
	var vShaderObj = "attribute vec4 a_position;\n"+
				"attribute vec3 a_normal;\n"+
				"attribute vec2 a_texcoord;\n"+
				"varying vec2 v_texcoord;\n"+
				"varying vec3 v_normal;\n"+
				"uniform mat4 u_worldViewProjection;\n"+
				"void main() {\n"+
					"// Sending the interpolated normal to the fragment shader.\n"+
					"v_normal = a_normal;\n"+
					"// Pass the texcoord to the fragment shader.\n"+
					"v_texcoord = a_texcoord;\n"+
					"// Multiply the position by the matrix.\n"+
					"gl_Position = u_worldViewProjection * a_position;\n"+
				"}";
	var fShaderObj = 	"precision mediump float;\n"+
					"varying vec3 v_normal;\n"+
					"varying vec2 v_texcoord;\n"+
					"uniform vec3 u_lightDirection;\n"+
					"uniform sampler2D u_texture;\n"+
					"uniform float u_near;\n"+
					"uniform float u_far;\n"+
					"uniform float u_isDepthBuffer;\n"+
					"void main() {\n"+
						"if(u_isDepthBuffer==1.0){\n"+
							"float z = gl_FragCoord.z;  // depth value [0,1]\n"+
							"float ndcZ = 2.0*z - 1.0;  // [-1,1]\n"+
							"float linearDepth = (2.0 * (u_near * u_far)/0.1) / ((u_near * u_far)/0.1 - ndcZ * (u_near * u_far)/0.1);\n"+
							"gl_FragColor = vec4(vec3(linearDepth)/(u_far/0.5), 1.0);\n"+
						"}else{\n"+
							"vec3 normal = normalize(v_normal);\n"+
							"float dLight = dot(normal, u_lightDirection);\n"+
							"gl_FragColor = texture2D(u_texture, v_texcoord);\n"+
							"gl_FragColor.rgb *= dLight*0.2;\n"+
						"}\n"+
					"}";
	programBill = webglUtils.createProgramFromSources(gl, [vShaderObj,fShaderObj])
	
	//Todo: Add new varialbes for linking to the shader program.
	//The attribute variables from the shader program can be obtained as below.
	// look up where the vertex data needs to go.
    positionLocationAttrib = gl.getAttribLocation(programBill, "a_position");
	normalLocationAttrib = gl.getAttribLocation(programBill, "a_normal");
	textureLocationAttrib = gl.getAttribLocation(programBill, "a_texcoord");
	
	//Todo: Add new varialbes for linking to the shader program.
	//The uniform variables from the shader program can be obtained as below.
	// lookup uniforms
    textureUniformLocation = gl.getUniformLocation(programBill, "u_texture");
	worldViewProjectionUniformLocation = gl.getUniformLocation(programBill, "u_worldViewProjection");
	lightDirectionUniformLocation = gl.getUniformLocation(programBill, "u_lightDirection");
	
	//Todo: You can store the variable addresses into a class similar to what is shown below so that in the rendering loop you don't get the variables each time.
	billboardProgram=new BillboardProgram(programBill,positionLocationAttrib,normalLocationAttrib,textureLocationAttrib,textureUniformLocation,worldViewProjectionUniformLocation,lightDirectionUniformLocation);
}


//The function for parsing PNG is done for you. The output is a an array of RGBA instances.
function parsePNG(png,fileName){
	let rawValues = png.getRGBA8Array();
	let width = png.getWidth();
	let height = png.getHeight();
	var readImageValues=[];//Array of RGBA instances
	var counterMain=0;//It is used for array of RGBAValue instances.
	for(var i = 0; i < rawValues.length; i++){
		let r=rawValues[i*4];
		let g=rawValues[i*4+1];
		let b=rawValues[i*4+2];
		let a=rawValues[i*4+3];
		readImageValues[counterMain]=new RGBAValue(r,g,b,a);
		counterMain=counterMain+1;
	}
	return new PNGImage(readImageValues,width,height,fileName);
}

class PNGImage{
	constructor(data,width,height,fileName){
		this.data=data;// The 1D array of RGBA pixel instances
		this.fileName=fileName;// Filename is useful to connect this image to appropriate Billboard after all materials are read.
		this.width=width;// Width of image
		this.height=height;// Height of image
	}
}

class RGBAValue{
	constructor(r,g,b,a)
	{
		this.r=r;
		this.g=g;
		this.b=b;
		this.a=a;
	}
}

function radToDeg(r) {
	return r * 180 / Math.PI;
}

function degToRad(d) {
	return d * Math.PI / 180;
}

// A utility function to convert a javascript Floar32Array to a buffer. This function must be called after the buffer is bound.
function setGeometryPositionBuffer(gl,obj) {
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.geometries[0].data.position), gl.STATIC_DRAW);
}

// A utility function to convert a javascript Floar32Array to a buffer. This function must be called after the buffer is bound.
function setTextureCoordBuffer(gl,obj) {
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.geometries[0].data.texcoord), gl.STATIC_DRAW);
}

// A utility function to convert a javascript Floar32Array to a buffer. This function must be called after the buffer is bound.
function setNormalBuffer(gl,obj) {
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.geometries[0].data.normal), gl.STATIC_DRAW);
}

//This is a utility function to set vertex colors by random numbers
function setColorBuffer(gl,obj) {
	var numVertices=obj.geometries[0].data.position.length;
	var colors = new Float32Array(numVertices*3);
	var myrng = new Math.seedrandom('123');
	for(let i=0;i<numVertices*3;i++){
		colors[i]=0.4+myrng()/2;
	}
	gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
}

// Complete this function with counter clock-wise vertices of the billboard. The billboard should be made of two triangles.
function setBillboardGeometry(gl,billboard) {
	var positions = new Float32Array([
	billboard.UpperLeft.x, billboard.UpperLeft.y, billboard.UpperLeft.z,  // first triangle
    billboard.LowerLeft.x, billboard.LowerLeft.y, billboard.LowerLeft.z,
    billboard.UpperRight.x, billboard.UpperRight.y, billboard.UpperRight.z,
    billboard.UpperRight.x,  billboard.UpperRight.y, billboard.UpperRight.z,  // second triangle
    billboard.LowerLeft.x,  billboard.LowerLeft.y, billboard.LowerLeft.z,
    billboard.LowerRight.x,  billboard.LowerRight.y, billboard.LowerRight.z
	]);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}

function setMirrorTextcoords(gl, mirror, fakeCamera){
	/*
	two trangles
	UL-------UR
	|
	|
	|
	LL
			  UR
			  |
			  |	
			  |
	LL--------LR
	*/
	let positions = [
		mirror.UpperLeft,
		mirror.LowerLeft,
		mirror.UpperRight,
		mirror.UpperRight,
		mirror.LowerLeft,
		mirror.LowerRight,
	]
	
	let aspect = 1.0;
	let projection = m4.perspective(
		degToRad(fakeCamera.fov),
		aspect,
		fakeCamera.near,
		fakeCamera.far
	)
	
	let camPos = [fakeCamera.position.x, fakeCamera.position.y, fakeCamera.position.z];
	let target = [fakeCamera.target.x, fakeCamera.target.y, fakeCamera.target.z]
	let up = [fakeCamera.up.x, fakeCamera.up.y, fakeCamera.up.z];
	
	let cameraMatrix = m4.lookAt(camPos,target,up);
	let view = m4.inverse(cameraMatrix);
	let vp = m4.multiply(projection,view);
	
	let textcoords = [];
	
	for (let i = 0; i < positions.length; i++){
		let p = positions[i];
		let v = [p.x, p.y, p.z, 1]
		
		let clip = m4.transformVector(vp, v);
		
		let coordX = clip[0]/clip[3];
		let coordY = clip[1]/clip[3];
		
		let u = (coordX + 1) / 2;
		let vText = (coordY + 1) / 2;
		
		textcoords.push(u, vText);
	}
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textcoords),gl.STATIC_DRAW);
}

function setBillboardTexcoords(gl,billboard) {
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([	  
	  0,0,
	  0,1,
	  1,0,
	  1,0,
	  0,1,
	  1,1
	  ]),
      gl.STATIC_DRAW);
}

function setBillboardNormals(gl,billboard) {
  let vec1=Vector3.minusTwoVectors(billboard.UpperLeft,billboard.LowerLeft);
  let vec2=Vector3.minusTwoVectors(billboard.LowerRight,billboard.LowerLeft);
  var normalVector=Vector3.crossProduct(vec2,vec1);//billboard normal vector
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([	  
	  normalVector.x,normalVector.y,normalVector.z,
	  normalVector.x,normalVector.y,normalVector.z,
	  normalVector.x,normalVector.y,normalVector.z,
	  normalVector.x,normalVector.y,normalVector.z,
	  normalVector.x,normalVector.y,normalVector.z,
	  normalVector.x,normalVector.y,normalVector.z
	  ]),
      gl.STATIC_DRAW);
}

//This function is given to you for parsing the OBJ file.
function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => {};

  function newGeometry() {
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
    });
  }

  const keywords = {
    v(parts) {
      objPositions.push(parts.map(parseFloat));
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts, unparsedArgs) {
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}

//Extra math functions. This can not be used in shader program. GLSL has its own math functions.
class Vector3{
	constructor(x,y,z){
		this.x=x;
		this.y=y;
		this.z=z;
	}
	static multiplyVectorScalar(vec,scalar){
		return new Vector3(vec.x*scalar,vec.y*scalar,vec.z*scalar);
	}
	static sumTwoVectors(vec1,vec2){
		return new Vector3(vec1.x+vec2.x,vec1.y+vec2.y,vec1.z+vec2.z);
	}
	static minusTwoVectors(vec1,vec2){
		return new Vector3(vec1.x-vec2.x,vec1.y-vec2.y,vec1.z-vec2.z);
	}
	static normalizeVector(vec){
		let sizeVec=Math.sqrt(Math.pow(vec.x,2)+Math.pow(vec.y,2)+Math.pow(vec.z,2));
		return new Vector3(vec.x/sizeVec,vec.y/sizeVec,vec.z/sizeVec);
	}
	static crossProduct(vec1,vec2){
		return new Vector3(vec1.y * vec2.z - vec1.z * vec2.y,vec1.z * vec2.x - vec1.x * vec2.z,vec1.x * vec2.y - vec1.y * vec2.x);
	}
	static negate(vec){
		return new Vector3(-vec.x,-vec.y,-vec.z);
	}
	static dotProduct(vec1,vec2){
		var result = 0;
		result += vec1.x * vec2.x;
		result += vec1.y * vec2.y;
		result += vec1.z * vec2.z;
		return result;
	}
	static distance(p1,p2){
		return Math.sqrt(Math.pow(p1.x-p2.x,2)+Math.pow(p1.y-p2.y,2)+Math.pow(p1.z-p2.z,2));
	}
	static getMagnitude(vec){
		return Math.sqrt(Math.pow(vec.x,2)+Math.pow(vec.y,2)+Math.pow(vec.z,2));
	}
}


class Billboard{
	constructor(UpperLeft,LowerLeft,UpperRight,LowerRight,imgFile,img,ambient){
		this.UpperLeft=UpperLeft;
		this.LowerLeft=LowerLeft;
		this.UpperRight=UpperRight;
		this.LowerRight=LowerRight;
		this.imgFile=imgFile;
		this.img=img;
		this.ambient=ambient;
	}
	
	setBuffers(positionBuffer,textureBuffer,normalBuffer,billboardTextureBuffer){
		this.positionBuffer=positionBuffer;
		this.textureBuffer=textureBuffer;
		this.normalBuffer=normalBuffer;
		this.billboardTextureBuffer=billboardTextureBuffer;
	}

	setRenderTarget(framebuffer, renderTexture, depthBuffer, width, height){
		this.framebuffer = framebuffer;
		this.renderTexture = renderTexture;
		this.depthBuffer = depthBuffer;
		this.renderTargetWidth = width;
		this.renderTargetHeight = height;
	}
}

class Object3D{
	constructor(position,fileName){
		this.position=position;
		this.fileName=fileName;
	}
	
	setParsedObj(parsedObj){
		this.parsedObj=parsedObj;
		this.numVertices=parsedObj.geometries[0].data.position.length/3;
	}
	
	setBuffers(positionBuffer,textureBuffer,normalBuffer){
		this.positionBuffer=positionBuffer;
		this.textureBuffer=textureBuffer;
		this.normalBuffer=normalBuffer;
	}
}

class SunLight{//Light source
	constructor(locationPoint){
		this.locationPoint=locationPoint;
	}
}

class Camera{
	constructor(position,target,up,fov,far,near,DefaulColor){
		this.position=position;
		this.target=target;
		this.up=up;
		this.fov=fov;//IMPORTANT: It is assumed that FOV is the angle between the center vector and edge of the frustum (half pyramid) but not the entire frustum (full pyramid).
		this.far=far;
		this.near=near;
		this.DefaulColor=DefaulColor;
	}
	setVectors(w,nw,u,v){
		this.w=w;
		this.nw=nw;
		this.u=u;
		this.v=v;
	}
}

class Scene{//This object technically stores everything required for a scene
	constructor(light,billboard,mirror, obj,camera){
		this.light=light;
		this.billboard=billboard;
		this.mirror = mirror;
		this.camera=camera;
		this.obj=obj;
	}
}

function parseScene(file_data)//A simple function to read JSON and put the data inside a scene class and return the read scene
{
	var sceneFile = JSON.parse(file_data);
	let pos=new Vector3(sceneFile.eye[0],sceneFile.eye[1],sceneFile.eye[2]);
	let lookat=new Vector3(sceneFile.lookat[0],sceneFile.lookat[1],sceneFile.lookat[2]);
	let up=new Vector3(sceneFile.up[0],sceneFile.up[1],sceneFile.up[2]);
	let fov=sceneFile.fov_angle;
	let near=sceneFile.near;
	let far=sceneFile.far;
	let DefaulColor=sceneFile.DefaulColor;
	var camera=new Camera(pos,lookat,up,fov,far,near,DefaulColor);
	let light=new SunLight(new Vector3(sceneFile.SunLocation[0],sceneFile.SunLocation[1],sceneFile.SunLocation[2]));
	var billboard;
	if ('billboard' in sceneFile) {//If billboard exists in scene
		let upperLeft=new Vector3(sceneFile.billboard.UpperLeft[0],sceneFile.billboard.UpperLeft[1],sceneFile.billboard.UpperLeft[2]);
		let lowerLeft=new Vector3(sceneFile.billboard.LowerLeft[0],sceneFile.billboard.LowerLeft[1],sceneFile.billboard.LowerLeft[2]);
		let upperRight=new Vector3(sceneFile.billboard.UpperRight[0],sceneFile.billboard.UpperRight[1],sceneFile.billboard.UpperRight[2]);
		let billboardHeight=upperLeft.y-lowerLeft.y;
		let lowerRight=new Vector3(upperRight.x,upperRight.y-billboardHeight,upperRight.z);
		
		billboard=new Billboard(upperLeft,lowerLeft,upperRight,lowerRight,sceneFile.billboard.filename,null,null);//Image is assigned to billboard later
	}

		var mirror = null;
	if ('mirror' in sceneFile) { // If mirror exists in scene
		let upperLeft = new Vector3(sceneFile.mirror.UpperLeft[0],sceneFile.mirror.UpperLeft[1],sceneFile.mirror.UpperLeft[2]);
		let lowerLeft = new Vector3(sceneFile.mirror.LowerLeft[0],sceneFile.mirror.LowerLeft[1],sceneFile.mirror.LowerLeft[2]);
		let upperRight = new Vector3(sceneFile.mirror.UpperRight[0],sceneFile.mirror.UpperRight[1],sceneFile.mirror.UpperRight[2]);

		// Compute lower-right from the other 3 corners
		let mirrorHeight = upperLeft.y - lowerLeft.y;
		let lowerRight = new Vector3(upperRight.x,upperRight.y - mirrorHeight,upperRight.z);

		// Mirror uses Billboard class too.
		// No image file is needed yet because later this will use a render-to-texture result.
		mirror = new Billboard(
			upperLeft,
			lowerLeft,
			upperRight,
			lowerRight,
			null,
			null,
			null
		);
	}

	var obj=null;
	if ('obj' in sceneFile) {//If billboard exists in scene
		let position=sceneFile.obj.position;
		let fileName=sceneFile.obj.filename;
		obj=new Object3D(position,fileName);
	}
	return new Scene(light,billboard,mirror, obj,camera);
}