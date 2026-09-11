# Assets

## 3D models — glTF 2.0 only

Upload `.glb` (self-contained) or `.gltf`. Anything else is converted before it
gets here. A `.glb` carries geometry, materials, skeleton, animation clips AND
textures in one file, which is why it is preferred: nothing external to resolve.

Models land in `public/assets/` and are declared in
`public/scenes3d/manifest.json`, which is also where their **animation map**
lives:

```json
{ "id": "hero", "path": "assets/Fox.glb", "importScale": 0.035,
  "animations": { "idle": "Survey", "walk": "Walk", "run": "Run" } }
```

**Map clips by meaning, never by guessing the name.** Nothing guarantees a
model's walk cycle is called `Walk` — this one calls its idle `Survey`. The
loader fails loudly on a missing clip and lists the names the model does have.

`importScale` corrects for the fact that almost no model is authored at 1 unit
= 1 metre. Fox is authored large; 0.035 puts it at roughly a metre tall.

## Images, audio, fonts

Same as any Umicat game — upload through the Assets tool and reference from
`public/`. A 3D game still uses 2D images for UI and textures.

## Licensing

`public/assets/Fox.glb` is from Khronos' glTF-Sample-Assets. **It is not wholly
CC0**: the mesh is © 2014 PixelMannen (CC0), but the rigging and animation are
© 2014 tomkranis and the glTF conversion © 2017 @AsoboStudio and @scurest, both
**CC-BY 4.0**. The parts a game actually leans on — the rig and the clips —
require attribution. Replace it with your own character and this stops applying.
