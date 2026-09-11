# umicat-template-3d

The starter a new **3D** Umicat game is forked from — the 3D sibling of
`umicat-template`.

```
@umicat/platform-sdk     identity · saves · gameData · rooms · ai · voice · dialogue
        ▲
@umicat/three-sdk        scene3d format · loader · physics · character · input
        ▲
   this template         one scene, one character, one crate that falls
```

`package.json` carries `"umicat": { "runtime": "three" }`. That marker is how
everything downstream — project creation, workspace restore, SDK updates, the
build and the publish path — can tell which runtime a game is, without guessing
from its dependencies.

## Status

**Not yet wired into project creation.** `agent-session-service` forks
`umicat-template` unconditionally today; routing on the runtime marker is the
next piece (see `umicat-design/plans/3d-platform-integration-experiment.md`).
Until then this is forked by hand.
