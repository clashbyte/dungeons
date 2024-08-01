
uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform float uReveal;
uniform float uAlpha;

in vec2 vUv;
in vec3 vWorldPos;
in vec3 vLocalPos;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vClipPos;
in vec3 vPlayerClip;

#include ../lib/perlin.glsl

void main() {

    if (uAlpha < 1.0 && vWorldPos.y > 0.1) {
        float alphaFactor = cnoise(vWorldPos * 4.0) * 0.5 + 0.5;
        if (uAlpha <= alphaFactor) {
            discard;
        }
    }

    vec3 diffuse = texture(uDiffuse, vUv).rgb;
    vec3 normalTex = (texture(uNormal, vUv).rgb * 2.0 - 1.0);

    mat3 TBN = mat3(vTangent, normalize(cross(vNormal, vTangent)), vNormal);
    vec3 normal = normalize(TBN * normalTex);

    fragDiffuse = vec4(diffuse * uReveal, 1.0);
    fragPosition = vec4(vLocalPos, 1.0);
    fragNormal = vec4(normal, 1.0);
    fragDistance = vec4(length(vLocalPos));
}
