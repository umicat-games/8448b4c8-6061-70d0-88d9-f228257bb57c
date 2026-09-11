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

## The world's unit is Kenney's, not the metre

A character here is **0.72 units tall**, not 1.8. That is deliberate: Kenney
authors its whole CC0 library — characters, furniture, trees, terrain blocks —
in one consistent unit, so every one of its ~4,700 props drops in at
`importScale: 1` and is automatically the right size standing next to the
character. Rescaling the character to "metres" instead would mean multiplying
every prop, forever.

Everything length-shaped follows from that and was scaled by the same factor
when the unit changed: entity sizes and positions, collider extents, the camera
offset, light positions, the controller's capsule/step/speed — **and gravity**,
which is length per time squared, so leaving it at 9.81 in this unit makes
everything fall as though it were tiny.

## Textures are SHARED, not embedded

`character.glb` references `Textures/colormap.png` relatively, and so does every
other Kenney asset — one 512×512 palette for the entire library. Keep it at
`public/assets/Textures/colormap.png`.

This is a deliberate exception to the "a `.glb` should be self-contained" rule
above. Embedding it would put a copy of the same 8KB palette inside every prop,
and sharing it means one request and one GPU texture for the character and all
its scenery. Without the file the model still loads and animates — it just
renders **grey**, with a single console line, which is exactly the kind of
failure that ships.

## Licensing

`public/assets/character.glb` and `Textures/colormap.png` are from **Kenney's
Mini Characters 1** and are **CC0** — public domain. Commercial use,
modification and redistribution, with no attribution required.
<https://kenney.nl>

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

All **12** characters in that pack share ONE rig and the SAME 32 clips — one
signature across all twelve, measured rather than assumed, and a clip from a
sibling character binds **7 of 7** tracks and poses this one identically
(`umicat-3d-spike/rigtest/`). So another of the twelve can be swapped in by
changing one path, with no retargeting — which is the one thing that does NOT
work here (a cross-rig retarget was measured returning zero matched bones and
zero tracks, silently).

32 clips ship, including `jump` and `fall` **separately**, `crouch`, `sit`,
`drive`, `pick-up`, `interact-*`, `holding-*` and a full wheelchair set. The
manifest maps the ones a game reaches for by semantic name; **`run` is called
`sprint` inside the file** — which is why clips are mapped by meaning and never
guessed.
