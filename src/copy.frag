#version 120

uniform sampler2D toCopy;

void main() {
    // The fullscreen triangle's texCoords map the visible screen onto [0, 1]^2 with (0, 0) at the
    // bottom-left, matching the orientation the texture was rendered with (gl_FragCoord).
    gl_FragColor = texture2D(toCopy, gl_TexCoord[0].xy);
}
