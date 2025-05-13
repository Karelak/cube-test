// Three.js code will go here
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { InteractiveCube } from "./cube.js"; // Import the cube class

// Keyboard controls state and parameters
const keyStates = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

const dimensionChangeSpeed = {
  height: 0,
  width: 0,
};

const ACCELERATION = 0.005; // Speed increment per frame
const MAX_SPEED = 0.15; // Maximum change per frame
const BASE_SPEED = 0.02; // Initial speed when key is pressed

// Get DOM elements for displaying dimensions
const lengthDisplay = document.getElementById("lengthVal");
const heightDisplay = document.getElementById("heightVal");
const depthDisplay = document.getElementById("depthVal");

// Scene
const scene = new THREE.Scene();

// Interactive Cube
const interactiveCube = new InteractiveCube(10); // Initial side length 10
scene.add(interactiveCube.getMesh());

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// Camera
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.z = 20; // Move the camera further back
scene.add(camera);

// Renderer
const canvas = document.querySelector("#cubeCanvas");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 2;
controls.maxDistance = 200; // Increased max zoom out distance
// controls.maxPolarAngle = Math.PI / 2; // Prevents looking from below the ground

// Raycaster for picking handles
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedHandle = null;
let plane = new THREE.Plane();
let offset = new THREE.Vector3();
const intersection = new THREE.Vector3(); // To store intersection point

// Store the initial state when dragging starts
let dragStartState = {
  worldPosition: new THREE.Vector3(),
  originalDimensions: { width: 0, height: 0, depth: 0 },
  handleIndex: -1,
};

function onPointerMove(event) {
  // Calculate mouse position in normalized device coordinates
  // (-1 to +1) for both components
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (selectedHandle) {
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(plane, intersection)) {
      const newWorldPosition = intersection.sub(offset);

      // Transform the new world position to the cube's local space
      const cubeMesh = interactiveCube.getMesh();
      const localNewPosition = cubeMesh.worldToLocal(newWorldPosition.clone());

      // Get the original local position of the handle when drag started
      // The handles are positioned relative to the cube's center.
      // The original positions are +/- halfW, +/- halfH, +/- halfD
      const originalHandleLocalPos = new THREE.Vector3();
      const halfW = dragStartState.originalDimensions.width / 2;
      const halfH = dragStartState.originalDimensions.height / 2;
      const halfD = dragStartState.originalDimensions.depth / 2;

      // Determine original local position based on handle index (this needs to match cube.js handle order)
      const positions = [
        new THREE.Vector3(halfW, halfH, halfD), // 0: FTR
        new THREE.Vector3(-halfW, halfH, halfD), // 1: FTL
        new THREE.Vector3(halfW, -halfH, halfD), // 2: FBR
        new THREE.Vector3(-halfW, -halfH, halfD), // 3: FBL
        new THREE.Vector3(halfW, halfH, -halfD), // 4: BTR
        new THREE.Vector3(-halfW, halfH, -halfD), // 5: BTL
        new THREE.Vector3(halfW, -halfH, -halfD), // 6: BBR
        new THREE.Vector3(-halfW, -halfH, -halfD), // 7: BBL
      ];
      originalHandleLocalPos.copy(positions[dragStartState.handleIndex]);

      // Calculate the delta in local coordinates
      const localDelta = localNewPosition.clone().sub(originalHandleLocalPos);

      let newWidth = dragStartState.originalDimensions.width;
      let newHeight = dragStartState.originalDimensions.height;
      let newDepth = dragStartState.originalDimensions.depth;

      // Apply delta to corresponding dimensions based on which corner is being dragged
      // If originalHandleLocalPos.x was positive, delta.x adds to width, if negative, delta.x subtracts (or adds to -width)
      // This logic determines how much the dimension *should* change from its original value.
      newWidth += (originalHandleLocalPos.x > 0 ? 1 : -1) * localDelta.x * 2;
      newHeight += (originalHandleLocalPos.y > 0 ? 1 : -1) * localDelta.y * 2;
      newDepth += (originalHandleLocalPos.z > 0 ? 1 : -1) * localDelta.z * 2;

      // Prevent dimensions from becoming zero or negative
      newWidth = Math.max(0.1, newWidth);
      newHeight = Math.max(0.1, newHeight);
      newDepth = Math.max(0.1, newDepth);

      // Determine which dimension changed the most due to this drag step
      // This is a simplification; a more robust method might consider the primary axis of drag.
      const dx = Math.abs(newWidth - dragStartState.originalDimensions.width);
      const dy = Math.abs(newHeight - dragStartState.originalDimensions.height);
      const dz = Math.abs(newDepth - dragStartState.originalDimensions.depth);

      if (dx > dy && dx > dz) {
        interactiveCube.updateDimension("width", newWidth);
      } else if (dy > dx && dy > dz) {
        interactiveCube.updateDimension("height", newHeight);
      } else {
        interactiveCube.updateDimension("depth", newDepth);
      }
    }
  }
}

