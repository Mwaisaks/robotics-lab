# Starter notes (IWSDK 1.1.0, mixed reality / passthrough, TypeScript)

1. `iwsdk.config.json` is the project manifest: AR mode, `offer: "always"`, WebXR features handTracking, anchors, planeDetection, meshDetection; SDK features grabbing, physics, sceneUnderstanding on (locomotion and environmentRaycast off); emulator device `metaQuest3` in `sunlit_living_room`.
2. `src/index.ts` calls `World.create(container, projectOptions)` with options from `virtual:iwsdk-project` (the manifest), then registers `RobotSystem` and `PanelSystem`.
3. The scene is declarative: `public/scenes/main.iwsdk.scene.json` holds nodes (plinths, graphite objects, robot, welcome panel, lights) with transforms and components.
4. Interactions are components on scene nodes, e.g. `RayInteractable` + `DistanceGrabbable { movementMode: "MoveFromTarget" }` on the graphite cube. No hand math in our code.
5. `src/assets.ts` (`defineAssets`) maps asset keys used by the scene: procedural meshes from `src/scene-assets/*.scene-asset.ts`, the robot glTF from the jsDelivr `@iwsdk/example-assets` CDN (lazy), and `.uikitml` panels from `public/ui/`.
6. `src/components.ts` (`defineComponents`) registers custom components; the only one is `Robot` (`src/robot-component.ts`, `createComponent('Robot', {})`).
7. Systems use `createSystem({ queryName: { required: [Components] } })`; `RobotSystem` turns the robot toward `this.player.head` each `update()` and plays its audio when the `Pressed` component appears (`queries.robotClicked.subscribe('qualify', ...)`).
8. `src/panel.ts` gets the welcome panel via `world.getSceneObject<UIKitMLAsset>('welcome-panel')`, wires `xr-button`/`exit-button` to `world.launchXR()`/`world.exitXR()`, and toggles them on `world.visibilityState`.
9. UI is `.uikitml` markup (horizon kit, dark scheme); elements are found by id and changed with `setProperties`. Audio lives in `public/audio/`.
10. Dev: `npm run dev` (Vite on port 8081, HTTPS, host 0.0.0.0, IWER emulator injected); `vite.config.ts` only adds `iwsdkDev()` plus dedupe for three/uikit. Build output goes to `dist/` with `base: './'` (static hosting friendly).
