
uniform vec3 uPlayerClip;
uniform float uAlpha;

in vec3 vWorldPos;
in vec3 vLocalPos;
in vec3 vClipPos;

#include /lib/perlin

void main() {
    if (uAlpha < 1.0 && vWorldPos.y > 0.1) {
        float alphaFactor = cnoise(vWorldPos * 4.0) * 0.5 + 0.5;
        if (uAlpha <= alphaFactor) {
            discard;
        }
    }

    fragDiffuse = vec4(vec3(0.0), 1.0);
    fragPosition = vec4(vLocalPos, 1.0);
    fragNormal = vec4(vec3(0.0), 1.0);
    fragDistance = vec4(1.0);
}
