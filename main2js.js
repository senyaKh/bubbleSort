import * as THREE from './libs/three/three.module.js';
import { FontLoader } from './jsm/loaders/FontLoader.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { TextGeometry } from './jsm/geometries/TextGeometry.js';

// Подключаем Cannon.js для физики
import * as CANNON from './cannon.js';
import * as TWEEN from './tween.js';

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

const gridSize = 200;
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
let model; // Здесь мы объявляем переменную model для хранения загруженной модели коробки
const boxes = [];
const labels = [];
const textMeshes = [];

// Функция для генерации случайных значений
function generateRandomValues(count, min = 1, max = 100) {
	const arr = [];
	for (let i = 0; i < count; i++) {
		arr.push(Math.floor(Math.random() * (max - min + 1)) + min);
	}
	return arr;
}

// Определяем количество коробок
const numBoxes = 8;

// Инициализируем массив значений случайными числами
let values = generateRandomValues(numBoxes);

let animations = [];
let currentStep = 0;
let isTransparent = true;

// Создаем физический мир
const world = new CANNON.World();
world.gravity.set(0, 0, 0); // Отсутствие гравитации

// Создаем материал для пузырей с высокой упругостью
const bubbleMaterial = new CANNON.Material('bubbleMaterial');
const bubbleContactMaterial = new CANNON.ContactMaterial(bubbleMaterial, bubbleMaterial, {
	friction: 0.0,
	restitution: 1.0,
});
world.addContactMaterial(bubbleContactMaterial);

// Загрузка модели пузыря для фона
let bubbleBackgroundModel;
const backgroundBubbles = [];
const bubbleBackgroundBodies = [];
const bubbleBackgroundLoader = new GLTFLoader();

// Загрузка модели пузыря для сортировки
let bubbleSortModel;
const bubbleSortLoader = new GLTFLoader();

function createBackgroundBubbles() {
	bubbleBackgroundLoader.load(
		'model/free_bubble_kit.glb',
		function (gltf) {
			bubbleBackgroundModel = gltf.scene;

			// Создаем множество пузырей на фоне
			for (let i = 0; i < 100; i++) {
				const bubble = bubbleBackgroundModel.clone();

				// Случайная позиция пузыря за коробками
				const posX = (Math.random() - 0.5) * 100;
				const posY = (Math.random() - 0.5) * 50;
				const posZ = -Math.random() * 50 - 10; // Между -10 и -60 (позади коробок)
				bubble.position.set(posX, posY, posZ);

				// Увеличенный масштаб пузырей
				const scale = Math.random() * 1 + 0.5; // От 0.5 до 1.5
				bubble.scale.set(scale, scale, scale);

				// Прозрачность пузыря
				bubble.traverse(function (child) {
					if (child.isMesh) {
						child.material.transparent = true;
						child.material.opacity = 0.5;
					}
				});

				scene.add(bubble);
				backgroundBubbles.push(bubble);

				// Создаем физическое тело для пузыря
				const shape = new CANNON.Sphere(scale * 0.5);
				const body = new CANNON.Body({
					mass: 1,
					shape: shape,
					position: new CANNON.Vec3(posX, posY, posZ),
					material: bubbleMaterial,
				});
				// Случайная начальная скорость
				body.velocity.set(
					(Math.random() - 0.5) * 0.2,
					(Math.random() - 0.5) * 0.2,
					(Math.random() - 0.5) * 0.2
				);
				world.addBody(body);
				bubbleBackgroundBodies.push(body);
			}
		},
		undefined,
		function (error) {
			console.error(error);
		}
	);
}

function animateBackgroundBubbles() {
	world.step(1 / 60);

	for (let i = 0; i < backgroundBubbles.length; i++) {
		const bubble = backgroundBubbles[i];
		const body = bubbleBackgroundBodies[i];

		// Обновляем позицию пузыря из физического тела
		bubble.position.copy(body.position);
		bubble.quaternion.copy(body.quaternion);

		// Отражаем от границ сцены
		const boundary = 50;
		if (body.position.x > boundary || body.position.x < -boundary) {
			body.velocity.x *= -1;
		}
		if (body.position.y > boundary || body.position.y < -boundary) {
			body.velocity.y *= -1;
		}
		if (body.position.z > -10 || body.position.z < -60) {
			body.velocity.z *= -1;
		}
	}
}

