import * as THREE from "three";

const TARGET_VOLUME = 1000;

export class InteractiveCube {
  constructor(initialSide = Math.cbrt(TARGET_VOLUME)) {
    this.width = initialSide;
    this.height = initialSide;
    this.depth = initialSide;
    // Ensure initial dimensions match target volume precisely if initialSide was an estimate
    this.adjustToTargetVolume();

    const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0xcccac8, // Changed to specified gray
      transparent: true, // Enable transparency
      opacity: 0.5, // Set opacity to 50%
      wireframe: false, // Ensure the cube is solid
    });
    this.mesh = new THREE.Mesh(geometry, material);

    // Create and add edges outline
    const edgesGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xede9e4 });
    this.edgesOutline = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    this.mesh.add(this.edgesOutline);

    this.handles = [];
    this.createHandles();
  }

  adjustToTargetVolume() {
    const currentVolume = this.width * this.height * this.depth;
    if (currentVolume <= 0) {
      // Avoid division by zero or issues with non-positive dimensions
      const side = Math.cbrt(TARGET_VOLUME);
      this.width = side;
      this.height = side;
      this.depth = side;
      return;
    }
    const scaleFactor = Math.cbrt(TARGET_VOLUME / currentVolume);
    this.width *= scaleFactor;
    this.height *= scaleFactor;
    this.depth *= scaleFactor;
  }

  updateDimension(changedDimension, newValue) {
    if (newValue <= 0.01) newValue = 0.01; // Prevent zero or negative dimensions, use a small minimum

    let oldWidth = this.width;
    let oldHeight = this.height;
    let oldDepth = this.depth;

    if (changedDimension === "width") {
      this.width = newValue;
      if (oldHeight > 0 && oldDepth > 0 && this.width > 0) {
        const targetHeightDepthProduct = TARGET_VOLUME / this.width;
        const oldHeightDepthProduct = oldHeight * oldDepth;
        if (oldHeightDepthProduct > 0) {
          const scaleRatio = Math.sqrt(
            targetHeightDepthProduct / oldHeightDepthProduct
          );
          this.height = oldHeight * scaleRatio;
          this.depth = oldDepth * scaleRatio;
        } else {
          // If old product was zero, try to make them equal
          this.height = this.depth = Math.sqrt(targetHeightDepthProduct);
        }
      } else {
        // Fallback if prior dimensions were invalid for ratio calculation
        const side = Math.cbrt(TARGET_VOLUME / this.width);
        this.height = side;
        this.depth = side;
      }
    } else if (changedDimension === "height") {
      this.height = newValue;
      if (oldWidth > 0 && oldDepth > 0 && this.height > 0) {
        const targetWidthDepthProduct = TARGET_VOLUME / this.height;
        const oldWidthDepthProduct = oldWidth * oldDepth;
        if (oldWidthDepthProduct > 0) {
          const scaleRatio = Math.sqrt(
            targetWidthDepthProduct / oldWidthDepthProduct
          );
          this.width = oldWidth * scaleRatio;
          this.depth = oldDepth * scaleRatio;
        } else {
          this.width = this.depth = Math.sqrt(targetWidthDepthProduct);
        }
      } else {
        const side = Math.cbrt(TARGET_VOLUME / this.height);
        this.width = side;
        this.depth = side;
      }
    } else if (changedDimension === "depth") {
      this.depth = newValue;
      if (oldWidth > 0 && oldHeight > 0 && this.depth > 0) {
        const targetWidthHeightProduct = TARGET_VOLUME / this.depth;
        const oldWidthHeightProduct = oldWidth * oldHeight;
        if (oldWidthHeightProduct > 0) {
          const scaleRatio = Math.sqrt(
            targetWidthHeightProduct / oldWidthHeightProduct
          );
          this.width = oldWidth * scaleRatio;
          this.height = oldHeight * scaleRatio;
        } else {
          this.width = this.height = Math.sqrt(targetWidthHeightProduct);
        }
      } else {
        const side = Math.cbrt(TARGET_VOLUME / this.depth);
        this.width = side;
        this.height = side;
      }
    }

    // Final adjustment to ensure volume is as close to TARGET_VOLUME as possible
    // due to potential floating point inaccuracies.
    this.adjustToTargetVolume();

    // Ensure no dimension became NaN or zero after adjustments
    this.width = Math.max(0.01, this.width || 0.01);
    this.height = Math.max(0.01, this.height || 0.01);
    this.depth = Math.max(0.01, this.depth || 0.01);

    this.updateGeometry();
    this.updateHandles();
    // console.log(`Updated: ${changedDimension} to ${newValue.toFixed(2)}. New Dims: W:${this.width.toFixed(2)} H:${this.height.toFixed(2)} D:${this.depth.toFixed(2)}. Volume: ${(this.width * this.height * this.depth).toFixed(2)}`);
  }

  updateGeometry() {
    this.mesh.geometry.dispose(); // Dispose old geometry
    this.mesh.geometry = new THREE.BoxGeometry(
      this.width,
      this.height,
      this.depth
    );

    // Update edges outline
    if (this.edgesOutline) {
      this.mesh.remove(this.edgesOutline);
      this.edgesOutline.geometry.dispose();
      // Material can be reused if it doesn't change, or re-created if it might
    }
    const newEdgesGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
    // Assuming edgesMaterial is defined in the scope or recreated
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xede9e4 });
    this.edgesOutline = new THREE.LineSegments(newEdgesGeometry, edgesMaterial);
    this.mesh.add(this.edgesOutline);
  }

  createHandles() {
    // Create 8 corner handles (small spheres)
    const handleGeometry = new THREE.SphereGeometry(0.075, 12, 12); // Made handles smaller
    const handleMaterial = new THREE.MeshBasicMaterial({
      color: 0xede9e4, // Changed to specified off-white/gray
      transparent: true,
      opacity: 0.8,
    });

    for (let i = 0; i < 8; i++) {
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);
      handle.userData.isHandle = true;
      handle.userData.id = i; // To identify which corner
      this.handles.push(handle);
      this.mesh.add(handle); // Add handles as children of the cube
    }
    this.updateHandles();
  }

  updateHandles() {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const halfD = this.depth / 2;

    const positions = [
      new THREE.Vector3(halfW, halfH, halfD), // Front-Top-Right
      new THREE.Vector3(-halfW, halfH, halfD), // Front-Top-Left
      new THREE.Vector3(halfW, -halfH, halfD), // Front-Bottom-Right
      new THREE.Vector3(-halfW, -halfH, halfD), // Front-Bottom-Left
      new THREE.Vector3(halfW, halfH, -halfD), // Back-Top-Right
      new THREE.Vector3(-halfW, halfH, -halfD), // Back-Top-Left
      new THREE.Vector3(halfW, -halfH, -halfD), // Back-Bottom-Right
      new THREE.Vector3(-halfW, -halfH, -halfD), // Back-Bottom-Left
    ];

    this.handles.forEach((handle, i) => {
      handle.position.copy(positions[i]);
    });
  }

  getMesh() {
    return this.mesh;
  }
}
