# Glass X - real-time web asset (three.js r186)

A live WebGL version of the Blender glass X. No video: the X is a 3D model rendered in the browser with
physical glass (transmission + dispersion), reacting to pointer movement. Plays the 4 s reveal when it scrolls
into view (turn-in, violet/blue/cyan light sweep, settle to a dark glass X with a glowing violet outline).

## Run it
ES modules need a web server (not `file://`):

    cd web-x && python3 -m http.server 8000      # then open http://localhost:8000

## Embed it
Copy the whole `web-x` folder to your site, keep the import map from `index.html`, then:

```html
<div id="hero" style="width:min(90vmin,900px);aspect-ratio:1"></div>
<script type="module">
  import { mountGlassX } from './web-x/src/glass-x.js';
  const x = await mountGlassX(document.getElementById('hero'), { background: '#000' });
  // x.restart()  x.pause()  x.setTime(seconds)  x.dispose()
</script>
```

Options (see `DEFAULTS` in `src/glass-x.js`): `background` (CSS colour, or `null` for a transparent canvas),
`duration`, `autoplay`, `replayOnClick`, `introYaw` / `introSeconds` (the opening turn), `fov` / `distance` (perspective),
`pointer`, `pointerYaw`, `pointerPitch`, `pointerSmooth` (mouse turn: degrees and inertia), `edgeBurst`, `rim`, `faceHold`,
`ghost`, `endBloom`, `dispersion`, `gain`.

The X turns with the mouse over the whole window (touch: drag). Reflections change with the turn, so the glass
flashes as you move.
Everything is self-contained: three.js is vendored in `vendor/three`, the model is `assets/glass_x.glb`
(2 parts, 455 KB, geometry only).

## Notes and limits
- Glass: `MeshPhysicalMaterial` (transmission, IOR 1.5, `dispersion`, violet attenuation). It is real-time, so it is
  not identical to the Cycles render: no multi-bounce internal reflections, and refraction is screen-space.
- Light: a small "studio" of soft emissive strips plus a belt of light that draws the outline. It is re-baked into an
  environment map every frame during the 4 s reveal only (cheap), then frozen.
- `background: null` (transparent canvas) works, but bloom is skipped and the glass looks more milky over bright pages.
- Respects `prefers-reduced-motion` (shows the settled end state).
- Needs WebGL2. On phones, use `devicePixelRatio` capping (already capped at 2).
- Regenerating the model: run `spline/export_for_spline.py` in Blender (it writes `glass_x.glb`); copy to `assets/`.