const fontLoader = new FontLoader();
fontLoader.load('./fonts/helvetiker_bold.typeface.json', function (loadedFont) {
	font = loadedFont;

	// Загружаем модель коробки и пузыря перед созданием сцен
	loadModels();
});

const loader = new GLTFLoader();

// Загрузка модели пузыря для сортировки
bubbleSortLoader.load(
	'model/free_bubble_kit.glb',
	function (gltf) {
		bubbleSortModel = gltf.scene;
	},
	undefined,
	function (error) {
		console.error(error);
	}
);

// Загрузка модели коробки и создание сцены после загрузки
function loadModels() {
	loader.load(
		'model/box1.glb',
		function (gltf) {
			model = gltf.scene;
			createBoxes(); // Создаем коробки после загрузки модели
			createBackgroundBubbles(); // Создаем фоновый пузырь
		},
		undefined,
		function (error) {
			console.error(error);
		}
	);
}

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

	// Сохраняем значение в userData для дальнейшего использования
	box.userData.value = value;
}

function createBoxes() {
	const numBoxes = values.length; // Устанавливаем количество коробок равным длине массива
	const spacing = 3.5;
	const startX = -((numBoxes - 1) * spacing) / 2;

	for (let i = 0; i < numBoxes; i++) {
		const value = values[i];
		const box = model.clone();
		box.position.set(startX + i * spacing, 0, 0);

		const scaleFactor = 1;
		box.scale.set(scaleFactor, scaleFactor, scaleFactor);

		applyMaterial(box, materials.default);
		box.castShadow = true;
		box.receiveShadow = true;
		scene.add(box);

		addLabel(value, box);

		boxes.push(box);
	}

	// Вызов функции обновления блока кода
	updateCodeBlock();

	createBubbleSortAnimations();
	animateScene();
}

