

uniform sampler2D uDiffuse;
uniform sampler2D uLightmap;
uniform sampler2D uPosition;
uniform sampler2D uNormal;
uniform sampler2D uOutline;
uniform sampler2D uSSAO;
uniform vec2 uScreenSize;
uniform vec3 uAmbient;

uniform vec4 uOutlineColor;
uniform vec3 uPlayer;
uniform float uBlackWhite;

in vec2 vUv;

// Uchimura 2017, "HDR theory and practice"
// Math: https://www.desmos.com/calculator/gslcdxvipg
// Source: https://www.slideshare.net/nikuque/hdr-theory-and-practicce-jp
vec3 uchimura(vec3 x, float P, float a, float m, float l, float c, float b) {
    float l0 = ((P - m) * l) / a;
    float L0 = m - m / a;
    float L1 = m + (1.0 - m) / a;
    float S0 = m + l0;
    float S1 = m + a * l0;
    float C2 = (a * P) / (P - S1);
    float CP = -C2 / P;

    vec3 w0 = vec3(1.0 - smoothstep(0.0, m, x));
    vec3 w2 = vec3(step(m + l0, x));
    vec3 w1 = vec3(1.0 - w0 - w2);

    vec3 T = vec3(m * pow(x / m, vec3(c)) + b);
    vec3 S = vec3(P - (P - S1) * exp(CP * (x - S0)));
    vec3 L = vec3(m + a * (x - m));

    return T * w0 + L * w1 + S * w2;
}

vec3 uchimura(vec3 x) {
    const float P = 1.0;  // max display brightness
    const float a = 1.0;  // contrast
    const float m = 0.22; // linear section start
    const float l = 0.4;  // linear section length
    const float c = 1.33; // black
    const float b = 0.0;  // pedestal

    return uchimura(x, P, a, m, l, c, b);
}

float uchimura(float x, float P, float a, float m, float l, float c, float b) {
    float l0 = ((P - m) * l) / a;
    float L0 = m - m / a;
    float L1 = m + (1.0 - m) / a;
    float S0 = m + l0;
    float S1 = m + a * l0;
    float C2 = (a * P) / (P - S1);
    float CP = -C2 / P;

    float w0 = 1.0 - smoothstep(0.0, m, x);
    float w2 = step(m + l0, x);
    float w1 = 1.0 - w0 - w2;

    float T = m * pow(x / m, c) + b;
    float S = P - (P - S1) * exp(CP * (x - S0));
    float L = m + a * (x - m);

    return T * w0 + L * w1 + S * w2;
}

float uchimura(float x) {
    const float P = 1.0;  // max display brightness
    const float a = 1.0;  // contrast
    const float m = 0.22; // linear section start
    const float l = 0.4;  // linear section length
    const float c = 1.33; // black
    const float b = 0.0;  // pedestal

    return uchimura(x, P, a, m, l, c, b);
}

vec3 czm_luminance(vec3 rgb) {
    // Algorithm from Chapter 10 of Graphics Shaders.
    const vec3 W = vec3(0.2125, 0.7154, 0.0721);
    return vec3(dot(rgb, W));
}

float sobel(vec2 step, vec2 center){
    float tleft     = texture(uOutline, center + vec2(-step.x,step.y)).r;
    float left      = texture(uOutline, center + vec2(-step.x,0.0)).r;
    float bleft     = texture(uOutline, center + vec2(-step.x,-step.y)).r;
    float top       = texture(uOutline, center + vec2(0.0,step.y)).r;
    float bottom    = texture(uOutline, center + vec2(0.0,-step.y)).r;
    float tright    = texture(uOutline, center + vec2(step.x,step.y)).r;
    float right     = texture(uOutline, center + vec2(step.x,0.0)).r;
    float bright    = texture(uOutline, center + vec2(step.x,-step.y)).r;
    float x =
        tleft * 3.0 + tright * -3.0 +
        left * 10.0 + right * -10.0 +
        bleft * 3.0 + bright * -3.0;
    float y =
        tleft * 3.0 + top * 10.0 + tright * 3.0 +
        bleft * -3.0 + bottom * -10.0 + bright * -3.0;

    float color = sqrt((x*x) + (y*y));
    return color;
}

void main() {
    vec4 diffuse = texture(uDiffuse, vUv);
    vec4 lightmap = texture(uLightmap, vUv);
    vec3 position = texture(uPosition, vUv).rgb;
    vec3 normal = texture(uNormal, vUv).rgb;
    float ssao = texture(uSSAO, vUv).r;
    float outline = sobel(1.0 / uScreenSize, vUv);

    vec3 playerArea = position - uPlayer;
    float playerFactor = 0.0;//ceil(clamp(-dot(normalize(playerArea), normal), 0.0, 1.0));
//    playerFactor = 1.0 - pow(1.0 - playerFactor, 3.0);


    lightmap.rgb += vec3(0.1, 0.1, 0.1) * smoothstep(5.0, 2.0, length(playerArea)) * playerFactor;
//    lightmap.rgb = ((lightmap.rgb - 0.5) * 1.1 + 0.5) * 1.05;
//    lightmap.rgb = vec3(1.0);

    vec3 final = diffuse.rgb * mix(vec3(1.0), lightmap.rgb + uAmbient * ssao, diffuse.a);
    final = uchimura(final);

    gl_FragColor = vec4(mix(final, uOutlineColor.rgb, uOutlineColor.a * outline), 1.0);

//    gl_FragColor.rgb = mix(diffuse.rgb, texture(uSSAO, vUv).rrr, step(0.5, vUv.x));
//    gl_FragColor.rgb = lightmap.rgb;
}
