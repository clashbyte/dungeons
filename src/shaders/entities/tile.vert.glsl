
in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;

uniform mat3 normalMat;

out vec2 vUv;
out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vTangent;
out vec3 vLocalPos;

void main() {
    vUv = uv;
    vNormal = normalize(normalMat * normal);
    vTangent = normalize(normalMat * tangent);

    vec4 pos = vec4(position, 1.0);

    pos = modelMat * pos;
    vWorldPos = pos.xyz;

    pos = viewMat * pos;
    vLocalPos = pos.xyz;

    pos = projMat * pos;

    gl_Position = pos;
}
