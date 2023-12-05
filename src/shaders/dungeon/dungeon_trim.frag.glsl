
uniform vec3 uPlayerClip;
uniform float uAspect;

in vec3 vWorldPos;
in vec3 vClipPos;

void main() {
    vec3 screenPos = vClipPos;
    vec3 playerPos = uPlayerClip;
    screenPos.x *= uAspect;
    playerPos.x *= uAspect;
    playerPos.z -= 0.0002;

    if (playerPos.z > screenPos.z) {
        if (distance(screenPos.xy, playerPos.xy) < 0.5) {
            discard;
        }
    }

    fragDiffuse = vec4(vec3(0.0), 1.0);
    fragPosition = vec4(vWorldPos, 1.0);
    fragNormal = vec4(vec3(0.0), 1.0);
    fragDistance = vec4(1.0);
}
