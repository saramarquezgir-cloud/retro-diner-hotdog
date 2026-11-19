import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Diner3DScene {
  constructor(containerId, callbacks = {}) {
    this.container = document.getElementById(containerId);
    this.callbacks = callbacks; // onGrillClick, onBreadClick, onToppingClick
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x191924);

    this.loader = new GLTFLoader();

    // Camera setup (first person behind counter)
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.4, 2.8);
    this.camera.lookAt(0, 0.45, -0.2);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Dynamic groups
    this.customerGroup = new THREE.Group();
    this.scene.add(this.customerGroup);
    this.customers = [null, null]; // Supports up to 2 simultaneous customers!

    this.plateGroup = new THREE.Group();
    this.scene.add(this.plateGroup);

    this.grillGroup = new THREE.Group();
    this.scene.add(this.grillGroup);

    this.breadTrayGroup = new THREE.Group();
    this.scene.add(this.breadTrayGroup);

    // 3D Sausages on Grill (for slot 0 and slot 1)
    this.grillSausages = [null, null];
    this.grillSlotsState = ['empty', 'empty'];

    // Active visual hot dog parts on plate
    this.activeBunMesh = null;
    this.activeSausageMesh = null;
    this.activeMustardMesh = null;
    this.activeKetchupMesh = null;
    this.activeOnionMeshes = [];
    this.activeCheeseMeshes = [];

    // Steam & Smoke particle pool
    this.steamParticles = [];

    // Raycaster for interactive 3D clicking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupLighting();
    this.setupEnvironment();
    this.loadDinerAssets();
    this.setupRaycasting();

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0xfff3e0, 1.3);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.0);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x2ec4b6, 2.2, 10);
    fillLight.position.set(-2, 2.2, -1.5);
    this.scene.add(fillLight);

    this.grillLight = new THREE.PointLight(0xff5500, 1.8, 3.5);
    this.grillLight.position.set(-1.1, 0.6, 0.2);
    this.scene.add(this.grillLight);
  }

  setupEnvironment() {
    // 1. Checkered Diner Floor
    const floorGeo = new THREE.PlaneGeometry(16, 16);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const size = 32;
    for (let x = 0; x < 256; x += size) {
      for (let y = 0; y < 256; y += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#ffffff' : '#1a1a24';
        ctx.fillRect(x, y, size, size);
      }
    }
    const checkerTexture = new THREE.CanvasTexture(canvas);
    checkerTexture.wrapS = THREE.RepeatWrapping;
    checkerTexture.wrapT = THREE.RepeatWrapping;
    checkerTexture.repeat.set(6, 6);

    const floorMat = new THREE.MeshStandardMaterial({
      map: checkerTexture,
      roughness: 0.3,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Retro Diner Counter Bar
    const counterGeo = new THREE.BoxGeometry(4.8, 0.9, 1.4);
    const counterMat = new THREE.MeshStandardMaterial({
      color: 0x1f7a8c, // Retro turquoise
      roughness: 0.35,
      metalness: 0.1
    });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.set(0, -0.05, 0.2);
    counter.receiveShadow = true;
    this.scene.add(counter);

    // Chrome Trim on Counter
    const trimGeo = new THREE.BoxGeometry(4.85, 0.08, 1.45);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xe0e1dd,
      roughness: 0.15,
      metalness: 0.9
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, 0.37, 0.2);
    this.scene.add(trim);

    // 3. Diner Back Wall
    const wallGeo = new THREE.PlaneGeometry(14, 8);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xfdf0d5, // Warm cream
      roughness: 0.8
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 3, -3.2);
    this.scene.add(wall);

    // Neon Sign on back wall
    const neonGeo = new THREE.BoxGeometry(3.2, 0.8, 0.05);
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const neonSign = new THREE.Mesh(neonGeo, neonMat);
    neonSign.position.set(0, 3.4, -3.15);
    this.scene.add(neonSign);

    // Setup Steam/Smoke particle pool for grill
    for (let i = 0; i < 20; i++) {
      const pGeo = new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 6, 6);
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0
      });
      const p = new THREE.Mesh(pGeo, pMat);
      p.visible = false;
      this.scene.add(p);
      this.steamParticles.push({
        mesh: p,
        life: 0,
        maxLife: 1.0 + Math.random() * 0.8,
        speedX: (Math.random() - 0.5) * 0.008,
        speedY: 0.018 + Math.random() * 0.012,
        active: false,
        isSmoke: false
      });
    }
  }

  loadDinerAssets() {
    // 1. Load Grill onto counter left side
    this.loader.load(
      '/models/grill.glb',
      (gltf) => {
        const grill = gltf.scene;
        grill.scale.set(0.38, 0.38, 0.38);
        grill.position.set(-1.15, 0.42, 0.25);
        this.grillGroup.add(grill);
      },
      undefined,
      () => {
        // Fallback procedural grill
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.15, 0.8),
          new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.8, roughness: 0.3 })
        );
        base.position.set(-1.15, 0.42, 0.25);
        this.grillGroup.add(base);
      }
    );

    // Create the two 3D sausages directly ON TOP of the grill!
    const createGrillSausage = (xPos) => {
      const sGroup = new THREE.Group();
      
      // Main sausage cylinder lying perpendicular to grill bars (along Z)
      const sGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.38, 16);
      const sMat = new THREE.MeshStandardMaterial({
        color: 0xef7a7a, // Raw pinkish sausage by default
        roughness: 0.38,
        metalness: 0.15
      });
      const mesh = new THREE.Mesh(sGeo, sMat);
      mesh.rotation.x = Math.PI / 2; // Lie along Z (across the grill bars!)
      sGroup.add(mesh);

      // Rounded end caps
      const capGeo = new THREE.SphereGeometry(0.048, 12, 12);
      const cap1 = new THREE.Mesh(capGeo, sMat);
      cap1.position.z = -0.19;
      sGroup.add(cap1);
      const cap2 = new THREE.Mesh(capGeo, sMat);
      cap2.position.z = 0.19;
      sGroup.add(cap2);

      // Char grill marks across the sausage
      const markMat = new THREE.MeshBasicMaterial({ color: 0x4a140d, visible: false });
      const marks = [];
      [-0.1, 0.0, 0.1].forEach(offsetZ => {
        const markGeo = new THREE.TorusGeometry(0.049, 0.005, 6, 16);
        const mark = new THREE.Mesh(markGeo, markMat);
        mark.position.z = offsetZ;
        sGroup.add(mark);
        marks.push(mark);
      });

      // Position Y = 0.635 so it sits right ON TOP of the grill bars!
      sGroup.position.set(xPos, 0.635, 0.25);
      sGroup.visible = false; // Hidden when slot is empty
      this.scene.add(sGroup);
      return { group: sGroup, material: sMat, markMaterial: markMat, marks };
    };

    this.grillSausages[0] = createGrillSausage(-1.28);
    this.grillSausages[1] = createGrillSausage(-0.98);

    // 2. Visual Bread Tray / Panera on the Counter
    const trayGeo = new THREE.BoxGeometry(0.48, 0.04, 0.38);
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b, // Warm wood / wicker
      roughness: 0.7
    });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.set(-0.55, 0.42, 0.3);
    this.breadTrayGroup.add(tray);

    // Buns resting in the tray
    const createTrayBun = (offsetZ, rotY) => {
      const bunGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.36, 16);
      const bunMat = new THREE.MeshStandardMaterial({
        color: 0xd9822b, // Baked golden
        roughness: 0.8
      });
      const bun = new THREE.Mesh(bunGeo, bunMat);
      bun.rotation.z = Math.PI / 2;
      bun.rotation.y = rotY;
      bun.position.set(-0.55, 0.47, 0.3 + offsetZ);

      const capGeo = new THREE.SphereGeometry(0.055, 12, 12);
      const c1 = new THREE.Mesh(capGeo, bunMat);
      c1.position.x = -0.18;
      bun.add(c1);
      const c2 = new THREE.Mesh(capGeo, bunMat);
      c2.position.x = 0.18;
      bun.add(c2);
      return bun;
    };

    this.breadTrayGroup.add(createTrayBun(-0.08, 0.05));
    this.breadTrayGroup.add(createTrayBun(0.08, -0.05));

    // 3. Assembly Plate in Center
    const plateGeo = new THREE.CylinderGeometry(0.46, 0.40, 0.035, 32);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xf8f9fa,
      roughness: 0.15,
      metalness: 0.1
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.425, 0.3);
    plate.receiveShadow = true;
    this.plateGroup.add(plate);

    // 4. Squeeze Bottles on the Right
    this.loader.load('/models/ketchup_bottle.glb', (gltf) => {
      const bot = gltf.scene;
      bot.scale.set(0.28, 0.28, 0.28);
      bot.position.set(0.95, 0.43, 0.18);
      bot.name = "ketchup_bottle";
      this.scene.add(bot);
    });

    this.loader.load('/models/mustard_bottle.glb', (gltf) => {
      const bot = gltf.scene;
      bot.scale.set(0.28, 0.28, 0.28);
      bot.position.set(1.22, 0.43, 0.32);
      bot.name = "mustard_bottle";
      this.scene.add(bot);
    });
  }

  // Update visual state of sausages on the 3D grill
  updateGrillSlot(slotIdx, state) {
    this.grillSlotsState[slotIdx] = state;
    const sObj = this.grillSausages[slotIdx];
    if (!sObj) return;

    if (state === 'empty') {
      sObj.group.visible = false;
      sObj.markMaterial.visible = false;
    } else if (state === 'cooking' || state === 'raw') {
      sObj.group.visible = true;
      sObj.material.color.setHex(0xef7a7a); // Fresh raw pink
      sObj.material.roughness = 0.4;
      sObj.markMaterial.visible = false;
      this.emitGrillSteam(slotIdx, false);
    } else if (state === 'cooked') {
      sObj.group.visible = true;
      sObj.material.color.setHex(0xa82015); // Savory cooked red-brown
      sObj.material.roughness = 0.28;
      sObj.markMaterial.visible = true; // Reveal charred grill marks!
      this.emitGrillSteam(slotIdx, false);
    } else if (state === 'burned') {
      sObj.group.visible = true;
      sObj.material.color.setHex(0x1a1111); // Burned charcoal
      sObj.material.roughness = 0.9;
      sObj.markMaterial.visible = false;
      this.emitGrillSteam(slotIdx, true); // Dark smoke
    }
  }

  // Spawn customer model in front of counter (supports slot 0 and slot 1)
  spawnCustomer(slotIdx = 0, characterId = 'customer_retro', totalSlots = 1) {
    if (this.customers[slotIdx] && this.customers[slotIdx].mesh) {
      this.customerGroup.remove(this.customers[slotIdx].mesh);
      this.customers[slotIdx] = null;
    }

    const posX = totalSlots === 1 ? 0.0 : (slotIdx === 0 ? -0.85 : 0.85);

    const onModelLoaded = (char) => {
      char.scale.set(0.48, 0.48, 0.48);
      char.position.set(posX, 0.0, -1.1);
      char.rotation.y = slotIdx === 0 ? 0.12 : (totalSlots > 1 ? -0.12 : 0);
      this.customerGroup.add(char);
      this.customers[slotIdx] = {
        mesh: char,
        basePosX: posX,
        leaving: false,
        leaveHappy: false,
        leaveT: 0,
        slotIdx
      };
    };

    this.loader.load(
      `/models/${characterId}.glb`,
      (gltf) => onModelLoaded(gltf.scene),
      undefined,
      () => {
        // Fallback procedural customer
        const g = new THREE.Group();
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xf5cb5c })
        );
        head.position.y = 1.15;
        g.add(head);

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.7, 0.35),
          new THREE.MeshStandardMaterial({ color: slotIdx === 0 ? 0x178582 : 0xd62828 })
        );
        body.position.y = 0.65;
        g.add(body);
        onModelLoaded(g);
      }
    );
  }

  customerLeave(slotIdx = 0, isHappy = true) {
    const c = this.customers[slotIdx];
    if (c) {
      c.leaving = true;
      c.leaveHappy = isHappy;
      c.leaveT = 0;
    }
  }

  // Update visual hot dog on the assembly plate
  updateAssemblyPlate(hotdogState) {
    // 1. Bun
    if (hotdogState.hasBun && !this.activeBunMesh) {
      this.loader.load('/models/bun.glb', (gltf) => {
        this.activeBunMesh = gltf.scene;
        this.activeBunMesh.scale.set(0.18, 0.18, 0.18);
        this.activeBunMesh.position.set(0, 0.46, 0.3);
        this.plateGroup.add(this.activeBunMesh);
      });
    } else if (!hotdogState.hasBun && this.activeBunMesh) {
      this.plateGroup.remove(this.activeBunMesh);
      this.activeBunMesh = null;
    }

    // 2. Sausage
    if (hotdogState.sausageState && !this.activeSausageMesh) {
      const modelName = hotdogState.sausageState === 'cooked'
        ? 'sausage_cooked.glb'
        : (hotdogState.sausageState === 'burned' ? 'sausage_burned.glb' : 'sausage_raw.glb');

      this.loader.load(`/models/${modelName}`, (gltf) => {
        this.activeSausageMesh = gltf.scene;
        this.activeSausageMesh.scale.set(0.18, 0.18, 0.18);
        this.activeSausageMesh.position.set(0, 0.54, 0.3);
        this.plateGroup.add(this.activeSausageMesh);
      });
    } else if (!hotdogState.sausageState && this.activeSausageMesh) {
      this.plateGroup.remove(this.activeSausageMesh);
      this.activeSausageMesh = null;
    }

    // 3. Mustard
    if (hotdogState.toppings.includes('mustard') && !this.activeMustardMesh) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.24, 0.61, 0.28),
        new THREE.Vector3(-0.14, 0.62, 0.33),
        new THREE.Vector3(-0.04, 0.61, 0.27),
        new THREE.Vector3(0.06, 0.62, 0.33),
        new THREE.Vector3(0.16, 0.61, 0.28),
        new THREE.Vector3(0.24, 0.62, 0.31)
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.015, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.2,
        metalness: 0.2
      });
      this.activeMustardMesh = new THREE.Mesh(tubeGeo, tubeMat);
      this.plateGroup.add(this.activeMustardMesh);
    } else if (!hotdogState.toppings.includes('mustard') && this.activeMustardMesh) {
      this.plateGroup.remove(this.activeMustardMesh);
      this.activeMustardMesh = null;
    }

    // 4. Ketchup
    if (hotdogState.toppings.includes('ketchup') && !this.activeKetchupMesh) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.23, 0.62, 0.32),
        new THREE.Vector3(-0.13, 0.61, 0.27),
        new THREE.Vector3(-0.03, 0.62, 0.33),
        new THREE.Vector3(0.07, 0.61, 0.27),
        new THREE.Vector3(0.17, 0.62, 0.32),
        new THREE.Vector3(0.23, 0.61, 0.29)
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.014, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xd62828,
        roughness: 0.2,
        metalness: 0.2
      });
      this.activeKetchupMesh = new THREE.Mesh(tubeGeo, tubeMat);
      this.plateGroup.add(this.activeKetchupMesh);
    } else if (!hotdogState.toppings.includes('ketchup') && this.activeKetchupMesh) {
      this.plateGroup.remove(this.activeKetchupMesh);
      this.activeKetchupMesh = null;
    }

    // 5. Onions
    if (hotdogState.toppings.includes('onion') && this.activeOnionMeshes.length === 0) {
      const onionMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.3 });
      for (let i = 0; i < 8; i++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), onionMat);
        box.position.set(-0.2 + i * 0.05 + (Math.random() - 0.5) * 0.02, 0.60 + Math.random() * 0.02, 0.29 + (Math.random() - 0.5) * 0.04);
        box.rotation.set(Math.random(), Math.random(), Math.random());
        this.plateGroup.add(box);
        this.activeOnionMeshes.push(box);
      }
    } else if (!hotdogState.toppings.includes('onion') && this.activeOnionMeshes.length > 0) {
      this.activeOnionMeshes.forEach(m => this.plateGroup.remove(m));
      this.activeOnionMeshes = [];
    }

    // 6. Cheese
    if (hotdogState.toppings.includes('cheese') && this.activeCheeseMeshes.length === 0) {
      const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
      for (let i = 0; i < 6; i++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.02), cheeseMat);
        box.position.set(-0.18 + i * 0.06, 0.59 + Math.random() * 0.02, 0.30 + (Math.random() - 0.5) * 0.03);
        box.rotation.y = (Math.random() - 0.5) * 0.8;
        this.plateGroup.add(box);
        this.activeCheeseMeshes.push(box);
      }
    } else if (!hotdogState.toppings.includes('cheese') && this.activeCheeseMeshes.length > 0) {
      this.activeCheeseMeshes.forEach(m => this.plateGroup.remove(m));
      this.activeCheeseMeshes = [];
    }
  }

  // Clear assembly plate
  clearAssemblyPlate() {
    this.updateAssemblyPlate({ hasBun: false, sausageState: null, toppings: [] });
  }

  // Trigger steam or smoke puff from grill
  emitGrillSteam(slotIdx = 0, isSmoke = false) {
    const p = this.steamParticles.find(sp => !sp.active);
    if (p) {
      p.active = true;
      p.life = 0;
      p.isSmoke = isSmoke;
      const xBase = slotIdx === 0 ? -1.28 : -0.98;
      p.mesh.position.set(xBase + (Math.random() - 0.5) * 0.15, 0.68, 0.25 + (Math.random() - 0.5) * 0.15);
      p.mesh.visible = true;
      p.mesh.material.color.setHex(isSmoke ? 0x333333 : 0xffffff);
      p.mesh.material.opacity = isSmoke ? 0.7 : 0.5;
    }
  }

  // Setup raycasting for interactive 3D clicks
  setupRaycasting() {
    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Check click on grill area / sausages
      if (this.callbacks.onGrillClick) {
        if (this.grillSausages[0] && this.grillSausages[0].group.visible) {
          const hits0 = this.raycaster.intersectObjects(this.grillSausages[0].group.children, true);
          if (hits0.length > 0) {
            this.callbacks.onGrillClick(0);
            return;
          }
        }
        if (this.grillSausages[1] && this.grillSausages[1].group.visible) {
          const hits1 = this.raycaster.intersectObjects(this.grillSausages[1].group.children, true);
          if (hits1.length > 0) {
            this.callbacks.onGrillClick(1);
            return;
          }
        }
      }

      // Check click on Bread Basket
      if (this.callbacks.onBreadClick) {
        const breadHits = this.raycaster.intersectObjects(this.breadTrayGroup.children, true);
        if (breadHits.length > 0) {
          this.callbacks.onBreadClick();
          return;
        }
      }
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate);
    const time = timestamp * 0.001;

    // Customer idle breathing bob & leaving animation for all active customers
    this.customers.forEach((c, idx) => {
      if (!c || !c.mesh) return;

      if (!c.leaving) {
        c.mesh.position.y = Math.sin(time * 3 + idx * 1.5) * 0.02;
      } else {
        c.leaveT += 0.035;
        const dir = idx === 0 ? -1 : 1;
        if (c.leaveHappy) {
          c.mesh.position.y = Math.abs(Math.sin(c.leaveT * 6)) * 0.15;
          c.mesh.position.x += dir * 0.06;
        } else {
          c.mesh.position.x += dir * 0.05;
          c.mesh.rotation.z = Math.sin(c.leaveT * 8) * 0.08;
        }

        if (Math.abs(c.mesh.position.x) > 4.0) {
          this.customerGroup.remove(c.mesh);
          this.customers[idx] = null;
        }
      }
    });

    // Grill Light flicker
    if (this.grillLight) {
      this.grillLight.intensity = 1.4 + Math.sin(time * 12) * 0.4;
    }

    // Continuous grill steam when cooking or burned
    if (this.grillSlotsState[0] !== 'empty' && Math.random() < 0.12) {
      this.emitGrillSteam(0, this.grillSlotsState[0] === 'burned');
    }
    if (this.grillSlotsState[1] !== 'empty' && Math.random() < 0.12) {
      this.emitGrillSteam(1, this.grillSlotsState[1] === 'burned');
    }

    // Update steam particles
    this.steamParticles.forEach(p => {
      if (p.active) {
        p.life += 0.02;
        p.mesh.position.y += p.speedY;
        p.mesh.position.x += p.speedX;
        p.mesh.scale.multiplyScalar(1.02);
        p.mesh.material.opacity = Math.max(0, 0.6 * (1 - p.life / p.maxLife));
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        }
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}
