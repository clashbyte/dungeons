
uniform sampler2D uPosition;
uniform sampler2D uNormal;
uniform sampler2D uNoise;
uniform vec2 uNoiseScale;
uniform mat4 uProjMat;
uniform vec3 uKernel[KERNEL_SIZE];

in vec2 vUv;

const float RADIUS = 0.1;
const float BIAS = 0.005;

void main() {
    vec3 position = texture(uPosition, vUv).xyz;
    vec3 normal = normalize(texture(uNormal, vUv).xyz);
    vec3 noise = texture(uNoise, vUv * uNoiseScale).xyz * 2.0 - 1.0;

    vec3 tangent = normalize(noise - normal * dot(noise, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);

    float occlusion = 0.0;
    for(int i = 0; i < KERNEL_SIZE; ++i) {
        // get sample position
        vec4 offset = vec4(position + normalize(TBN * uKernel[i]) * RADIUS, 1.0);
        offset      = uProjMat * offset;
        offset.xyz /= offset.w;
        offset.xyz  = offset.xyz * 0.5 + 0.5;
        float sampleDepth = texture(uPosition, offset.xy).z;

        float rangeCheck = smoothstep(0.0, 1.0, RADIUS / abs(position.z - sampleDepth));
        occlusion       += (sampleDepth >= position.z + BIAS ? 1.0 : 0.0) * rangeCheck;

//        occlusion += clamp(distance(targetPos, screenPos), 0.0, 1.0);
    }
    occlusion = 1.0 - (occlusion / float(KERNEL_SIZE));
//    occlusion = 1.0 - occlusion;

    outColor = vec4(occlusion, 1.0, 1.0, 1.0);
}
