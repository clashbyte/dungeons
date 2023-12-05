

uniform sampler2D uDiffuse;
uniform sampler2D uLightmap;
uniform sampler2D uPosition;
uniform sampler2D uNormal;
uniform sampler2D uOutline;
uniform vec2 uScreenSize;

uniform vec4 uOutlineColor;
uniform vec3 uPlayer;
uniform float uBlackWhite;

in vec2 vUv;

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

    // Sobel masks (see http://en.wikipedia.org/wiki/Sobel_operator)
    //        1 0 -1     -1 -2 -1
    //    X = 2 0 -2  Y = 0  0  0
    //        1 0 -1      1  2  1

    // You could also use Scharr operator:
    //        3 0 -3        3 10   3
    //    X = 10 0 -10  Y = 0  0   0
    //        3 0 -3        -3 -10 -3

//    float x = tleft + 2.0*left + bleft - tright - 2.0*right - bright;
//    float y = -tleft - 2.0*top - tright + bleft + 2.0 * bottom + bright;
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
    float outline = sobel(1.0 / uScreenSize, vUv);

    vec3 playerArea = position - uPlayer;
    float playerFactor = 1.0;//ceil(clamp(-dot(normalize(playerArea), normal), 0.0, 1.0));
//    playerFactor = 1.0 - pow(1.0 - playerFactor, 3.0);


    lightmap.rgb += vec3(0.1, 0.1, 0.1) * smoothstep(5.0, 2.0, length(playerArea)) * playerFactor;
    lightmap.rgb = ((lightmap.rgb - 0.5) * 1.1 + 0.5) * 1.05;

    vec3 final = diffuse.rgb * mix(vec3(1.0), lightmap.rgb, diffuse.a);

    gl_FragColor = vec4(mix(final, uOutlineColor.rgb, uOutlineColor.a * outline), 1.0);
}
