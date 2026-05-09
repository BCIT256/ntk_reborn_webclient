import * as PIXI from 'pixi.js';

export const PALETTE_VERT = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}
`;

export const PALETTE_FRAG = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;       // Grayscale index texture
uniform sampler2D uMaskSampler;   // RGBA mask texture
uniform sampler2D uPaletteSampler;// Master palette texture
uniform float uPaletteRow;        // Row index in the palette texture (normalized 0.0-1.0)
uniform float uAnimOffset;        // Animation tick offset
uniform int uAnimRangeCount;      // Number of active animation ranges
uniform vec2 uAnimRanges[8];      // Array of [min_index, max_index]

void main(void) {
    // Read the red channel as our 8-bit index
    vec4 indexColor = texture2D(uSampler, vTextureCoord);
    float index = indexColor.r * 255.0;

    // Background / transparent pixel
    if (index == 0.0) {
        discard;
    }

    // Apply color-cycling animation if within any range
    for (int i = 0; i < 8; i++) {
        if (i >= uAnimRangeCount) break;
        
        float minIdx = uAnimRanges[i].x;
        float maxIdx = uAnimRanges[i].y;
        
        if (index >= minIdx && index <= maxIdx) {
            float rangeSize = (maxIdx - minIdx) + 1.0;
            float offset = mod(uAnimOffset, rangeSize);
            index = index + offset;
            
            if (index > maxIdx) {
                index = minIdx + (index - maxIdx - 1.0);
            }
        }
    }

    // Lookup color in the palette texture
    // X is (index + 0.5) / 256.0 to sample the center of the pixel
    vec2 paletteCoord = vec2((index + 0.5) / 256.0, uPaletteRow);
    vec4 finalColor = texture2D(uPaletteSampler, paletteCoord);

    // Apply the mask texture's alpha
    vec4 maskColor = texture2D(uMaskSampler, vTextureCoord);
    finalColor.a *= maskColor.a;

    gl_FragColor = finalColor;
}
`;

/**
 * Creates a new PIXI.Filter for palette swapping and color cycling.
 */
export function createPaletteFilter(
    maskTex: PIXI.Texture,
    palTex: PIXI.Texture,
    row: number,
    animRanges: [number, number][]
): PIXI.Filter {
    const paddedRanges = new Float32Array(16); // 8 vec2s
    for (let i = 0; i < animRanges.length && i < 8; i++) {
        paddedRanges[i * 2] = animRanges[i][0];
        paddedRanges[i * 2 + 1] = animRanges[i][1];
    }

    const uniforms = {
        uMaskSampler: maskTex,
        uPaletteSampler: palTex,
        uPaletteRow: row,
        uAnimOffset: 0.0,
        uAnimRangeCount: animRanges.length,
        uAnimRanges: paddedRanges
    };

    return new PIXI.Filter(PALETTE_VERT, PALETTE_FRAG, uniforms);
}
