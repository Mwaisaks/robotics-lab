import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  AmbientLight,
  DirectionalLight,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from '@iwsdk/core';
import { buildRoomBoxes, mergeBoxes, splitByGroup, type RoomBox } from './room-layout.js';

function meshFrom(boxes: readonly RoomBox[], material: MeshStandardMaterial | MeshBasicMaterial, name: string): Mesh {
  const merged = mergeBoxes(boxes);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(merged.position, 3));
  geometry.setAttribute('normal', new BufferAttribute(merged.normal, 3));
  geometry.setAttribute('color', new BufferAttribute(merged.color, 3));
  geometry.setIndex(new BufferAttribute(merged.index, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false; // static inside the room root
  mesh.updateMatrix();
  return mesh;
}

/**
 * The whole lab room as 2 meshes (= 2 draw calls): matte vertex-coloured boxes and
 * self-lit boxes (window, ceiling lights). No textures, no shadows.
 */
export function createLabRoom(): Group {
  const [lit, glow] = splitByGroup(buildRoomBoxes());
  const root = new Group();
  root.name = 'lab-room';
  root.add(
    meshFrom(lit, new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }), 'lab-room-matte'),
    meshFrom(glow, new MeshBasicMaterial({ vertexColors: true }), 'lab-room-glow'),
  );
  // Bright, even lab light. Children of the room, so they only exist while the room
  // is shown (browser mode); the headset keeps its own passthrough lighting.
  const ambient = new AmbientLight(0xffffff, 0.9);
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(1.5, 3, 2);
  key.castShadow = false;
  root.add(ambient, key, key.target);
  return root;
}
