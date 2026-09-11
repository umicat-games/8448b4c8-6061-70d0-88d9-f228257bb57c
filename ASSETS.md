# Assets

## 3D models — glTF 2.0 only

Upload `.glb` (self-contained) or `.gltf`. Anything else is converted before it
gets here. A `.glb` carries geometry, materials, skeleton, animation clips AND
textures in one file, which is why it is preferred: nothing external to resolve.

Models land in `public/assets/` and are declared in
`public/scenes3d/manifest.json`, which is also where their **animation map**
lives:

```json
{ "id": "hero", "path": "assets/character.glb", "importScale": 0.35,
  "animations": { "idle": "HumanArmature|Man_Idle", "walk": "HumanArmature|Man_Walk" } }
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

`public/assets/character.glb` is from **Quaternius' Animated Men Pack** and is
**CC0** — public domain. Commercial use, modification and redistribution, with
no attribution required. <https://quaternius.com>

That matters more here than it looks. A Umicat game ships its `.glb` to the
player's browser from a public CDN, where anyone can take it — so a licence that
merely permits "use in a game" is not enough, and a character the platform
supplies to every project is redistribution-as-a-toolkit, which many asset
licences forbid by name. CC0 removes the question instead of answering it.

**This replaced the sample `Fox.glb`, which was NOT wholly CC0**: its mesh was
CC0, but the rigging and animation — the parts a game actually leans on — were
CC-BY 4.0, so every game made from this template inherited an attribution
obligation. Apply that test to anything added here.

## The animation contract

Every clip in this file sits on ONE skeleton, and so does every other character
in that pack — measured, not assumed: a clip from a sibling character binds
**24 of 24** tracks and poses this one identically
(`umicat-3d-spike/rigtest/`). So another character can be swapped in without
retargeting — which is the one thing that does NOT work here (a cross-rig
retarget was measured returning zero matched bones and zero tracks, silently).

Available by semantic name: `idle`, `walk`, `run`, `jump`, `runningJump`,
`sit`, `clap`, `punch`, `die`. Use those; the real clip names inside the file
(`HumanArmature|Man_Idle`) belong in the manifest and nowhere else.
