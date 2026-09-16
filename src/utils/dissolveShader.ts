import * as THREE from 'three';

// 3D Simplex Noise GLSL implementation from Jatin Chopra's emissive-dissolve-effect
export const snoiseGLSL = `
vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}
vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}
float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    // Permutations
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export interface DissolveUniforms {
  uEdgeColor: { value: THREE.Color };
  uFreq: { value: number };
  uAmp: { value: number };
  uProgress: { value: number };
  uEdge: { value: number };
}

export function createDissolveUniforms(initialColor = 0xc084fc): DissolveUniforms {
  return {
    uEdgeColor: { value: new THREE.Color(initialColor) },
    uFreq: { value: 3.2 },
    uAmp: { value: 2.8 },
    uProgress: { value: 6.0 }, // starts hidden (fully dissolved), animates down to -6.0 (fully appeared)
    uEdge: { value: 0.55 },
  };
}

/**
 * Injects the emissive dissolve effect into a MeshStandardMaterial / MeshPhysicalMaterial
 */
export function applyDissolveToMaterial(
  material: THREE.Material,
  uniforms: DissolveUniforms
) {
  const stdMat = material as THREE.MeshStandardMaterial;
  stdMat.side = THREE.DoubleSide;
  stdMat.customProgramCacheKey = () => 'emissive_dissolve_mat';

  stdMat.onBeforeCompile = (shader) => {
    // Inject uniforms
    shader.uniforms.uFreq = uniforms.uFreq;
    shader.uniforms.uAmp = uniforms.uAmp;
    shader.uniforms.uProgress = uniforms.uProgress;
    shader.uniforms.uEdge = uniforms.uEdge;
    shader.uniforms.uEdgeColor = uniforms.uEdgeColor;

    // Vertex shader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vDissolvePos;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vDissolvePos = position;
      `
    );

    // Fragment shader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vDissolvePos;
      uniform float uFreq;
      uniform float uAmp;
      uniform float uProgress;
      uniform float uEdge;
      uniform vec3 uEdgeColor;
      ${snoiseGLSL}
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      // 3D Simplex noise with inverted vertical gradient for organic appearance from bottom to top
      float dissolveNoise = snoise(vDissolvePos * uFreq) * uAmp - (vDissolvePos.y * 1.8);
      
      // If noise is below progress threshold, fragment has not yet appeared
      if (dissolveNoise < uProgress) discard;

      // Glowing emissive burn edge on the front of appearance
      float edgeWidth = uProgress + uEdge;
      if (dissolveNoise >= uProgress && dissolveNoise < edgeWidth) {
        float edgeFactor = 1.0 - ((dissolveNoise - uProgress) / uEdge);
        vec3 edgeGlow = uEdgeColor * (1.8 + 3.2 * edgeFactor);
        gl_FragColor = vec4(mix(gl_FragColor.rgb, edgeGlow, edgeFactor), 1.0);
      }
      `
    );
  };

  material.needsUpdate = true;
}

export interface DissolveParticleSystem {
  points: THREE.Points;
  update: (delta: number) => void;
  dispose: () => void;
}

/**
 * Creates the glowing dissolve particle system adapted from Jatin Chopra's implementation
 */
export function createDissolveParticles(
  mesh: THREE.Mesh,
  uniforms: DissolveUniforms,
  particleTextureUrl = '/particle.png'
): DissolveParticleSystem {
  const geo = mesh.geometry;
  if (!geo || !geo.attributes || !geo.attributes.position || geo.attributes.position.count === 0) {
    const emptyPoints = new THREE.Points();
    return {
      points: emptyPoints,
      update: () => {},
      dispose: () => {},
    };
  }
  const posAttr = geo.attributes.position;
  const totalVertices = posAttr.count;

  // Sample ~14,000 - 18,000 particles across the mesh surface for buttery 60 FPS
  const targetCount = 16000;
  const step = Math.max(1, Math.floor(totalVertices / targetCount));
  const particleCount = Math.floor(totalVertices / step);

  const particleGeo = new THREE.BufferGeometry();
  const initPositions = new Float32Array(particleCount * 3);
  const currentPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const offsets = new Float32Array(particleCount);
  const angles = new Float32Array(particleCount);
  const dists = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const srcIdx = i * step;
    const x = posAttr.getX(srcIdx);
    const y = posAttr.getY(srcIdx);
    const z = posAttr.getZ(srcIdx);

    initPositions[i * 3 + 0] = x;
    initPositions[i * 3 + 1] = y;
    initPositions[i * 3 + 2] = z;

    currentPositions[i * 3 + 0] = x;
    currentPositions[i * 3 + 1] = y;
    currentPositions[i * 3 + 2] = z;

    // Scaled to match the model size
    offsets[i] = Math.random() * 0.25 + 0.08;

    // Velocity outward from center + gentle upward drift
    const signX = Math.sign(x) || 1;
    const signZ = Math.sign(z) || 1;
    velocities[i * 3 + 0] = (Math.random() * 0.4 + 0.1) * signX;
    velocities[i * 3 + 1] = Math.random() * 0.5 + 0.2;
    velocities[i * 3 + 2] = (Math.random() * 0.4 + 0.1) * signZ;

    angles[i] = Math.random() * Math.PI * 2;
    dists[i] = 0.001;
  }

  const currentPosAttr = new THREE.BufferAttribute(currentPositions, 3);
  const distAttr = new THREE.BufferAttribute(dists, 1);
  const angleAttr = new THREE.BufferAttribute(angles, 1);

  particleGeo.setAttribute('position', new THREE.BufferAttribute(initPositions, 3));
  particleGeo.setAttribute('aCurrentPos', currentPosAttr);
  particleGeo.setAttribute('aDist', distAttr);
  particleGeo.setAttribute('aAngle', angleAttr);

  let particleTexture: THREE.Texture;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.25)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    particleTexture = new THREE.CanvasTexture(canvas);
  } catch {
    const textureLoader = new THREE.TextureLoader();
    particleTexture = textureLoader.load(particleTextureUrl);
  }

  const particleMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uTexture: { value: particleTexture },
      uPixelDensity: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uProgress: uniforms.uProgress,
      uEdge: uniforms.uEdge,
      uAmp: uniforms.uAmp,
      uFreq: uniforms.uFreq,
      uBaseSize: { value: 45.0 },
      uColor: uniforms.uEdgeColor,
    },
    vertexShader: `
      ${snoiseGLSL}
      uniform float uPixelDensity;
      uniform float uBaseSize;
      uniform float uFreq;
      uniform float uAmp;
      uniform float uEdge;
      uniform float uProgress;
      varying float vNoise;
      varying float vAngle;
      varying float vDist;
      attribute vec3 aCurrentPos;
      attribute float aDist;
      attribute float aAngle;

      void main() {
        vec3 pos = position;
        float noise = snoise(pos * uFreq) * uAmp - (pos.y * 1.8);
        vNoise = noise;
        vAngle = aAngle;
        vDist = aDist;

        // When around the dissolve front, particle detaches and follows simulated path
        if (vNoise >= uProgress - 0.8 && vNoise <= uProgress + uEdge + 0.8) {
          pos = aCurrentPos;
        }

        vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        gl_Position = projectionMatrix * viewPosition;

        float size = uBaseSize * uPixelDensity;
        size = size / (aDist * 5.0 + 1.0);
        gl_PointSize = max(1.0, size / -viewPosition.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uEdge;
      uniform float uProgress;
      uniform sampler2D uTexture;
      varying float vNoise;
      varying float vAngle;
      varying float vDist;

      void main() {
        // Discard if outside the active dissolve band
        if (vNoise < uProgress) discard;
        if (vNoise > uProgress + uEdge + 0.3) discard;

        vec2 coord = gl_PointCoord - 0.5;
        float cosA = cos(vAngle);
        float sinA = sin(vAngle);
        mat2 rot = mat2(cosA, sinA, -sinA, cosA);
        coord = rot * coord + 0.5;

        vec4 tex = texture2D(uTexture, coord);
        float alpha = tex.a * clamp(1.0 - vDist * 3.5, 0.0, 1.0);
        if (alpha < 0.01) discard;

        // Glowing vibrant spark color
        gl_FragColor = vec4(uColor * 2.5 * tex.rgb, alpha);
      }
    `,
  });

  const points = new THREE.Points(particleGeo, particleMat);

  // Speed factor for particle drift
  const speed = 0.003;

  const update = (_delta: number) => {
    // Only update particles if we are in an active dissolve range
    const prog = uniforms.uProgress.value;
    if (prog < -5.5 || prog > 6.0) return;

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const curX = currentPositions[idx + 0];
      const curY = currentPositions[idx + 1];

      // Turbulent sine wave offset (from Jatin's repo)
      const waveX = Math.sin(curY * 12.0) * 0.001;
      const waveY = Math.cos(curX * 12.0) * 0.001;

      currentPositions[idx + 0] += velocities[idx + 0] * speed + waveX;
      currentPositions[idx + 1] += velocities[idx + 1] * speed + waveY;
      currentPositions[idx + 2] += velocities[idx + 2] * speed;

      const dx = currentPositions[idx + 0] - initPositions[idx + 0];
      const dy = currentPositions[idx + 1] - initPositions[idx + 1];
      const dz = currentPositions[idx + 2] - initPositions[idx + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dists[i] = dist;

      angles[i] += 0.03;

      // Reset when particle exceeds max travel offset
      if (dist > offsets[i]) {
        currentPositions[idx + 0] = initPositions[idx + 0];
        currentPositions[idx + 1] = initPositions[idx + 1];
        currentPositions[idx + 2] = initPositions[idx + 2];
        dists[i] = 0.001;
      }
    }

    currentPosAttr.needsUpdate = true;
    distAttr.needsUpdate = true;
    angleAttr.needsUpdate = true;
  };

  const dispose = () => {
    particleGeo.dispose();
    particleMat.dispose();
    particleTexture.dispose();
  };

  return { points, update, dispose };
}
