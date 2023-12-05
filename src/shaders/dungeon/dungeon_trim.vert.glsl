
in vec3 position;

out vec3 vWorldPos;
out vec3 vClipPos;

void main() {
    vec4 pos = vec4(position, 1.0);
    pos = modelMat * pos;
    vWorldPos = pos.xyz;
    pos = viewMat * pos;
    pos = projMat * pos;
    vClipPos = pos.xyz / pos.w;

    gl_Position = pos;
}
