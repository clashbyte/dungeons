
in vec3 position;

out vec2 vUv;

void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position, 1.0);
}
