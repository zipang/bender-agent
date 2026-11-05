---
name: Three.js and glTF Web Pipeline
description: Optimize 3D assets (.glb and .gltf) and integrate them in interactive web animation with Three.js, React Three Fiber, GSAP, and gltf-transform. Use for compression (Draco, Meshopt, KTX2), pivot and animation setup, and web rendering.
---

# Three.js and glTF Web Pipeline

This skill covers the steps that turn a **Blender** or **vcad** model into a small `.glb` file. The file must load fast and animate easily in **Three.js**.

## 1. Export checklist for Blender and vcad

### Node names

- Name each movable part with a clear and stable name: `Head`, `Visor`, `Eye_L`, `Eye_R`, `Torso_Door`, `Wheel_FL`, `Wheel_FR`, `Steering_Wheel`.
- Three.js then finds the part with `model.getObjectByName("Torso_Door")`.

### Pivots

- Put the root origin at the center of the base of the model. In Three.js, the model then sits on the ground at `Y = 0`.
- Put each articulated part pivot on its axis of rotation. Examples: door hinge, wheel center, neck base, antenna base.

### Transforms

- Apply all transforms before export.
- Scale must be `1, 1, 1`. Rest rotation must be `0, 0, 0`.
- This rule prevents drift and shear during procedural animation.

### Geometry budget

- Join static meshes that share one material. This step reduces the draw calls.
- Keep a mesh separate only if a script animates it alone. Use a `SkinnedMesh` with an armature for soft deformation.
- Target a few thousand triangles per hero asset. Target under 1,000 triangles for background props.

## 2. CLI optimization with `@gltf-transform/cli`

The project uses Bun. Run the tool with `bunx`. `npx` also works on machines that have Node.js.

```bash
# Show meshes, textures, and animations
bunx @gltf-transform/cli inspect model.glb

# Full optimization for the web: Meshopt plus WebP plus cleanup
bunx @gltf-transform/cli optimize model.glb model-optimized.glb \
  --compress meshopt \
  --texture-compress webp \
  --texture-size 2048

# Alternative: Draco geometry compression
bunx @gltf-transform/cli draco model.glb model-draco.glb
```

### Meshopt or Draco

- **Meshopt (`EXT_meshopt_compression`)** decodes very fast. It keeps the vertex order and also compresses animation keyframes and morph targets. Use it for animated assets.
- **Draco (`KHR_draco_mesh_compression`)** gives the smallest file for dense static meshes. Examples: car bodies and scans. The decoder costs more time at startup.

### Other useful steps

```bash
# Remove duplicate meshes and unused data
bunx @gltf-transform/cli dedup model.glb model.glb

# Convert textures to KTX2 (BasisU)
bunx @gltf-transform/cli etc1s model.glb model-ktx2.glb
```

Check the file after each step. Confirm the file size, the triangle count, and the texture size.

## 3. Three.js integration

### Robust loader with Draco and Meshopt

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const gltf = await gltfLoader.loadAsync('/models/bender-optimized.glb');
const root = gltf.scene;
scene.add(root);
```

### Two animation methods

1. **Procedural animation with node transforms.** Use this method for robots, vehicles, and other rigid parts. Examples: wheel spin, door opening, head tracking, antenna sway.

```javascript
const head = root.getObjectByName('Head');
const door = root.getObjectByName('Torso_Door');
const antenna = root.getObjectByName('Antenna');

function animate(time) {
  if (antenna) {
    antenna.rotation.z = Math.sin(time * 0.005) * 0.15;
  }
  if (head) {
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetYaw, 0.1);
  }
}
```

2. **Baked clips with `THREE.AnimationMixer`.** Use this method for complex cycles that come from Blender: walk, dance, and face morphs.

```javascript
const mixer = new THREE.AnimationMixer(root);
const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle');
if (idleClip) {
  mixer.clipAction(idleClip).play();
}

// In the render loop:
// mixer.update(clock.getDelta());
```

### PBR lighting for metal parts

A metal material (`metalness > 0.8`) looks black in Three.js when nothing surrounds it. Set an environment map:

```javascript
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
```

Use `scene.environmentIntensity` to adjust the reflection strength. Keep the tone mapping at `THREE.ACESFilmicToneMapping` for metal assets.

### Performance rules

- One material per mesh group. Each material costs one draw call.
- Reuse textures. Pack small textures into one atlas.
- Set `renderer.outputColorSpace = THREE.SRGBColorSpace`. The glTF loader sets the texture color spaces.
- Use `THREE.InstancedMesh` when one asset appears many times.
- Free a model when you remove it: traverse the scene, then call `geometry.dispose()` and `material.dispose()`.
