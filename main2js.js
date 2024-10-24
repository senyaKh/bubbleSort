// main2JS.js
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const scene = new THREE.Scene();

const container = document.getElementById('container');
const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;
const camera = new THREE.PerspectiveCamera(45, containerWidth / containerHeight, 0.1, 1000);
camera.position.set(0, 0, 30);
camera.lookAt(scene.position);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(containerWidth, containerHeight);
container.appendChild(renderer.domElement);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x2d2d30, 0);

const ambientLight = new THREE.AmbientLight(0xdbd9d9, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const gridSize = 100;
const gridDivisions = 40;
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0xa6a6a6, 0xa6a6a6);
gridHelper.position.y = -1;
gridHelper.rotation.x = Math.PI / 2;
gridHelper.position.z = -10;
scene.add(gridHelper);

const baseOpacity = 0.2;

const materials = {
	default: new THREE.MeshPhongMaterial({
		color: 0x0080ff,
		shininess: 100,
		transparent: true,
		opacity: baseOpacity,
	}),
	comparing: new THREE.MeshPhongMaterial({
		color: 0xffd700,
		shininess: 100,
		transparent: true,
		opacity: baseOpacity,
	}),
	swapped: new THREE.MeshPhongMaterial({
		color: 0xff0000,
		shininess: 100,
		transparent: true,
		opacity: baseOpacity,
	}),
	sorted: new THREE.MeshPhongMaterial({
		color: 0x00ff00,
		shininess: 100,
		transparent: true,
		opacity: baseOpacity,
	}),
};

let isAnimating = false;
let font;
let model;
const boxes = [];
const labels = [];
const textMeshes = [];
let values = [];
let animations = [];
let currentStep = 0;
let isTransparent = true;

const fontLoader = new FontLoader();
fontLoader.load(
	'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
	function (loadedFont) {
		font = loadedFont;
		createBoxes();
	}
);

const loader = new GLTFLoader();

function applyMaterial(box, material) {
	box.traverse(function (node) {
		if (node.isMesh && node.name !== 'TextMesh') {
			node.material = material.clone();
			node.castShadow = true;
			node.receiveShadow = true;
		}
	});
}

function addLabel(value, box, textSize = 0.7) {
	if (!font) return;
	const textGeometry = new TextGeometry(value.toString(), {
		font: font,
		size: textSize,
		height: 0.05,
		curveSegments: 12,
		bevelEnabled: false,
	});

	textGeometry.computeBoundingBox();
	const center = textGeometry.boundingBox.getCenter(new THREE.Vector3());
	textGeometry.translate(-center.x, -center.y, -center.z);

	const textMaterial = new THREE.MeshPhongMaterial({
		color: 0x000000,
		side: THREE.DoubleSide,
	});
	const textMesh = new THREE.Mesh(textGeometry, textMaterial);
	textMesh.castShadow = true;
	textMesh.receiveShadow = true;

	textMesh.position.set(0, 0.2, 0);
	textMesh.name = 'TextMesh';

	box.add(textMesh);
}

function createBoxes() {
	loader.load(
		'model/box1.glb',
		function (gltf) {
			model = gltf.scene;

			const numBoxes = 8;
			const maxValue = 999;
			const spacing = 3.5;
			const startX = -((numBoxes - 1) * spacing) / 2;

			for (let i = 0; i < numBoxes; i++) {
				const value = Math.floor(Math.random() * maxValue) + 1;
				values.push(value);
				const box = model.clone();
				box.position.set(startX + i * spacing, 0, 0);

				const scaleFactor = 1;
				box.scale.set(scaleFactor, scaleFactor, scaleFactor);

				applyMaterial(box, materials['default']);
				box.castShadow = true;
				box.receiveShadow = true;
				scene.add(box);

				addLabel(value, box);

				boxes.push(box);
			}

			updateCodeBlock();
			createBubbleSortAnimations();
			animateScene();
		},
		undefined,
		function (error) {
			console.error(error);
		}
	);
}

function updateCodeBlock() {
	const codeBlock = document.getElementById('codeBlock');
	const arrayValues = boxes.map((box) => {
		const labelMesh = box.children.find((child) => child.name === 'TextMesh');
		return labelMesh ? labelMesh.geometry.parameters.text : '0';
	});
	const arrayInit = arrayValues.map((val) => `<span class="value">${val}</span>`).join(', ');
	const arrayInitLine = `<span class="type">int</span> <span class="variable">array</span>[] = {${arrayInit}};`;
	const codeLines = codeBlock.innerHTML.split('\n');
	const arrayLineIndex = codeLines.findIndex((line) => line.includes('int array[]'));
	if (arrayLineIndex !== -1) {
		codeLines[arrayLineIndex] = arrayInitLine;
		codeBlock.innerHTML = codeLines.join('\n');
	}
}

function createBubbleSortAnimations() {
	const n = values.length;
	const arr = values.slice();

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n - i - 1; j++) {
			animations.push({
				type: 'compare',
				indices: [j, j + 1],
			});

			if (arr[j] > arr[j + 1]) {
				animations.push({
					type: 'swap',
					indices: [j, j + 1],
				});

				[arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
			}
		}
		animations.push({
			type: 'sorted',
			index: n - i - 1,
		});
	}
	animations.push({
		type: 'sorted',
		index: 0,
	});
}

