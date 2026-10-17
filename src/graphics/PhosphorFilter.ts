import { Filter, GlProgram } from 'pixi.js';
import { phosphorDecay, phosphorDiffusion } from './phosphorMath';
import type { GraphicsSettings } from './settings';

// This shader only ever samples the PREVIOUS history texture. Its output is
// rendered to a DIFFERENT texture, avoiding undefined read/write feedback.
const vertex = /* glsl */ `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  void main(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform vec3 uDecayRGB;
  uniform vec2 uTexelSize;
  uniform float uBleed;

  void main(void) {
    vec2 uv = vTextureCoord;
    vec3 oldColor = texture2D(uTexture, uv).rgb;

    // A tiny neighborhood diffusion softens the old light. Normalize the
    // kernel so bleed doesn't manufacture energy over successive frames.
    vec3 neighbors = (
      texture2D(uTexture, uv + vec2(uTexelSize.x, 0.0)).rgb +
      texture2D(uTexture, uv - vec2(uTexelSize.x, 0.0)).rgb +
      texture2D(uTexture, uv + vec2(0.0, uTexelSize.y)).rgb +
      texture2D(uTexture, uv - vec2(0.0, uTexelSize.y)).rgb
    ) * 0.25;

    vec3 phosphor = mix(oldColor, neighbors, uBleed) * uDecayRGB;
    // Keep an opaque black background within the feedback framebuffer.
    gl_FragColor = vec4(phosphor, 1.0);
  }
`;

export class PhosphorFilter extends Filter {
  constructor() {
    super({
      resolution: 'inherit',
      glProgram: new GlProgram({ vertex, fragment }),
      resources: {
        phosphorUniforms: {
          uDecayRGB: { value: new Float32Array([0, 0, 0]), type: 'vec3<f32>' },
          uTexelSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uBleed: { value: 0, type: 'f32' },
        },
      },
    });
  }

  update(dtMs: number, width: number, height: number, settings: GraphicsSettings): void {
    const uniforms = this.resources.phosphorUniforms.uniforms;
    const decay = phosphorDecay(dtMs, settings.persistenceMs, settings.colorSeparation);
    uniforms.uDecayRGB = new Float32Array(decay);
    uniforms.uTexelSize = new Float32Array([1 / Math.max(1, width), 1 / Math.max(1, height)]);
    // Keep diffusion below 25% so crisp rays retain a distinct hot core.
    uniforms.uBleed = phosphorDiffusion(dtMs, settings.phosphorBleed);
  }
}
