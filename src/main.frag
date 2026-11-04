#version 120

// (way more precision than a float can actually store...)
#define LOG_2 0.6931471805599453094172321214581765680755001

// start using these antialiasing values once you start (c)
#define AA 2
const int TOTAL_SAMPLES = AA * AA;

#define ESCAPE_RADIUS 4.0

uniform vec2 c;
uniform int MAX_ITERS;
uniform vec2 windowSizePixels;
uniform vec2 camCenterWorld;
uniform float camWorldUnitsPerPixel;

// reprojection (1d) may require extra uniforms here...
uniform int TRUE_MAX_ITERS;             
uniform vec2 oldWindowSizePixels;        
uniform vec2 oldCamCenterWorld;          
uniform float oldCamWorldUnitsPerPixel;  
uniform sampler2D prevFrame;             
uniform bool historyInvalid;             

// Use this to get a color from your smoothed Julia set escape times.
vec4 colorTime(float t) {
    return vec4(0.5 + 0.5 * cos(  0.1 * (t) + vec3(0.f, 0.35, 0.7)), 1.f);
}

struct EscapeTime {
    float iters;
    bool isInf;
};

// Escape time of iterating z^2 + c
EscapeTime escapeTimeSmooth(vec2 z) {
    const float R2 = ESCAPE_RADIUS * ESCAPE_RADIUS;
    for (int k = 0; k < MAX_ITERS; ++k) {
        // z holds z_k. If |z_k| > R, the discrete escape time is n = k + 1.
        if (dot(z, z) > R2) {
            float n = float(k + 1);
            return EscapeTime(n + 1.0 - log(log(length(z))) / LOG_2, false);
        }
        // z_{k+1} = z_k^2 + c, using (a + bi)^2 = (a^2 - b^2) + 2abi
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    }
    return EscapeTime(0.0, true);
}


// Window coords follow gl_FragCoord: origin at the bottom-left, y up.
vec2 windowToWorld(vec2 windowCoords) {
    return camCenterWorld + (windowCoords - 0.5 * windowSizePixels) * camWorldUnitsPerPixel;
}

// For reprojection
vec2 worldToOldWindow(vec2 worldCoords) {
    return (worldCoords - oldCamCenterWorld) / oldCamWorldUnitsPerPixel
           + 0.5 * oldWindowSizePixels;
}

// For SSAA
// Given (dx, dy) in [0, AA)^2, suppose the unit square [0, 1)^2 was cut up into AA equal
// partitions along each dimension. delta((dx, dy)) returns the center of the sub-square
// which is in the dy'th row and dx'th column (both 0-indexed).
vec2 delta(vec2 dxy) {
    return (dxy + 0.5) / float(AA);
}


void main() {
    // gl_FragCoord.xy is the pixel center (x + 0.5, y + 0.5); get its lower-left corner.
    vec2 pixelCorner = floor(gl_FragCoord.xy);

    float alpha = historyInvalid
                      ? 1.0
                      : clamp(float(MAX_ITERS) / float(TRUE_MAX_ITERS), 0.0, 1.0);

    vec4 sum = vec4(0.0);
    for (int dy = 0; dy < AA; ++dy) {
        for (int dx = 0; dx < AA; ++dx) {
            vec2 windowPos = pixelCorner + delta(vec2(float(dx), float(dy)));
            vec2 world = windowToWorld(windowPos);

            EscapeTime et = escapeTimeSmooth(world);
            vec4 color = et.isInf ? vec4(0.0, 0.0, 0.0, 1.0) : colorTime(et.iters);

            if (alpha < 1.0) {
                vec2 oldWindowPos = worldToOldWindow(world);
                if (all(greaterThanEqual(oldWindowPos, vec2(0.0)))
                    && all(lessThan(oldWindowPos, oldWindowSizePixels))) {
                    vec4 oldColor = texture2D(prevFrame, oldWindowPos / oldWindowSizePixels);
                    color = mix(oldColor, color, alpha);
                }
            }
            sum += color;
        }
    }
    gl_FragColor = sum / float(TOTAL_SAMPLES);
}
