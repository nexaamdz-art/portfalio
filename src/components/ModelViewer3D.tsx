import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// @ts-ignore
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  createDissolveUniforms,
  applyDissolveToMaterial,
  createDissolveParticles,
  type DissolveUniforms,
  type DissolveParticleSystem,
} from '../utils/dissolveShader';
import { Sparkles, Play, Pause, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface ModelViewer3DProps {
  modelUrl?: string;
  className?: string;
}

const COLOR_PRESETS = [
  { name: 'Purple Glow', hex: '#c084fc', colorInt: 0xc084fc },
  { name: 'Cyan Neon', hex: '#38bdf8', colorInt: 0x38bdf8 },
  { name: 'Emerald Wave', hex: '#34d399', colorInt: 0x34d399 },
  { name: 'Golden Sun', hex: '#fbbf24', colorInt: 0xfbbf24 },
  { name: 'Crimson Rose', hex: '#fb7185', colorInt: 0xfb7185 },
];

export default function ModelViewer3D({
  modelUrl = '/models/hijabgirl.glb',
  className = '',
}: ModelViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Dissolve effect states
  const [dissolvePercent, setDissolvePercent] = useState<number>(100);
  const [isAutoLooping, setIsAutoLooping] = useState<boolean>(false);
  const [activeColor, setActiveColor] = useState<string>(COLOR_PRESETS[0].hex);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [loadAttempt, setLoadAttempt] = useState<number>(0);

  // Refs for animation & Three.js objects
  const uniformsRef = useRef<DissolveUniforms>(createDissolveUniforms(0xc084fc));
  const particleSystemRef = useRef<DissolveParticleSystem | null>(null);
  const isAnimatingRef = useRef<boolean>(true);
  const isAutoLoopingRef = useRef<boolean>(false);
  const animDirectionRef = useRef<number>(-1); // -1 = appearing (progress decreasing), +1 = dissolving
  const loopPauseTimerRef = useRef<number>(0);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Synchronize autoLoop ref
  useEffect(() => {
    isAutoLoopingRef.current = isAutoLooping;
  }, [isAutoLooping]);

  // Handle color change
  const handleColorChange = (hex: string, colorInt: number) => {
    setActiveColor(hex);
    uniformsRef.current.uEdgeColor.value.set(colorInt);
  };

  // Trigger replay of gradual appearance
  const handleReplayDissolve = () => {
    uniformsRef.current.uProgress.value = 5.5;
    animDirectionRef.current = -1;
    isAnimatingRef.current = true;
    loopPauseTimerRef.current = 0;
    setDissolvePercent(0);
  };

  // Handle manual progress slider change
  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDissolvePercent(val);
    isAnimatingRef.current = false;
    setIsAutoLooping(false);
    // map 0% (hidden) -> 5.5, 100% (fully appeared) -> -5.5
    const mappedProgress = 5.5 - (val / 100) * 11.0;
    uniformsRef.current.uProgress.value = mappedProgress;
  };

  const handleRetry = () => {
    setLoading(true);
    setHasError(false);
    setProgress(0);
    setLoadAttempt((prev) => prev + 1);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDisposed = false;
    let animationFrameId: number;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      1000
    );
    camera.position.set(0, 0.4, 3.2);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.replaceChildren(renderer.domElement);

    // 4. Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 1.8;
    controlsRef.current = controls;

    // 5. Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0x818cf8, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xa855f7, 1.5);
    fillLight.position.set(2, -2, 2);
    scene.add(fillLight);

    const backLight = new THREE.PointLight(0x60a5fa, 2.0, 10);
    backLight.position.set(0, 2, -2);
    scene.add(backLight);

    // 6. Model Root Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Helper to setup loaded GLTF scene
    const setupModel = (model: THREE.Group) => {
      if (isDisposed) return;

      // Auto-center and normalize model scale
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center model inside pivot and orient face forward (+Z towards camera)
      const pivot = new THREE.Group();
      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;
      pivot.add(model);

      // Rotate so the face is oriented directly towards the camera (+Z)
      pivot.rotation.y = -83.4 * (Math.PI / 180);

      // Scale model to comfortably fill viewport
      const maxDim = Math.max(size.x, size.y, size.z);
      const desiredScale = 2.0 / (maxDim || 1);
      modelGroup.scale.setScalar(desiredScale);
      modelGroup.position.y = -0.05;

      // Start in invisible state for gradual appearance
      uniformsRef.current.uProgress.value = 5.5;
      isAnimatingRef.current = true;
      animDirectionRef.current = -1;

      // Apply emissive dissolve shader to all meshes & attach particle cloud
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = false;
          mesh.receiveShadow = false;

          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => applyDissolveToMaterial(mat, uniformsRef.current));
            } else {
              applyDissolveToMaterial(mesh.material, uniformsRef.current);
            }
          }

          // Create and attach the burning glowing particles
          try {
            const particles = createDissolveParticles(mesh, uniformsRef.current);
            model.add(particles.points);
            particleSystemRef.current = particles;
          } catch (err) {
            console.warn('Particle creation note:', err);
          }
        }
      });

      modelGroup.add(pivot);
      setLoading(false);
    };

    // 7. Robust Model Loading with candidate URL fallbacks & Meshopt decoder check
    const loadModelAsset = async () => {
      const loader = new GLTFLoader();
      try {
        if (MeshoptDecoder) {
          if ('ready' in MeshoptDecoder && MeshoptDecoder.ready instanceof Promise) {
            await MeshoptDecoder.ready;
          }
          loader.setMeshoptDecoder(MeshoptDecoder);
        }
      } catch (e) {
        console.warn('MeshoptDecoder init warning:', e);
      }

      // Candidate URLs
      const clean = modelUrl.replace(/^\/+/, '');
      const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
      const base = (metaEnv?.BASE_URL || '/').replace(/\/+$/, '');
      const candidateUrls = [
        modelUrl,
        `/${clean}`,
        `${base}/${clean}`,
        `./${clean}`,
      ];

      let lastError: unknown = null;

      for (const url of candidateUrls) {
        if (isDisposed) return;
        try {
          // Attempt direct fetch to verify accessibility & support chunked loading
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} when fetching ${url}`);
          }

          const contentLength = response.headers.get('content-length');
          const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

          if (!response.body) {
            const arrayBuffer = await response.arrayBuffer();
            loader.parse(
              arrayBuffer,
              '',
              (gltf) => setupModel(gltf.scene),
              (err) => {
                throw err;
              }
            );
            return;
          }

          // Stream chunks to update progress smoothly
          const reader = response.body.getReader();
          let receivedBytes = 0;
          const chunks: Uint8Array[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              receivedBytes += value.length;
              if (totalBytes > 0) {
                const pct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
                setProgress(pct);
              }
            }
          }

          // Combine chunks into single Uint8Array
          const fullBuffer = new Uint8Array(receivedBytes);
          let offset = 0;
          for (const chunk of chunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
          }

          setProgress(100);

          loader.parse(
            fullBuffer.buffer,
            '',
            (gltf) => setupModel(gltf.scene),
            (parseErr) => {
              throw parseErr;
            }
          );
          return;
        } catch (err) {
          lastError = err;
          // Try next candidate URL
        }
      }

      // If all candidate URLs failed, fallback to standard loader.load
      loader.load(
        modelUrl,
        (gltf) => setupModel(gltf.scene),
        (xhr) => {
          if (xhr.total > 0) {
            setProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (err) => {
          console.error('All model loading methods failed:', lastError || err);
          if (!isDisposed) {
            setHasError(true);
            setLoading(false);
          }
        }
      );
    };

    loadModelAsset();

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    // 9. Animation loop with dissolve progress animation & particles
    let lastTime = performance.now();
    const startTime = lastTime;

    const animate = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsedTime = (now - startTime) / 1000;

      // Subtle breathing / floating animation
      if (modelGroup) {
        modelGroup.position.y = -0.05 + Math.sin(elapsedTime * 1.6) * 0.04;
      }

      // Update particle physics (sparks and wave turbulence)
      if (particleSystemRef.current) {
        particleSystemRef.current.update(delta);
      }

      // Animate gradual appearance / dissolve
      if (isAnimatingRef.current) {
        if (loopPauseTimerRef.current > 0) {
          loopPauseTimerRef.current -= delta;
        } else {
          // Speed: complete transition in ~2.8 seconds
          const speed = 3.8;
          uniformsRef.current.uProgress.value += animDirectionRef.current * speed * delta;

          // Compute percent for slider UI (0% to 100%)
          const currentProgress = uniformsRef.current.uProgress.value;
          const currentPct = Math.round(
            Math.max(0, Math.min(100, ((5.5 - currentProgress) / 11.0) * 100))
          );
          setDissolvePercent(currentPct);

          // Check boundary when appearing (-5.5 = fully materialized)
          if (animDirectionRef.current === -1 && currentProgress <= -5.5) {
            uniformsRef.current.uProgress.value = -5.5;
            setDissolvePercent(100);
            if (isAutoLoopingRef.current) {
              // Pause at fully appeared before dissolving again
              loopPauseTimerRef.current = 1.2;
              animDirectionRef.current = 1;
            } else {
              isAnimatingRef.current = false;
            }
          }

          // Check boundary when dissolving (+5.5 = fully invisible)
          if (animDirectionRef.current === 1 && currentProgress >= 5.5) {
            uniformsRef.current.uProgress.value = 5.5;
            setDissolvePercent(0);
            if (isAutoLoopingRef.current) {
              loopPauseTimerRef.current = 0.6;
              animDirectionRef.current = -1;
            } else {
              isAnimatingRef.current = false;
            }
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 10. Cleanup
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (particleSystemRef.current) {
        particleSystemRef.current.dispose();
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl, loadAttempt]);

  return (
    <div
      id="hero-3d-wrapper"
      className={`relative w-full h-[480px] sm:h-[550px] lg:h-[650px] xl:h-[720px] flex items-center justify-center ${className}`}
    >
      {/* Background radial blue/purple glow behind the 3D model */}
      <div
        id="hero-3d-glow"
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[420px] lg:w-[480px] h-[300px] sm:h-[420px] lg:h-[480px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none"
      />

      {/* Loading state indicator */}
      {loading && !hasError && (
        <div
          id="hero-3d-loader"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none z-10"
        >
          <div className="w-12 h-12 rounded-full border-2 border-blue-400/20 border-t-blue-400 animate-spin" />
          <span className="text-xs font-sans-modern text-blue-200/70 tracking-widest uppercase">
            Loading Model {progress > 0 ? `${progress}%` : ''}
          </span>
        </div>
      )}

      {/* Error state fallback */}
      {hasError && (
        <div
          id="hero-3d-error"
          className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-300 font-sans-modern text-sm z-20"
        >
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-5 max-w-xs flex flex-col items-center gap-3 shadow-2xl">
            <span className="text-slate-300 text-sm">تعذر تحميل المجسم ثلاثي الأبعاد</span>
            <span className="text-xs text-slate-400">Failed to load 3D model</span>
            <button
              id="retry-load-model-btn"
              onClick={handleRetry}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition active:scale-95 shadow-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة / Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Canvas container */}
      <div
        id="hero-3d-canvas-container"
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      />


    </div>
  );
}

