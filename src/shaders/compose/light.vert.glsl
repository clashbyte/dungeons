
in vec3 position;

out vec4 vUv;

void main() {

    gl_Position = projMat * viewMat * modelMat * vec4(position, 1.0);
    vUv = gl_Position;
}
