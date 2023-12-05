
uniform sampler2D uDiffuse;

in vec2 vUv;
in vec3 vWorldPos;
in vec3 vLocalPos;
in vec3 vNormal;

void main() {
    vec3 diffuse = texture(uDiffuse, vUv).rgb;
//    vec3 normalTex = (texture(uNormal, vUv).rgb * 2.0 - 1.0);

//    mat3 TBN = mat3(vTangent, normalize(cross(vNormal, vTangent)), vNormal);
    vec3 normal = normalize(vNormal);

//    fragDiffuse = vec4(diffuse, 1.0);
    fragDiffuse = vec4(1.0);
    fragPosition = vec4(vWorldPos, 1.0);
    fragNormal = vec4(normal, 1.0);
    fragDistance = vec4(length(vLocalPos));
}
