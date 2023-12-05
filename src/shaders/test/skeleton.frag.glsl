
in vec3 vWorldPos;
in vec3 vLocalPos;

void main() {
    fragDiffuse = vec4(1.0, 1.0, 0.0, 0.0);
    fragPosition = vec4(vWorldPos, 1.0);
    fragNormal = vec4(1.0);
    fragDistance = vec4(length(vLocalPos));
}
