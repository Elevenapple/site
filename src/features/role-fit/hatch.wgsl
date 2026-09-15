// paprikaf neo wait-skin: paper/ink diagonal hatch + light grain/line-field.
// Density 1→3 tightens the field. No bloom, prism, or dark gallery look.

struct Params {
  paper: vec4f,
  ink: vec4f,
  density: f32,
  time: f32,
  width: f32,
  height: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let px = vec2f(uv.x * params.width, uv.y * params.height);
  let stage = clamp(params.density, 1.0, 3.0);

  // Primary -45° hatch; gap shrinks as Compare stages land.
  let gap = mix(14.0, 6.0, (stage - 1.0) / 2.0);
  let stroke = mix(1.0, 1.35, (stage - 1.0) / 2.0);
  let diagonal = (px.x + px.y) * 0.70710678;
  let band = abs(fract(diagonal / gap) - 0.5) * gap;
  let hatch = 1.0 - smoothstep(0.0, stroke, band);

  // Secondary line-field kicks in from stage 2.
  let gap2 = gap * 1.85;
  let diagonal2 = (px.x - px.y) * 0.70710678;
  let band2 = abs(fract(diagonal2 / gap2) - 0.5) * gap2;
  let cross = select(
    0.0,
    1.0 - smoothstep(0.0, stroke * 0.75, band2),
    stage > 1.5
  );

  // Soft paper grain — barely drifts with time.
  let grain = (hash21(px * 0.37 + vec2f(params.time * 9.0, params.time * 3.0)) - 0.5);

  let opacity = mix(0.055, 0.145, (stage - 1.0) / 2.0);
  let inkAmt = clamp(hatch * opacity + cross * opacity * 0.35 + grain * 0.028, 0.0, 0.22);
  let rgb = mix(params.paper.rgb, params.ink.rgb, inkAmt);
  return vec4f(rgb, 1.0);
}
