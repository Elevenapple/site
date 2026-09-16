// Role-fit wait field — the moving light over the plate's stage colour.
//
// The plate's base colour is CSS (a pale tint per stage, transitioned), so the
// colour story survives without WebGPU. This pass only adds the light moving
// across it, drawn premultiplied so the CSS underneath shows through.
//
// Two sweeps travel left to right at a constant speed. Constant on purpose:
// the stage carries progress, the motion only says the work is still running.

struct Params {
  reading: vec4f,
  matching: vec4f,
  drafting: vec4f,
  stage: f32,
  time: f32,
  width: f32,
  height: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

const TAU = 6.28318530718;

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn stageTint(s: f32) -> vec3f {
  let early = mix(params.reading.rgb, params.matching.rgb, clamp(s - 1.0, 0.0, 1.0));
  let late = mix(params.matching.rgb, params.drafting.rgb, clamp(s - 2.0, 0.0, 1.0));
  return select(early, late, s > 2.0);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let s = clamp(params.stage, 1.0, 3.0);
  let tint = stageTint(s);
  let t = params.time;
  let px = vec2f(uv.x * params.width, uv.y * params.height);

  // One cycle across the width keeps this a gradient rather than stripes.
  let sweep = 0.5 + 0.5 * sin((uv.x - t * 0.15) * TAU);
  let drift = 0.5 + 0.5 * sin((uv.x * 1.55 + uv.y * 0.8 - t * 0.095) * TAU);

  // Narrow bright core, long falloff: light crossing a surface rather than a
  // block pulsing on and off.
  let field = pow(sweep, 2.6) * 0.66 + pow(drift, 3.4) * 0.34;

  // Anchored along the bottom edge so the plate sits down rather than floats.
  let ground = mix(0.45, 1.0, smoothstep(0.0, 1.0, uv.y));

  // Paper-scale grain, enough to stop a wide plate banding.
  let grain = (hash21(px * 0.6 + vec2f(t * 13.0, t * 7.0)) - 0.5) * 0.03;

  let alpha = clamp(field * ground * 0.5 + grain, 0.0, 0.55);

  // Premultiplied: the surface is configured that way so the plate's CSS tint
  // reads through everywhere this pass is dim.
  return vec4f(tint * alpha, alpha);
}
