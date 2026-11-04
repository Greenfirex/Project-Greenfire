// Sdílený výpočet barvy travnaté země — tři textury míchá šum ve velkých skvrnách.
// Stejný kód používají zem i stébla, aby na sebe barvou sedly.
export const GROUND_PATCH_LARGE = 9;
export const GROUND_PATCH_SMALL = 23;

export function grassGroundGlsl() {
  return `
float groundHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float groundNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = groundHash(i);
  float b = groundHash(i + vec2(1.0, 0.0));
  float c = groundHash(i + vec2(0.0, 1.0));
  float d = groundHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec3 groundGrass(vec2 world, float tileA, float tileB, float tileC, float patchAmount) {
  vec3 base = texture2D(groundTexA, world / tileA).rgb;
  if (patchAmount < 0.5) return base;
  float n1 = groundNoise(world / ${GROUND_PATCH_LARGE.toFixed(1)});
  float n2 = groundNoise(world / ${GROUND_PATCH_SMALL.toFixed(1)} + vec2(13.0, 7.0));
  float wB = smoothstep(0.44, 0.72, n1);
  float wC = smoothstep(0.48, 0.76, n2);
  float wA = max(0.0, 1.0 - wB - wC);
  vec3 mixed = base * wA;
  mixed += texture2D(groundTexB, world / tileB + vec2(0.37, 0.11)).rgb * wB;
  mixed += texture2D(groundTexC, world / tileC + vec2(0.71, 0.29)).rgb * wC;
  return mixed;
}
`;
}