function onPointerDown(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveCube.handles, true);

  if (intersects.length > 0) {
    controls.enabled = false; // Disable camera controls when dragging a handle
    selectedHandle = intersects[0].object;

    // Store drag start state
    selectedHandle.getWorldPosition(dragStartState.worldPosition);
    dragStartState.originalDimensions.width = interactiveCube.width;
    dragStartState.originalDimensions.height = interactiveCube.height;
    dragStartState.originalDimensions.depth = interactiveCube.depth;
    dragStartState.handleIndex = selectedHandle.userData.id;

    // Create a plane that is aligned with the camera and passes through the handle's current world position
    plane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(plane.normal),
      dragStartState.worldPosition
    );

    // Calculate offset from handle's world position to intersection point on the plane
    if (raycaster.ray.intersectPlane(plane, intersection)) {
      offset.copy(intersection).sub(dragStartState.worldPosition);
    }
    // canvas.style.cursor = 'grabbing';
  } else {
    // canvas.style.cursor = 'grab';
  }
}

function onPointerUp(event) {
  controls.enabled = true;
  selectedHandle = null;
  // canvas.style.cursor = 'auto';
}

window.addEventListener("pointermove", onPointerMove, false);
window.addEventListener("pointerdown", onPointerDown, false);
window.addEventListener("pointerup", onPointerUp, false);

// Keyboard event listeners
window.addEventListener("keydown", (event) => {
  if (keyStates.hasOwnProperty(event.key)) {
    event.preventDefault(); // Prevent window scrolling
    keyStates[event.key] = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (keyStates.hasOwnProperty(event.key)) {
    event.preventDefault();
    keyStates[event.key] = false;
  }
});

// Function to update the dimensions display
function updateDimensionsDisplay(cube) {
  if (lengthDisplay && heightDisplay && depthDisplay) {
    lengthDisplay.textContent = cube.width.toFixed(2);
    heightDisplay.textContent = cube.height.toFixed(2);
    depthDisplay.textContent = cube.depth.toFixed(2);
  }
}

// Animation loop
const animate = () => {
  // Keyboard controls for cube dimensions
  // Height control (Up/Down arrows)
  if (keyStates.ArrowUp) {
    if (dimensionChangeSpeed.height < MAX_SPEED) {
      dimensionChangeSpeed.height = Math.min(
        MAX_SPEED,
        (dimensionChangeSpeed.height === 0
          ? BASE_SPEED
          : dimensionChangeSpeed.height) + ACCELERATION
      );
    }
    interactiveCube.updateDimension(
      "height",
      interactiveCube.height + dimensionChangeSpeed.height
    );
    updateDimensionsDisplay(interactiveCube); // Update display
  } else if (keyStates.ArrowDown) {
    if (dimensionChangeSpeed.height < MAX_SPEED) {
      dimensionChangeSpeed.height = Math.min(
        MAX_SPEED,
        (dimensionChangeSpeed.height === 0
          ? BASE_SPEED
          : dimensionChangeSpeed.height) + ACCELERATION
      );
    }
    interactiveCube.updateDimension(
      "height",
      Math.max(0.1, interactiveCube.height - dimensionChangeSpeed.height)
    );
    updateDimensionsDisplay(interactiveCube); // Update display
  } else {
    dimensionChangeSpeed.height = 0; // Reset speed if no up/down key is pressed
  }

  // Width control (Left/Right arrows) - "length"
  if (keyStates.ArrowRight) {
    if (dimensionChangeSpeed.width < MAX_SPEED) {
      dimensionChangeSpeed.width = Math.min(
        MAX_SPEED,
        (dimensionChangeSpeed.width === 0
          ? BASE_SPEED
          : dimensionChangeSpeed.width) + ACCELERATION
      );
    }
    interactiveCube.updateDimension(
      "width",
      interactiveCube.width + dimensionChangeSpeed.width
    );
    updateDimensionsDisplay(interactiveCube); // Update display
  } else if (keyStates.ArrowLeft) {
    if (dimensionChangeSpeed.width < MAX_SPEED) {
      dimensionChangeSpeed.width = Math.min(
        MAX_SPEED,
        (dimensionChangeSpeed.width === 0
          ? BASE_SPEED
          : dimensionChangeSpeed.width) + ACCELERATION
      );
    }
    interactiveCube.updateDimension(
      "width",
      Math.max(0.1, interactiveCube.width - dimensionChangeSpeed.width)
    );
    updateDimensionsDisplay(interactiveCube); // Update display
  } else {
    dimensionChangeSpeed.width = 0; // Reset speed if no left/right key is pressed
  }

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call animate again on the next frame
  window.requestAnimationFrame(animate);
};

animate();

// Initial display update
updateDimensionsDisplay(interactiveCube);

// Handle window resize
window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

console.log("Three.js setup complete. Cube should be visible.");
