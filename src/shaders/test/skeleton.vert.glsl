
in vec3 position;

out vec3 vWorldPos;
out vec3 vLocalPos;

void main() {

    vec4 pos = vec4(position, 1.0);

    pos = modelMat * pos;
    vWorldPos = pos.xyz;

    pos = viewMat * pos;
    vLocalPos = pos.xyz;

    pos = projMat * pos;

    gl_Position = pos;
}
