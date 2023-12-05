
uniform sampler2D uPosition;
uniform sampler2D uNormal;
uniform sampler2D uShadowMap;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform float uLightRange;

in vec4 vUv;

#define TEXEL_SIZE 1.0 / 256.0

#ifdef SHADOW_MAP
vec2 cubeToUV( vec3 v, float texelSizeY ) {

    // Number of texels to avoid at the edge of each square

    vec3 absV = abs( v );

    // Intersect unit cube

    float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
    absV *= scaleToCube;

    // Apply scale to avoid seams

    // two texels less per square (one texel will do for NEAREST)
    v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );

    // Unwrap

    // space: -1 ... 1 range for each square
    //
    // #X##		dim    := ( 4 , 2 )
    //  # #		center := ( 1 , 1 )

    vec2 planar = v.xy;

    float almostATexel = 1.5 * texelSizeY;
    float almostOne = 1.0 - almostATexel;

    if ( absV.z >= almostOne ) {

        if ( v.z > 0.0 )
        planar.x = 4.0 - v.x;

    } else if ( absV.x >= almostOne ) {

        float signX = sign( v.x );
        planar.x = v.z * signX + 2.0 * signX;

    } else if ( absV.y >= almostOne ) {

        float signY = sign( v.y );
        planar.x = v.x + 2.0 * signY + 2.0;
        planar.y = v.z * signY - 2.0;

    }

    // Transform to UV space

    // scale := 0.5 / dim
    // translate := ( center + 0.5 ) / dim
    return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );

}

float sampleShadow(vec3 normal, float len, float nDotL) {
    float dist = texture(uShadowMap, cubeToUV(normal, TEXEL_SIZE)).r;
    if (dist + 0.05 < len) {
        return 0.0;
    }
    return 1.0;
}
#endif

void main() {
    vec2 uv = (vUv.xy / vUv.w) * 0.5 + 0.5;
    vec3 position = texture(uPosition, uv).xyz;
    vec3 normal = normalize(texture(uNormal, uv).xyz);

    vec3 dir = position - uLightPosition;
    vec3 ndir = normalize(dir);
    float ndotl = max(dot(-ndir, normal), 0.0);
    float power = 0.0;
    if (ndotl > 0.0) {
        float len = length(dir);

        power = 1.0 - pow(len / uLightRange, 2.0);
        power *= 1.0 - pow(1.0 - ndotl, 2.0);

        #ifdef SHADOW_MAP
        vec2 offset = vec2(-1, 1) * 2.0 * TEXEL_SIZE;
        power *= (
                sampleShadow( ndir + offset.xyy, len, ndotl) +
                sampleShadow( ndir + offset.yyy, len, ndotl) +
                sampleShadow( ndir + offset.xyx, len, ndotl) +
                sampleShadow( ndir + offset.yyx, len, ndotl) +
                sampleShadow( ndir, len, ndotl) +
                sampleShadow( ndir + offset.xxy, len, ndotl) +
                sampleShadow( ndir + offset.yxy, len, ndotl) +
                sampleShadow( ndir + offset.xxx, len, ndotl) +
                sampleShadow( ndir + offset.yxx, len, ndotl)
        ) * ( 1.0 / 9.0 );
        #endif
    }


    outColor = vec4(uLightColor * power, 1.0);
}
