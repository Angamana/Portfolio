document.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  initCertCarousel();
});

let modelsLoadedCount = 0;
function checkModelsLoaded() {
  modelsLoadedCount++;
  if (modelsLoadedCount >= 2) {
    createBackgroundTimeline();
  }
}

// Proxy object to store animation states controlled by GSAP
const animState = {
  skullTime: 0,
  brainZ: -2, // Start behind the skull
  glowIntensity: 0,
  cameraZ: 15
};

let mixer, skullDuration = 1;
let brainModel, brainGlow, skullModel;

// Helper to auto-scale and center a model
function fitModelToCamera(model, camera, scaleFactor = 1.0) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  
  const targetSize = 8 * scaleFactor;
  const scale = targetSize / maxDim;
  model.scale.set(scale, scale, scale);

  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  model.position.sub(center);
  
  model.position.y -= 1;
}

function initThreeJS() {
  if (typeof THREE === 'undefined') return;

  const canvas = document.getElementById('webgl-canvas');
  const isMobile = window.innerWidth <= 768;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.05);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 15;

  // Performance: disable antialias on mobile, use low-power GPU mode
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !isMobile,
    powerPreference: 'low-power'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Cap pixel ratio: 1 on mobile (huge GPU saving), 1.5 on desktop
  renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));

  // High quality reflections — skip on mobile to save GPU/memory
  if (!isMobile && typeof THREE.RoomEnvironment !== 'undefined') {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  }

  // Fallback Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  // Chrome Material
  const chromeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.05,
    envMapIntensity: 2.0 
  });

  const loader = new THREE.GLTFLoader();

  // 1. Load Skull
  loader.load('Universal/assets/3D/visible_interactive_human_-_exploding_skull.glb', (gltf) => {
    skullModel = gltf.scene;
    fitModelToCamera(skullModel, camera, 1.0);

    skullModel.traverse((child) => {
      if (child.isMesh) {
        child.material = chromeMaterial;
      }
    });

    scene.add(skullModel);

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(skullModel);
      const action = mixer.clipAction(gltf.animations[0]);
      skullDuration = gltf.animations[0].duration;
      action.play();
    }
    checkModelsLoaded();
  }, undefined, (error) => {
    console.error('Error loading skull:', error);
  });

  // 2. Load Brain
  loader.load('Universal/assets/3D/brain_point_cloud.glb', (gltf) => {
    brainModel = gltf.scene;
    
    // Rotate brain 90 degrees on the Y axis FIRST
    brainModel.rotation.y = Math.PI / 2;

    // THEN center and scale it so it stays perfectly in the middle
    fitModelToCamera(brainModel, camera, 0.85); 
    
    brainModel.position.z = animState.brainZ; 

    scene.add(brainModel);
    checkModelsLoaded();
  }, undefined, (error) => {
    console.error('Error loading brain:', error);
  });

  // 3. Brain Glow
  brainGlow = new THREE.PointLight(0xffffff, 0, 50);
  brainGlow.position.set(0, 0, -2);
  scene.add(brainGlow);

  // Animation Loop
  const clock = new THREE.Clock();
  // Cap to 30fps on mobile to halve GPU load; 60fps on desktop
  const targetFPS = isMobile ? 30 : 60;
  const frameInterval = 1000 / targetFPS;
  let lastFrameTime = 0;
  
  function animate(timestamp) {
    requestAnimationFrame(animate);

    // Skip frame if not enough time has elapsed (throttle to targetFPS)
    if (timestamp - lastFrameTime < frameInterval) return;
    lastFrameTime = timestamp;

    const elapsedTime = clock.getElapsedTime();

    scene.position.y = Math.sin(elapsedTime * 0.5) * 0.2;
    scene.rotation.y = Math.sin(elapsedTime * 0.2) * 0.05; 
    
    if (mixer) {
      mixer.setTime(animState.skullTime);
    }

    if (brainModel) {
      brainModel.position.z = animState.brainZ;
    }
    if (brainGlow) {
      brainGlow.intensity = animState.glowIntensity;
    }

    camera.position.z = animState.cameraZ;
    renderer.render(scene, camera);
  }
  
  animate(0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function createBackgroundTimeline() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach(el => {
    // Avoid conflicting with Flip animations for cards
    if (el.classList.contains('cert-card') || el.classList.contains('cert-viewport')) return;
    
    gsap.fromTo(el, 
      { y: 50, opacity: 0 }, 
      {
        y: 0, 
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 95%",
        }
      }
    );
  });

  // We bind the background 3D scene to the entire document body so it spans the entire scroll length
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "body",
      start: "top top",
      end: "bottom bottom",
      scrub: 1
    }
  });

  // --- PHASE 1: Skull Expansion (0% to 50% of scroll) ---
  tl.to(animState, {
    skullTime: skullDuration * 0.5, 
    duration: 1,
    ease: "none" 
  }, 0);

  if (skullModel) {
    tl.to(skullModel.position, {
      z: 20, 
      duration: 1,
      ease: "power2.in"
    }, 0);
  }

  tl.to(animState, { 
    cameraZ: 10, 
    duration: 1,
    ease: "power1.inOut" 
  }, 0);

  // --- PHASE 2: Brain Reveal (50% to 100% of scroll) ---
  tl.to(animState, { 
    brainZ: 6, 
    duration: 1,
    ease: "power1.out" 
  }, 1);

  tl.to(animState, { 
    glowIntensity: 15, 
    duration: 1,
    ease: "power2.in" 
  }, 1);

  document.querySelectorAll('.nav-link, .nav-name').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}

