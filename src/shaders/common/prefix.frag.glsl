#version 300 es
// DEFINE_LIST
#define gl_FragColor outColor
precision highp float;

#ifdef OFFSCREEN_PASS
layout(location=0) out vec4 fragDiffuse;
layout(location=1) out vec4 fragPosition;
layout(location=2) out vec4 fragNormal;
layout(location=3) out vec4 fragDistance;
#else
out vec4 outColor;
#endif
