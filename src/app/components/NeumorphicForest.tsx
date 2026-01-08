import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function NeumorphicForest() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    
    // Greyscale neumorphic background
    const bgColor = 0xc8c8c8;
    scene.background = new THREE.Color(bgColor);
    // Denser fog for depth and atmosphere
    scene.fog = new THREE.Fog(0xb0b0b0, 15, 60);

    // Camera - corridor perspective view
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 2);
    camera.lookAt(0, 3, -50);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting - corridor lighting with greyscale tones
    const ambientLight = new THREE.AmbientLight(0xd0d0d0, 0.6);
    scene.add(ambientLight);

    // Overhead strip lights running down the corridor (static, no blinking)
    for (let i = 0; i < 15; i++) {
      const stripLight = new THREE.RectAreaLight(0xffffff, 3, 2, 0.3);
      stripLight.position.set(0, 5.5, -5 - i * 5);
      stripLight.rotation.x = -Math.PI / 2;
      scene.add(stripLight);
    }

    // Side lighting for neumorphic depth - greyscale tones
    const sideLight1 = new THREE.DirectionalLight(0xd0d0d0, 0.7);
    sideLight1.position.set(8, 5, -20);
    sideLight1.castShadow = true;
    sideLight1.shadow.camera.left = -15;
    sideLight1.shadow.camera.right = 15;
    sideLight1.shadow.camera.top = 10;
    sideLight1.shadow.camera.bottom = -10;
    sideLight1.shadow.camera.near = 0.1;
    sideLight1.shadow.camera.far = 100;
    scene.add(sideLight1);

    const sideLight2 = new THREE.DirectionalLight(0xc0c0c0, 0.5);
    sideLight2.position.set(-8, 5, -20);
    scene.add(sideLight2);

    // Create greyscale neumorphic material
    const createNeumorphicMaterial = (baseColor: number) => {
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.4,
        metalness: 0.05,
        emissive: baseColor,
        emissiveIntensity: 0.03,
      });
    };

    // Server racks forming a corridor - ONE on each side
    const serverRacks: THREE.Group[] = [];
    const blinkingLights: { mesh: THREE.Mesh; offset: number; speed: number }[] = [];

    // Left side rack (single tall rack)
    const leftRackGroup = new THREE.Group();
    
    // Main server rack body - greyscale
    const leftRackGeometry = new THREE.BoxGeometry(1.8, 5, 40);
    const leftRack = new THREE.Mesh(
      leftRackGeometry,
      createNeumorphicMaterial(0xa8a8a8)
    );
    leftRack.position.y = 2.5;
    leftRack.castShadow = true;
    leftRack.receiveShadow = true;
    leftRackGroup.add(leftRack);

    // Front panel detail - greyscale
    const leftPanelGeometry = new THREE.BoxGeometry(1.7, 4.8, 39.5);
    const leftPanel = new THREE.Mesh(
      leftPanelGeometry,
      createNeumorphicMaterial(0x909090)
    );
    leftPanel.position.set(0, 2.5, 0);
    leftRackGroup.add(leftPanel);

    // Server units with lights running down the length - greyscale
    for (let i = 0; i < 30; i++) {
      const unitGeometry = new THREE.BoxGeometry(1.6, 0.55, 1.2);
      const unit = new THREE.Mesh(
        unitGeometry,
        createNeumorphicMaterial(0x7a7a7a)
      );
      unit.position.set(0, 0.6 + (i % 8) * 0.6, -18 + Math.floor(i / 8) * 5);
      leftRackGroup.add(unit);

      // Blinking status lights (4 per unit)
      for (let k = 0; k < 4; k++) {
        const lightGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const lightMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 2,
          metalness: 0.8,
          roughness: 0.2,
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(0.9, 0.6 + (i % 8) * 0.6, -18 + Math.floor(i / 8) * 5 + (-0.4 + k * 0.25));
        leftRackGroup.add(light);
        
        blinkingLights.push({
          mesh: light,
          offset: i * 0.2 + k * 0.1,
          speed: 0.8 + Math.random() * 0.6,
        });
      }
    }

    leftRackGroup.position.set(-4, 0, -20);
    scene.add(leftRackGroup);
    serverRacks.push(leftRackGroup);

    // Right side rack (mirror of left)
    const rightRackGroup = new THREE.Group();
    
    const rightRackGeometry = new THREE.BoxGeometry(1.8, 5, 40);
    const rightRack = new THREE.Mesh(
      rightRackGeometry,
      createNeumorphicMaterial(0xa8a8a8)
    );
    rightRack.position.y = 2.5;
    rightRack.castShadow = true;
    rightRack.receiveShadow = true;
    rightRackGroup.add(rightRack);

    const rightPanelGeometry = new THREE.BoxGeometry(1.7, 4.8, 39.5);
    const rightPanel = new THREE.Mesh(
      rightPanelGeometry,
      createNeumorphicMaterial(0x909090)
    );
    rightPanel.position.set(0, 2.5, 0);
    rightRackGroup.add(rightPanel);

    for (let i = 0; i < 30; i++) {
      const unitGeometry = new THREE.BoxGeometry(1.6, 0.55, 1.2);
      const unit = new THREE.Mesh(
        unitGeometry,
        createNeumorphicMaterial(0x7a7a7a)
      );
      unit.position.set(0, 0.6 + (i % 8) * 0.6, -18 + Math.floor(i / 8) * 5);
      rightRackGroup.add(unit);

      for (let k = 0; k < 4; k++) {
        const lightGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const lightMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 2,
          metalness: 0.8,
          roughness: 0.2,
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(-0.9, 0.6 + (i % 8) * 0.6, -18 + Math.floor(i / 8) * 5 + (-0.4 + k * 0.25));
        rightRackGroup.add(light);
        
        blinkingLights.push({
          mesh: light,
          offset: i * 0.2 + k * 0.1 + 100,
          speed: 0.8 + Math.random() * 0.6,
        });
      }
    }

    rightRackGroup.position.set(4, 0, -20);
    scene.add(rightRackGroup);
    serverRacks.push(rightRackGroup);

    // Ceiling with light strips - greyscale
    const ceilingGeometry = new THREE.PlaneGeometry(10, 100);
    const ceiling = new THREE.Mesh(
      ceilingGeometry,
      createNeumorphicMaterial(0xb8b8b8)
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 6;
    ceiling.position.z = -40;
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    // Overhead light strip housings (static, no blinking) - greyscale
    for (let i = 0; i < 15; i++) {
      const housingGeometry = new THREE.BoxGeometry(2.2, 0.15, 0.4);
      const housing = new THREE.Mesh(
        housingGeometry,
        createNeumorphicMaterial(0x9a9a9a)
      );
      housing.position.set(0, 5.9, -5 - i * 5);
      scene.add(housing);

      // Glowing light panel inside (static)
      const lightPanelGeometry = new THREE.BoxGeometry(2, 0.05, 0.3);
      const lightPanel = new THREE.Mesh(
        lightPanelGeometry,
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 1.5,
        })
      );
      lightPanel.position.set(0, 5.85, -5 - i * 5);
      scene.add(lightPanel);
    }

    // Floor - polished neumorphic tiles - greyscale
    const floorTiles: THREE.Mesh[] = [];
    for (let x = -5; x <= 5; x += 0.5) {
      for (let z = 0; z >= -80; z -= 0.5) {
        const tileGeometry = new THREE.PlaneGeometry(0.48, 0.48);
        const tile = new THREE.Mesh(
          tileGeometry,
          new THREE.MeshStandardMaterial({
            color: 0xd0d0d0,
            roughness: 0.15,
            metalness: 0.2,
            emissive: 0xd0d0d0,
            emissiveIntensity: 0.01,
          })
        );
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(x, 0.01, z);
        tile.receiveShadow = true;
        scene.add(tile);
        floorTiles.push(tile);
      }
    }

    // Animation
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const time = Date.now() * 0.001;

      // Slow forward camera movement down the corridor
      camera.position.z = 2 + Math.sin(time * 0.05) * 1;
      camera.lookAt(0, 3, -50);

      // Blinking lights animation
      blinkingLights.forEach(({ mesh, offset, speed }) => {
        const brightness = Math.abs(Math.sin(time * speed + offset));
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + brightness * 2;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
