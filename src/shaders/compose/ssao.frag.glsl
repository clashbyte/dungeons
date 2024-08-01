
uniform sampler2D uPosition;
uniform sampler2D uNormal;
uniform sampler2D uNoise;
uniform sampler2D uDepth;
uniform vec2 uNoiseScale;
uniform mat4 uViewMat;
uniform mat3 uNormalMat;
uniform vec3 uKernel[KERNEL_SIZE];

in vec2 vUv;

void main() {
    vec3 position = texture(uPosition, vUv).xyz;
    vec3 normal = normalize(texture(uNormal, vUv).xyz);
    vec3 noise = texture(uNoise, vUv * uNoiseScale * 0.1).xyz * 2.0 - 1.0;

    vec3 tangent = normalize(noise - normal * dot(noise, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);

    float occlusion = 0.0;
    for(int i = 0; i < 1; ++i) {
        // get sample position
        vec3 samplePos = position + normalize(TBN * uKernel[i]) * 0.5;
        vec4 offset = vec4(samplePos, 1.0);
        offset      = uViewMat * offset;
        offset.xyz /= offset.w;
        offset.xyz  = offset.xyz * 0.5 + 0.5;

        occlusion = texture(uDepth, vUv).r;

//        occlusion += clamp(distance(targetPos, screenPos), 0.0, 1.0);
    }
//    occlusion = 1.0 - (occlusion / float(KERNEL_SIZE));
    occlusion = 1.0 - occlusion;

    outColor = vec4(occlusion, 1.0, 1.0, 1.0);
}
