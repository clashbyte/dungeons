
in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;

uniform vec3 uPlayer;

out vec2 vUv;
out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vTangent;
out vec3 vLocalPos;
out vec3 vClipPos;
out vec3 vPlayerClip;

void main() {
    vUv = uv;
    vNormal = normal;
    vTangent = tangent;

    vec4 pos = vec4(position, 1.0);

    pos = modelMat * pos;
    vWorldPos = pos.xyz;

    pos = viewMat * pos;
    vLocalPos = pos.xyz;

    pos = projMat * pos;
    vClipPos = pos.xyz / pos.w;

    vec4 player = projMat * viewMat * vec4(uPlayer, 1.0);
    vPlayerClip = player.xyz / player.w;

    gl_Position = pos;
}
