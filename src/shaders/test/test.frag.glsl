
uniform sampler2D uDiffuse;

in vec2 vUv;
in vec3 vWorldPos;

void main() {
    vec3 color = texture(uDiffuse, vUv).rgb;
    color = (color - 0.5) * 1.0 + 0.5;
    gl_FragColor = vec4(color, 1.0);
}
