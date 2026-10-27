// Kaustika — světelná síť od vln; stejný výpočet pro hladinu i pro dno pod vodou.
export function causticGlsl() {
  return `
float causticHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float causticNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = causticHash(i);
  float b = causticHash(i + vec2(1.0, 0.0));
  float c = causticHash(i + vec2(0.0, 1.0));
  float d = causticHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float causticPattern(vec2 p, vec2 dir, float time) {
  float phase = dot(p, dir) * 1.6 - time * 0.9;
  float a = sin(phase + causticNoise(p * 0.55 + vec2(time * 0.15, -time * 0.12)) * 5.0);
  float b = sin(phase * 1.7 + 2.1 + causticNoise(p * 0.75 - vec2(time * 0.11, time * 0.16)) * 5.0);
  return pow(abs(a * b), 1.5);
}
`;
}