function playAnimations() {
	if (isAnimating) return;
	isAnimating = true;

	let animationIndex = 0;

	function nextAnimation() {
		if (animationIndex >= animations.length) {
			isAnimating = false;
			document.getElementById('resetButton').style.display = 'block';
			return;
		}

		const animation = animations[animationIndex];
		const duration = 500;

		if (animation.type === 'compare') {
			const [i, j] = animation.indices;
			highlightBoxes([i, j], materials.comparing);

			setTimeout(() => {
				resetBoxes([i, j]);
				updateCodeBlock();
				animationIndex++;
				nextAnimation();
			}, duration);
		} else if (animation.type === 'swap') {
			const [i, j] = animation.indices;
			highlightBoxes([i, j], materials.swapped);

			const boxA = boxes[i];
			const boxB = boxes[j];

			const posA = boxA.position.x;
			const posB = boxB.position.x;

			animateSwap(boxA, boxB, posA, posB, duration);

			[boxes[i], boxes[j]] = [boxes[j], boxes[i]];

			setTimeout(() => {
				resetBoxes([i, j]);
				updateCodeBlock();
				animationIndex++;
				nextAnimation();
			}, duration);
		} else if (animation.type === 'sorted') {
			const index = animation.index;
			highlightBoxes([index], materials.sorted);

			setTimeout(() => {
				updateCodeBlock();
				animationIndex++;
				nextAnimation();
			}, duration);
		}
	}

	nextAnimation();
}

function highlightBoxes(indices, material) {
	indices.forEach((index) => {
		boxes[index].traverse(function (node) {
			if (node.isMesh && node.name !== 'TextMesh') {
				node.material.color.set(material.color);
				node.material.opacity = baseOpacity;
				node.material.transparent = true;
			}
		});
	});
}

function resetBoxes(indices) {
	indices.forEach((index) => {
		boxes[index].traverse(function (node) {
			if (node.isMesh && node.name !== 'TextMesh') {
				node.material.color.set(materials.default.color);
				node.material.opacity = baseOpacity;
				node.material.transparent = true;
			}
		});
	});
}

function animateSwap(boxA, boxB, startPosA, startPosB, duration) {
	const startTime = performance.now();

	function animatePosition() {
		const currentTime = performance.now();
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);

		const newX_A = THREE.MathUtils.lerp(startPosA, startPosB, progress);
		const newX_B = THREE.MathUtils.lerp(startPosB, startPosA, progress);

		boxA.position.x = newX_A;
		boxB.position.x = newX_B;

		if (progress < 1) {
			requestAnimationFrame(animatePosition);
		}
	}

	animatePosition();
}

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
	const containerWidth = container.clientWidth;
	const containerHeight = container.clientHeight;

	camera.aspect = containerWidth / containerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(containerWidth, containerHeight);
}

let raycaster = new THREE.Raycaster();
let mouseVector = new THREE.Vector2();
let selectedBox = null;
let isDragging = false;
let previousMousePosition = {
	x: 0,
	y: 0,
};

function onPointerDown(event) {
	event.preventDefault();

	const rect = renderer.domElement.getBoundingClientRect();

	if (event.touches) {
		mouseVector.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
		mouseVector.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
	} else {
		mouseVector.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouseVector.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
	}

	raycaster.setFromCamera(mouseVector, camera);

	const intersects = raycaster.intersectObjects(boxes, true);

	if (intersects.length > 0) {
		selectedBox = intersects[0].object.parent;
		isDragging = true;
		if (event.touches) {
			previousMousePosition = {
				x: event.touches[0].clientX,
				y: event.touches[0].clientY,
			};
		} else {
			previousMousePosition = {
				x: event.clientX,
				y: event.clientY,
			};
		}
	}
}

function onPointerMove(event) {
	if (!isDragging || !selectedBox) return;

	let deltaMove;
	if (event.touches) {
		deltaMove = {
			x: event.touches[0].clientX - previousMousePosition.x,
			y: event.touches[0].clientY - previousMousePosition.y,
		};
		previousMousePosition = {
			x: event.touches[0].clientX,
			y: event.touches[0].clientY,
		};
	} else {
		deltaMove = {
			x: event.clientX - previousMousePosition.x,
			y: event.clientY - previousMousePosition.y,
		};
		previousMousePosition = {
			x: event.clientX,
			y: event.clientY,
		};
	}

	selectedBox.rotation.y += deltaMove.x * 0.005;
	selectedBox.rotation.x += deltaMove.y * 0.005;
}

function onPointerUp(event) {
	isDragging = false;
	selectedBox = null;
}

renderer.domElement.addEventListener('mousedown', onPointerDown, false);
renderer.domElement.addEventListener('mousemove', onPointerMove, false);
renderer.domElement.addEventListener('mouseup', onPointerUp, false);

renderer.domElement.addEventListener('touchstart', onPointerDown, false);
renderer.domElement.addEventListener('touchmove', onPointerMove, false);
renderer.domElement.addEventListener('touchend', onPointerUp, false);

function animateScene() {
	requestAnimationFrame(animateScene);
	renderer.render(scene, camera);
}
animateScene();

function resetScene() {
	isAnimating = false;

	boxes.forEach((box) => {
		scene.remove(box);
	});
	boxes.length = 0;
	values.length = 0;
	animations.length = 0;

	currentStep = 0;

	document.getElementById('resetButton').style.display = 'none';
	document.getElementById('startButton').style.display = 'block';

	createBoxes();
}

function toggleOpacity() {
	isTransparent = !isTransparent;
	const newOpacity = isTransparent ? baseOpacity : 1;

	boxes.forEach((box) => {
		box.traverse(function (child) {
			if (child.isMesh && child.name !== 'TextMesh') {
				child.material.transparent = isTransparent;
				child.material.opacity = newOpacity;
				child.material.needsUpdate = true;
			}
		});
	});
}

document.getElementById('toggleOpacityButton').addEventListener('click', toggleOpacity);

const startButton = document.getElementById('startButton');
startButton.addEventListener('click', () => {
	playAnimations();
	startButton.style.display = 'none';
});

const resetButton = document.getElementById('resetButton');
resetButton.addEventListener('click', resetScene);