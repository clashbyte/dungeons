
in vec3 position;
in vec3 normal;
in vec2 uv;
in uvec4 joints;
in vec4 weights;

uniform mat3 normalMat;
uniform sampler2D uSkinMatrices;
uniform float uBoneCount;

out vec2 vUv;
out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vLocalPos;

#define ROW0_U 0.125
#define ROW1_U 0.375
#define ROW2_U 0.625
#define ROW3_U 0.875

mat4 getBoneMatrix(uint boneNdx) {
    float v = (float(boneNdx) + 0.5) / uBoneCount;
    return mat4(
        texture(uSkinMatrices, vec2(ROW0_U, v)),
        texture(uSkinMatrices, vec2(ROW1_U, v)),
        texture(uSkinMatrices, vec2(ROW2_U, v)),
        texture(uSkinMatrices, vec2(ROW3_U, v))
    );
}


void main() {
    vUv = uv;

    mat4 skinMat =
        getBoneMatrix(joints.x) * weights.x +
        getBoneMatrix(joints.y) * weights.y +
        getBoneMatrix(joints.z) * weights.z +
        getBoneMatrix(joints.w) * weights.w;

    mat3 skinNormalMat = mat3(transpose(inverse(skinMat)));
    vNormal = normalize(normalMat * skinNormalMat * normal);
    vNormal = normalize(viewNormalMat * vNormal);

    vec4 pos = vec4(position, 1.0);
    pos = skinMat * pos;

    pos = modelMat * pos;
    vWorldPos = pos.xyz;

    pos = viewMat * pos;
    vLocalPos = pos.xyz;

    pos = projMat * pos;

    gl_Position = pos;
}
