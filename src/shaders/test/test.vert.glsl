
in vec3 position;
in vec3 normal;
in vec2 uv;

out vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projMat * viewMat * modelMat * vec4(position, 1.0);
}
