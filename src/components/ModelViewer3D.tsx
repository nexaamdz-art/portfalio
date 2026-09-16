import { useEffect, useRef, useState } from 'react';
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
import { RotateCcw } from 'lucide-react';

interface ModelViewer3DProps {
  modelUrl?: string;
  className?: string;
}

export default function ModelViewer3D({
  modelUrl = '/models/hijabgirl.glb',
  className = '',
}: ModelViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState<number>(0);

  // Refs for animation & Three.js objects
  const uniformsRef = useRef<DissolveUniforms>(createDissolveUniforms(0xc084fc));
  const particleSystemsRef = useRef<DissolveParticleSystem[]>([]);
  const isAnimatingRef = useRef<boolean>(true);
  const animDirectionRef = useRef<number>(-1); // -1 = appearing (progress decreasing), +1 = dissolving
  const loopPauseTimerRef = useRef<number>(0);

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
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
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

      // Collect meshes first to avoid mutating children during traversal
      const meshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          meshes.push(child as THREE.Mesh);
        }
      });

      // Apply emissive dissolve shader to meshes & attach particle clouds
      for (const mesh of meshes) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => applyDissolveToMaterial(mat, uniformsRef.current));
          } else {
            applyDissolveToMaterial(mesh.material, uniformsRef.current);
          }
        }

        try {
          const particles = createDissolveParticles(mesh, uniformsRef.current);
          model.add(particles.points);
          particleSystemsRef.current.push(particles);
        } catch (err) {
          console.warn('Particle creation note:', err);
        }
      }

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
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} when fetching ${url}`);
          }

          const contentLength = response.headers.get('content-length');
          const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

          if (!response.body) {
            const arrayBuffer = await response.arrayBuffer();
            if (isDisposed) return;
            await new Promise<void>((resolve, reject) => {
              loader.parse(
                arrayBuffer,
                '',
                (gltf) => {
                  if (!isDisposed) {
                    setupModel(gltf.scene);
                  }
                  resolve();
                },
                (err) => reject(err)
              );
            });
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

          if (isDisposed) return;

          // Combine chunks into single Uint8Array
          const fullBuffer = new Uint8Array(receivedBytes);
          let offset = 0;
          for (const chunk of chunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
          }

          setProgress(100);

          await new Promise<void>((resolve, reject) => {
            loader.parse(
              fullBuffer.buffer,
              '',
              (gltf) => {
                if (!isDisposed) {
                  setupModel(gltf.scene);
                }
                resolve();
              },
              (parseErr) => reject(parseErr)
            );
          });
          return;
        } catch (err) {
          lastError = err;
          // Try next candidate URL
        }
      }

      if (isDisposed) return;

      // If all candidate URLs failed via fetch/parse, fallback to standard loader.load
      try {
        await new Promise<void>((resolve, reject) => {
          loader.load(
            modelUrl,
            (gltf) => {
              if (!isDisposed) {
                setupModel(gltf.scene);
              }
              resolve();
            },
            (xhr) => {
              if (xhr.total > 0) {
                setProgress(Math.round((xhr.loaded / xhr.total) * 100));
              }
            },
            (err) => reject(err)
          );
        });
      } catch (err) {
        console.error('All model loading methods failed:', lastError || err);
        if (!isDisposed) {
          setHasError(true);
          setLoading(false);
        }
      }
    };

    loadModelAsset();

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        }
      }
    });
    resizeObserver.observe(container);

    // 9. Animation loop with dissolve appearance animation & particles
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
      for (const system of particleSystemsRef.current) {
        system.update(delta);
      }

      // Animate gradual appearance / dissolve
      if (isAnimatingRef.current) {
        if (loopPauseTimerRef.current > 0) {
          loopPauseTimerRef.current -= delta;
        } else {
          // Speed: complete transition in ~2.8 seconds
          const speed = 3.8;
          uniformsRef.current.uProgress.value += animDirectionRef.current * speed * delta;

          const currentProgress = uniformsRef.current.uProgress.value;

          // Check boundary when appearing (-5.5 = fully materialized)
          if (animDirectionRef.current === -1 && currentProgress <= -5.5) {
            uniformsRef.current.uProgress.value = -5.5;
            isAnimatingRef.current = false;
          }

          // Check boundary when dissolving (+5.5 = fully invisible)
          if (animDirectionRef.current === 1 && currentProgress >= 5.5) {
            uniformsRef.current.uProgress.value = 5.5;
            isAnimatingRef.current = false;
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
      for (const system of particleSystemsRef.current) {
        system.dispose();
      }
      particleSystemsRef.current = [];
      renderer.dispose();
      renderer.forceContextLoss();
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
            <span className="text-slate-300 text-sm">Failed to load 3D model</span>
            <button
              id="retry-load-model-btn"
              onClick={handleRetry}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition active:scale-95 shadow-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
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
