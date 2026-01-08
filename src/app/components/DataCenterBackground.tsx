import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DataCenterBackgroundProps {
  fullScreen?: boolean;
}

export function DataCenterBackground({ fullScreen = false }: DataCenterBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    // Variables for sun / scattering light
    let sun: THREE.Mesh | null = null;
    let scatterPlane: THREE.Mesh | null = null;
    let scatterTex: THREE.Texture | null = null;

    
    // Sky gradient background (canvas texture - blue to warm)
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#9fd5ff');
    grad.addColorStop(0.6, '#c8d9ea');
    grad.addColorStop(1, '#ffd8a8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const skyTex = new THREE.CanvasTexture(canvas);
    skyTex.magFilter = THREE.LinearFilter;
    skyTex.minFilter = THREE.LinearFilter;
    scene.background = skyTex;

    // (no white highlight texture - hills/ground will use solid snow color) 
    // Fog tuned to match the blended sky and made a bit denser for the snowy look
    scene.fog = new THREE.Fog(0xe6eef6, 20, 220);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 35, 100);
    camera.lookAt(0, 10, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting - hemisphere for bright snowy feel + subtle ambient fill
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe6eef6, 0.95);
    scene.add(hemi);
    const fill = new THREE.AmbientLight(0xf6fbff, 0.2);
    scene.add(fill);

    const sunLight = new THREE.DirectionalLight(0xfff8f0, 0.6); // slightly warm key light
    sunLight.position.set(100, 150, 50);
    sunLight.castShadow = true;
    // Limit shadow map resolution for performance
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    scene.add(sunLight);

    // Ground - snowy Himalayan look (bright white)
    const groundGeometry = new THREE.PlaneGeometry(500, 500, 80, 80);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      flatShading: true,
    });
    
    // Add terrain variation to ground
    const groundPositions = groundGeometry.attributes.position;
    for (let i = 0; i < groundPositions.count; i++) {
      const x = groundPositions.getX(i);
      const y = groundPositions.getY(i);
      // Create gentle rolling hills
      const height = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 5 + 
                     Math.sin(x * 0.05 + y * 0.03) * 2;
      groundPositions.setZ(i, height);
    }
    groundGeometry.computeVertexNormals();
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Mountains in background
    const createMountain = (x: number, z: number, height: number, color: number) => {
      // Create cone geometry and compute vertex normals
      const geometry = new THREE.ConeGeometry(height * 0.7, height, 6);
      geometry.computeVertexNormals();

      // Create per-vertex colors to add bluish shadow in valleys
      const pos = geometry.attributes.position;
      const norm = geometry.attributes.normal;
      const count = pos.count;
      const colors = new Float32Array(count * 3);

      const baseColor = new THREE.Color(color);
      const blueTint = new THREE.Color(0x7fb7ff); // bluish shadow color

      for (let i = 0; i < count; i++) {
        const ny = norm.getY(i);
        // t ~ how much the vertex faces sideways/down (valley)
        let t = THREE.MathUtils.clamp(1 - ny, 0, 1);
        // Slight bias so crevices get more tint
        t = Math.pow(t, 1.4);

        // Mix base color and blue tint by t, darken slightly in deep t
        const c = baseColor.clone().lerp(blueTint, t * 0.8);
        const shade = 1 - t * 0.15;
        c.r *= shade; c.g *= shade; c.b *= shade;

        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Use vertex colors in material so mountains show the tint
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        flatShading: true,
        vertexColors: true,
      });

      const mountain = new THREE.Mesh(geometry, material);
      mountain.position.set(x, height / 2, z);
      mountain.rotation.y = Math.random() * Math.PI;
      mountain.castShadow = true;
      scene.add(mountain);
      return mountain;
    };

    // Mountain range in background - pure snow white for crisp look
    createMountain(-60, -80, 55, 0xffffff);
    createMountain(-30, -90, 70, 0xffffff);
    createMountain(10, -85, 60, 0xffffff);
    createMountain(50, -75, 50, 0xffffff);
    createMountain(80, -90, 45, 0xffffff);
    
    // Smaller mountains / hills - greyscale
    createMountain(-80, -60, 35, 0x707070);
    createMountain(70, -55, 30, 0x686868);
    createMountain(-45, -50, 25, 0x7a7a7a);

    // keep fog cold and light for snowy view (already tuned above)

    // Greyscale rolling hills
    const createHill = (x: number, z: number, size: number, color: number = 0xf8fbff) => {
      const geometry = new THREE.SphereGeometry(size, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.9,
        flatShading: true,
      });
      const hill = new THREE.Mesh(geometry, material);
      hill.position.set(x, 0, z);
      hill.receiveShadow = true;
      hill.castShadow = true;
      scene.add(hill);
    };

    // Scatter hills across landscape - snowy white
    createHill(40, 20, 15);
    createHill(-50, 30, 12);
    createHill(60, -20, 10);
    createHill(-40, -30, 18);
    createHill(25, 50, 8);
    createHill(-70, 10, 14);
    createHill(80, 40, 11);

    // Trees - pine style
    const createTree = (x: number, z: number, scale: number = 1) => {
      const treeGroup = new THREE.Group();
      
      // Trunk - warm brown
      const trunkGeometry = new THREE.CylinderGeometry(0.4 * scale, 0.6 * scale, 4 * scale, 6);
      const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x5d4037,
        flatShading: true,
      });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 2 * scale;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Foliage layers - muted green tones with slight translucency to reduce intensity
      const foliageColors = [0x6b8f6b, 0x7aa17a, 0x8fbf8f];
      for (let i = 0; i < 3; i++) {
        const foliageGeometry = new THREE.ConeGeometry((3 - i * 0.5) * scale, (4 - i) * scale, 6);
        const foliageMaterial = new THREE.MeshStandardMaterial({
          color: foliageColors[i],
          flatShading: true,
          transparent: true,
          opacity: 0.75,
        });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = (5 + i * 2) * scale;
        foliage.castShadow = true;
        treeGroup.add(foliage);
      }

      treeGroup.position.set(x, 0, z);
      scene.add(treeGroup);
    };

    // Scatter trees across landscape - expanded forest
    const treePositions = [
      [-30, 20], [35, 15], [-20, 40], [50, 35], [-60, 5],
      [20, -15], [-45, -25], [65, 10], [-15, 55], [40, 55],
      [-70, 35], [75, -10], [-55, 50], [30, -40], [-35, -45],
      [55, 45], [-25, -10], [10, 30], [-50, -15], [70, 25],
      [15, 60], [-65, 45], [45, -30], [-10, -35], [85, 5],
      // Additional trees
      [-80, 20], [90, 30], [-42, 8], [58, -5], [-28, -18],
      [12, 45], [-68, -8], [78, 18], [-18, 28], [48, -20],
      [32, 70], [-55, 65], [68, 50], [-35, 35], [25, -50],
      [95, -15], [-85, 50], [42, 25], [-52, -35], [60, 60],
      [-12, 12], [8, -25], [-75, 15], [52, 8], [-38, 58],
    ];

    treePositions.forEach(([x, z]) => {
      createTree(x, z, 0.8 + Math.random() * 0.6);
    });

    // Low-poly clouds
    const clouds: THREE.Group[] = [];
    const createCloud = (x: number, y: number, z: number, scale: number = 1) => {
      const cloudGroup = new THREE.Group();
      const cloudMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.95,
        flatShading: true,
      });

      // Multiple icosahedrons to form cloud shape
      const positions = [
        [0, 0, 0, 5],
        [-4, 0.5, 1, 4],
        [4, 0.3, -1, 4.5],
        [-2, 1, 2, 3],
        [3, 0.8, 2, 3.5],
        [0, 1.5, 0, 3],
      ];

      positions.forEach(([px, py, pz, size]) => {
        const geometry = new THREE.IcosahedronGeometry(size * scale, 0);
        const puff = new THREE.Mesh(geometry, cloudMaterial);
        puff.position.set(px * scale, py * scale, pz * scale);
        cloudGroup.add(puff);
      });

      cloudGroup.position.set(x, y, z);
      scene.add(cloudGroup);
      clouds.push(cloudGroup);
      return cloudGroup;
    };

    // Create clouds scattered across sky
    createCloud(50, 60, -60, 1.5);
    createCloud(80, 55, -40, 1.2);
    createCloud(-60, 65, -50, 1.4);
    createCloud(-30, 58, -70, 1);
    createCloud(20, 70, -80, 1.3);
    createCloud(-80, 52, -30, 1.1);
    createCloud(100, 62, -55, 0.9);

    // Parachutes (lightweight animated elements)
    const parachutes: THREE.Group[] = [];
    const createParachute = (x: number, y: number, z: number, scale = 1, color = 0xcc4444) => {
      const group = new THREE.Group();

      // Canopy - half-sphere scaled
      const canopyGeo = new THREE.SphereGeometry(4 * scale, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const canopyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.scale.set(1, 0.5, 1);
      canopy.position.set(0, 0, 0);
      canopy.castShadow = true;
      group.add(canopy);

      // (ropes removed for a cleaner parachute look)

      // Payload - small seated figure (box + head)
      const payload = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.8 * scale, 0.4 * scale), new THREE.MeshStandardMaterial({ color: 0x666666 }));
      body.position.set(0, -3 * scale, 0);
      payload.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 8, 8), new THREE.MeshStandardMaterial({ color: 0x888888 }));
      head.position.set(0, -2.4 * scale, 0);
      payload.add(head);
      group.add(payload);

      group.position.set(x, y, z);
      // store small metadata
      (group as any).userData = { offset: Math.random() * Math.PI * 2, scale };
      scene.add(group);
      parachutes.push(group);
      return group;
    };

    // spawn a few parachutes at start
    createParachute(-60, 80, -60, 1.0, 0xcc5555);
    createParachute(30, 95, -70, 0.9, 0xaa7733);
    createParachute(80, 85, -50, 1.1, 0x8844aa);

    // Small buildings / village
    const createBuilding = (x: number, z: number, height: number) => {
      const geometry = new THREE.BoxGeometry(3, height, 3);
      const material = new THREE.MeshStandardMaterial({
        color: 0xc0c0c0,
        roughness: 0.6,
        flatShading: true,
      });
      const building = new THREE.Mesh(geometry, material);
      building.position.set(x, height / 2, z);
      building.castShadow = true;
      scene.add(building);

      // Roof - greyscale
      const roofGeometry = new THREE.ConeGeometry(2.5, 2, 4);
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: 0x909090,
        flatShading: true,
      });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.set(x, height + 1, z);
      roof.rotation.y = Math.PI / 4;
      scene.add(roof);
    };

    // Expanded village cluster
    createBuilding(25, 5, 5);
    createBuilding(30, 8, 6);
    createBuilding(22, 10, 4);
    createBuilding(28, 2, 7);
    createBuilding(33, 5, 5);
    // Additional buildings
    createBuilding(20, 6, 5);
    createBuilding(35, 3, 6);
    createBuilding(18, 12, 4);
    createBuilding(27, 14, 5);
    createBuilding(32, 10, 7);
    createBuilding(24, -2, 4);
    createBuilding(38, 7, 5);
    createBuilding(21, 3, 6);
    createBuilding(29, 11, 5);
    createBuilding(36, 1, 4);

    // Animation
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const time = Date.now() * 0.001;

      // Slow camera orbit
      camera.position.x = Math.sin(time * 0.03) * 100;
      camera.position.z = Math.cos(time * 0.03) * 100;
      camera.lookAt(0, 10, 0);

      // Animate clouds floating gently
      clouds.forEach((cloud, i) => {
        cloud.position.x += Math.sin(time * 0.15 + i) * 0.015;
        cloud.position.y += Math.sin(time * 0.2 + i * 0.5) * 0.008;
      });

      // Animate parachutes: descend slowly and drift horizontally
      parachutes.forEach((p) => {
        const meta = (p as any).userData || { offset: 0, scale: 1 };
        p.position.y -= 0.02 * meta.scale;
        p.position.x += Math.sin(time * 0.3 + meta.offset) * 0.03;
        p.rotation.y += 0.002 * meta.scale;
        // reset if below ground
        if (p.position.y < -5) p.position.y = 100 + Math.random() * 40;
      });



      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);

      if (ground) {
        try { ground.geometry.dispose(); } catch {}
        try { (ground.material as THREE.Material).dispose(); } catch {}
      }

      // Dispose parachutes
      parachutes.forEach((p) => {
        try {
          p.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
              else child.material.dispose();
            }
          });
          scene.remove(p);
        } catch (e) {}
      });

// Dispose sky texture if present
      try {
        if (skyTex) {
          skyTex.dispose();
        }
      } catch (e) {}

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className={fullScreen ? "fixed inset-0" : "w-full h-full"} />;
}