function initCertCarousel() {
  if (typeof gsap === 'undefined' || typeof Flip === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(Flip, ScrollTrigger);

  const track = document.querySelector('.cert-track');
  const wrappers = document.querySelectorAll('.cert-card-wrapper');
  const overlay = document.getElementById('cert-overlay');
  const overlayImageContainer = document.querySelector('.cert-full-image-container');
  const closeBtn = document.querySelector('.cert-close');
  
  const detailTitle = document.getElementById('cert-detail-title');
  const detailOrg = document.getElementById('cert-detail-org');
  const detailDesc = document.getElementById('cert-detail-desc');
    const pdfBtn = document.getElementById('cert-detail-pdf-btn');
  const fullDetails = document.querySelector('.cert-full-details');

  const numCards = wrappers.length;
  
  // Track scroll progress logically from 0 to numCards - 1
  const scrollObj = { progress: 0 };
  
  // Initialize cards with their original index for reliable closing
  wrappers.forEach((wrapper, i) => {
    const card = wrapper.querySelector('.cert-card');
    card.dataset.index = i;
  });
  
  function getCardTransform(index) {
    const p = index - scrollObj.progress;
    const angle = p * (Math.PI / 4);
    const curveRadius = 800; 
    
    const isMobile = window.innerWidth <= 768;
      const xMultiplier = isMobile ? 120 : 250;
      const x = p * xMultiplier; 
    const z = (Math.cos(angle) * curveRadius) - curveRadius;
    const y = Math.sin(angle) * curveRadius * 0.4;
    
    const rotateY = p * -35; 
    const rotateX = p * -20; 
    const rotateZ = p * -10; 
    
    const scale = Math.max(1 - Math.abs(p) * 0.1, 0.5);
    const opacity = Math.max(1 - Math.abs(p) * 0.3, 0);
    const zIndex = Math.round(100 - Math.abs(p) * 10);
    
    return { x, y, z, rotationX: rotateX, rotationY: rotateY, rotationZ: rotateZ, scale, opacity, zIndex };
  }
  
  function updateCards() {
    wrappers.forEach((wrapper, i) => {
      const card = wrapper.querySelector('.cert-card');
      // Only update cards that are still in the spiral
      if (card && !card.classList.contains('is-active') && !card.classList.contains('is-closing')) {
        gsap.set(card, getCardTransform(i));
      }
    });
  }

  updateCards();

  gsap.to(scrollObj, {
    progress: numCards - 1,
    ease: "none",
    scrollTrigger: {
      trigger: "#certs",
      start: "center center",
      end: "+=3000",
      pin: true,
      scrub: 1,
      onUpdate: updateCards
    }
  });

  // Card click functionality
  wrappers.forEach((wrapper) => {
    const card = wrapper.querySelector('.cert-card');
    
    card.addEventListener('click', () => {
      if (card.classList.contains('is-active') || card.classList.contains('is-closing')) return;
      
      card.classList.add('is-active');
      
      // Moving it to the overlay keeps the same physical coordinate origin 
      // since both the viewport and overlay are perfectly centered on the screen
      overlayImageContainer.appendChild(card);
      
      detailTitle.textContent = card.dataset.title;
      detailOrg.textContent = card.dataset.org;
      detailDesc.textContent = card.dataset.desc;
        
        if (card.dataset.pdf) {
            pdfBtn.href = card.dataset.pdf;
            pdfBtn.style.display = 'inline-block';
        } else {
            pdfBtn.style.display = 'none';
        }

      // Enable pointer events on the overlay so the close button works
      overlay.classList.add('active');

      gsap.to(overlay, { autoAlpha: 1, duration: 0.3 });
      
      gsap.set(fullDetails, { y: 20, opacity: 0 });
      gsap.to(fullDetails, { y: 0, opacity: 1, duration: 0.5, delay: 0.4, ease: "power2.out" });

      // Animate smoothly to the front and center using direct GSAP instead of FLIP
      gsap.to(card, {
        x: 0,
        y: -30,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1.25, // Scale up to match the previous 100% width (600px)
        opacity: 1,
        duration: 0.8,
        ease: "power3.inOut"
      });
    });
  });

  // Close functionality
  closeBtn.addEventListener('click', () => {
    const activeCard = document.querySelector('.cert-card.is-active');
    if (!activeCard) return;

    activeCard.classList.remove('is-active');
    activeCard.classList.add('is-closing');
    
    gsap.to(fullDetails, { y: 20, opacity: 0, duration: 0.3 });
    
    // Disable pointer events immediately so clicks don't queue up
    overlay.classList.remove('active');
    
    gsap.to(overlay, { autoAlpha: 0, duration: 0.5, delay: 0.4 });
    
    const index = parseInt(activeCard.dataset.index);
    const originalWrapper = wrappers[index];
    originalWrapper.appendChild(activeCard);
    
    // Get the exact 3D coordinates it belongs in based on current scroll position
    const targetState = getCardTransform(index);

    // Animate smoothly back into the 3D spiral curve
    gsap.to(activeCard, {
      ...targetState,
      duration: 0.8,
      ease: "power3.inOut",
      onComplete: () => {
        activeCard.classList.remove('is-closing');
      }
    });
  });
}


// ==========================================================================
// Project Modal & Video Logic
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const projectSections = document.querySelectorAll('.project-section');
  const projectOverlay = document.getElementById('project-overlay');
  
  if(!projectOverlay) return;
  
  const projectCloseBtn = projectOverlay.querySelector('.project-close-btn');
  const fullVideoContainer = projectOverlay.querySelector('.project-full-video-container');
  const fullDetailsContainer = projectOverlay.querySelector('.project-full-details');
  
  let activeProjectVideo = null;
  
  // 1. Setup 30-second loop for all project preview videos
  const previewVideos = document.querySelectorAll('.project-preview-video');
  previewVideos.forEach(video => {
    video.addEventListener('timeupdate', () => {
      // If it's not currently expanded in the modal, loop at 30 seconds
      if (!video.classList.contains('is-expanded')) {
        if (video.currentTime >= 30) {
          video.currentTime = 0;
          video.play();
        }
      }
    });
  });

  // 2. Setup click listeners for all View Project buttons
  projectSections.forEach(section => {
    const viewBtns = section.querySelectorAll('.view-project-btn');
    const previewVideo = section.querySelector('.project-preview-video');
    const hiddenDetails = section.querySelector('.project-hidden-details');
    const previewBox = section.querySelector('.preview-box');
    
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Prepare overlay
        projectOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Clone video and details for the modal
        // We actually want to move the actual video to keep its buffer/state, 
        // but for smooth GSAP FLIP-like behavior, we will clone it.
        // Wait, moving the actual video element is better so we don't have to reload the huge MP4!
        
        // Move video
        activeProjectVideo = previewVideo;
        activeProjectVideo.classList.add('is-expanded'); // Disable 30s loop
        activeProjectVideo.muted = false; // Unmute
        activeProjectVideo.controls = true;
        
        // Store original parent
        activeProjectVideo.dataset.originalParent = previewBox.id || Math.random().toString(36).substr(2, 9);
        previewBox.id = activeProjectVideo.dataset.originalParent;
        
        fullVideoContainer.appendChild(activeProjectVideo);
        
        // Copy HTML for details
        fullDetailsContainer.innerHTML = hiddenDetails.innerHTML;
        
        // GSAP animate modal content in
        gsap.fromTo(fullVideoContainer, 
          { scale: 0.8, opacity: 0, y: 50 },
          { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "power3.out", delay: 0.2 }
        );
      });
    });
  });
  
  // 3. Setup close listener
  projectCloseBtn.addEventListener('click', () => {
    projectOverlay.classList.remove('active');
    document.body.style.overflow = '';
    
    if (activeProjectVideo) {
      // Revert video back to preview
      activeProjectVideo.classList.remove('is-expanded');
      activeProjectVideo.muted = true;
      activeProjectVideo.controls = false;
      
      // Move back to original parent
      const originalParent = document.getElementById(activeProjectVideo.dataset.originalParent);
      if (originalParent) {
        originalParent.prepend(activeProjectVideo);
      }
      
      // Reset time to start the 30s loop freshly
      activeProjectVideo.currentTime = 0;
      activeProjectVideo.play();
      activeProjectVideo = null;
    }
    
    fullDetailsContainer.innerHTML = '';
  });
});

// Disable right-click globally
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});