function updateCodeBlock() {
	const codeBlock = document.getElementById('array');
	const arrayValues = values.map((val) => `<span class="value">${val}</span>`).join(', ');
	const arrayInitLine = `<span class="type">int</span> <span class="variable">array</span>[] = {${arrayValues}};`;
	codeBlock.innerHTML = arrayInitLine;
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
		const duration = 1200; // Сделаем анимацию немного быстрее

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

			// Обновляем массив boxes после завершения анимации
			animateBubbleSwap(boxA, boxB, i, j, duration, () => {
				// Обменяем местами ссылки в массиве boxes
				[boxes[i], boxes[j]] = [boxes[j], boxes[i]];

				// Обменяем значения в массиве values
				[values[i], values[j]] = [values[j], values[i]];

				// Обновим значения в коробках
				updateBoxLabel(boxes[i]);
				updateBoxLabel(boxes[j]);

				resetBoxes([i, j]);
				// Обновляем блок кода после обмена
				updateCodeBlock();
				animationIndex++;
				nextAnimation();
			});
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

function animateBubbleSwap(boxA, boxB, indexA, indexB, duration, onComplete) {
	const startPosA = boxA.position.clone();
	const startPosB = boxB.position.clone();

	const bubbleY = startPosA.y + 2; // Высота подъема для пузыря
	const downY = startPosB.y - 2; // Низ для коробки B

	// Создаем группу для пузыря и коробки A
	const bubbleGroup = new THREE.Group();
	bubbleGroup.position.copy(startPosA);

	// Создаем пузырь и добавляем в группу
	const bubble = createBubbleAt(0, 0, 0); // позиция относительно bubbleGroup
	bubbleGroup.add(bubble);

	// Устанавливаем масштаб пузыря так, чтобы он содержал коробку
	const bubbleScale = 2.5; // Подберите нужное значение
	bubble.scale.set(bubbleScale, bubbleScale, bubbleScale);

	// Добавляем коробку A в группу
	boxA.parent.remove(boxA);
	bubbleGroup.add(boxA);

	// Центрируем коробку внутри пузыря
	const boxBBox = new THREE.Box3().setFromObject(boxA);
	const boxCenter = boxBBox.getCenter(new THREE.Vector3());
	boxA.position.sub(boxCenter); // Центрируем коробку относительно (0,0,0)

	// Вычисляем вертикальное смещение
	const bubbleBBox = new THREE.Box3().setFromObject(bubble);
	const bubbleHeight = bubbleBBox.max.y - bubbleBBox.min.y;
	const boxHeight = boxBBox.max.y - boxBBox.min.y;
	const verticalOffset = (bubbleHeight - boxHeight) / 2;

	boxA.position.y += verticalOffset;

	// Добавляем группу в сцену
	scene.add(bubbleGroup);

	// Анимируем подъем группы
	new TWEEN.Tween(bubbleGroup.position)
		.to({ y: bubbleY }, duration * 0.25)
		.easing(TWEEN.Easing.Quadratic.Out)
		.start()
		.onComplete(() => {
			// Анимируем движение группы к позиции B
			new TWEEN.Tween(bubbleGroup.position)
				.to({ x: startPosB.x }, duration * 0.5)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.start()
				.onComplete(() => {
					// Анимируем опускание группы
					new TWEEN.Tween(bubbleGroup.position)
						.to({ y: startPosB.y }, duration * 0.25)
						.easing(TWEEN.Easing.Quadratic.In)
						.start()
						.onComplete(() => {
							// Убираем коробку A из группы и возвращаем в сцену
							bubbleGroup.remove(boxA);
							boxA.position.copy(bubbleGroup.position);
							scene.add(boxA);

							// Удаляем группу с пузырем
							scene.remove(bubbleGroup);

							onComplete();
						});
				});
		});

	// Анимируем коробку B вниз и влево
	new TWEEN.Tween(boxB.position)
		.to({ x: startPosA.x, y: downY }, duration)
		.easing(TWEEN.Easing.Quadratic.InOut)
		.start()
		.onComplete(() => {
			// Анимируем подъем коробки B
			new TWEEN.Tween(boxB.position)
				.to({ y: startPosB.y }, duration * 0.25)
				.easing(TWEEN.Easing.Quadratic.Out)
				.start();
		});
}

function createBubbleAt(x, y, z) {
	if (!bubbleSortModel) return;
	const bubble = bubbleSortModel.clone();

	// Прозрачность пузыря
	bubble.traverse(function (child) {
		if (child.isMesh) {
			child.material.transparent = true;
			child.material.opacity = 0.8;
		}
	});

	// Центрируем пузырь
	const bbox = new THREE.Box3().setFromObject(bubble);
	const center = bbox.getCenter(new THREE.Vector3());
	bubble.position.set(-center.x, -center.y, -center.z);

	return bubble;
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

	// Анимация фоновых пузырей
	animateBackgroundBubbles();

	// Обновление анимаций TWEEN
	TWEEN.update();

	renderer.render(scene, camera);
}

// Начинаем анимацию сцены
animateScene();

function resetScene() {
	isAnimating = false;

	boxes.forEach((box) => {
		scene.remove(box);
	});
	boxes.length = 0;
	// Генерация новых случайных значений
	values = generateRandomValues(numBoxes);
	animations.length = 0;

	currentStep = 0;

	document.getElementById('resetButton').style.display = 'none';
	document.getElementById('startButton').style.display = 'block';

	createBoxes();
	// Вызов функции обновления блока кода после создания новых коробок
	updateCodeBlock();
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

// Функция для обновления текста на коробке
function updateBoxLabel(box) {
	const textMesh = box.children.find((child) => child.name === 'TextMesh');
	if (textMesh) {
		// Удаляем старый текст
		box.remove(textMesh);

		// Создаем новый текст с обновленным значением
		const newValue = box.userData.value;
		const textGeometry = new TextGeometry(newValue.toString(), {
			font: font,
			size: 0.7,
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
		const newTextMesh = new THREE.Mesh(textGeometry, textMaterial);
		newTextMesh.castShadow = true;
		newTextMesh.receiveShadow = true;

		newTextMesh.position.set(0, 0.2, 0);
		newTextMesh.name = 'TextMesh';

		box.add(newTextMesh);
	}
}
