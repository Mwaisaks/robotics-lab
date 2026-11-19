# Emulator (IWER) hand controls: cheat sheet

Sources: Testing experience guide (developers.meta.com/vr/documentation/iwsdk/guides/02-testing-experience/),
plus the emulator UI source `node_modules/@iwer/devui` v2.8.0 (`components/mapper.js` DEFAULT_KEYMAP,
`components/hand.js`, `scene.js`). The guide only spells out pinch for "Gaze + Hands" mode; the
plain-hands bindings below come from the devui source.

## Switch to hands
- Toolbar: **Toggle input mode** (controllers <-> hands). Two panels appear at the bottom: **Hand [L]** (bottom-left) and **Hand [R]** (bottom-right).
- If a panel shows a plug icon, the hand is disconnected: click the plug to reconnect it.
- **Reset device transforms** (toolbar) puts headset and hands back at the default pose.

## Move a hand (outside play mode, mouse free)
- Each hand has a small 3D gizmo (transform handle) in the view. **Drag its arrows** to move the hand.
- **Click the gizmo** to toggle between move and rotate.
- Or type values into the **Pos / Rot** fields in that hand's panel.
- Hands are attached to the player rig: move your head (Shift + W/A/S/D, Shift + Up/Down for height) and the hands come with you.

## Pinch (this is the grab with hands)
- Outside play mode: in the hand panel, **click the "Pinch" bar** (momentary press), or **drag across it** to set a partial value.
- Click the **pin icon** next to Pinch to **latch** it (hold the pinch). Click again to release. Use this to carry a part: latch, drag the gizmo, unlatch.
- In play mode (pointer locked, click the circle-play button, Esc to exit): **left hand pinch = Left mouse**, **right hand pinch = Right mouse**.
- Hand pose cycle: **F** (left), **\\** (right), or the < > arrows on the Pose row.
- The gear icon on a hand panel remaps pose/pinch keys.

## Why "nothing responds" after switching to hands
- Hands spawn at hip/controller height, often too far from objects. Near-hand grab only fires when the hand is **at the object**: move the gizmo onto the part first, then pinch.
- In play mode the left mouse button pinches the **left** hand, not the right one.

## Meta VR Glasses / gaze mode (not our target, for reference)
- Toolbar **Select input mode -> Gaze + Hands**. Pointer aims gaze; hold Left mouse = pinch with commit hand (right by default); drag = move that hand; wheel while pinching = depth; right-drag = rotate headset; Space = reset hand.
