#version 300 es
SHADER_DEFINE_LIST;
precision highp float;

uniform mat4 projMat;
uniform mat4 viewMat;
uniform mat3 viewNormalMat;
uniform mat4 modelMat;

vec4 transformVertex(vec4 pos) {
    return projMat * viewMat * modelMat * pos;
}
