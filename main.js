// 0. INITIALIZE LENIS SMOOTH SCROLL
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
    smooth: true,
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time)=>{
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0, 0);

// 0.2. KINETIC SCROLL VELOCITY
let proxy = { skew: 0 },
    skewSetter = gsap.quickSetter(".pricing-card, .hero h1", "skewY", "deg"),
    clamp = gsap.utils.clamp(-15, 15); // Don't let it distort too much

ScrollTrigger.create({
  onUpdate: (self) => {
    let skew = clamp(self.getVelocity() / -100);
    if (Math.abs(skew) > Math.abs(proxy.skew)) {
      proxy.skew = skew;
      gsap.to(proxy, {
        skew: 0,
        duration: 0.8,
        ease: "power3",
        overwrite: true,
        onUpdate: () => skewSetter(proxy.skew)
      });
    }
  }
});

// 0.3. FLUID CUSTOM CURSOR
const cursor = document.querySelector('.custom-cursor');
const interactables = document.querySelectorAll('a, button, .cta-button, .pricing-card');

// Move cursor
window.addEventListener('mousemove', (e) => {
    gsap.to(cursor, {
        x: e.clientX - cursor.offsetWidth / 2,
        y: e.clientY - cursor.offsetHeight / 2,
        duration: 0.15, // Slight lag for a fluid feel
        ease: "power2.out"
    });
});

// Snap and expand on hover
interactables.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
});
// ==========================================
// 1. MODAL LOGIC (Images & Videos)
// ==========================================
function openModal(src) {
    const modal = document.getElementById("imageModal");
    if(modal) {
        modal.style.display = "flex";
        document.getElementById("expandedImg").src = src;
    }
}

function closeModal() {
    const modal = document.getElementById("imageModal");
    if(modal) modal.style.display = "none";
}

function openVideoModal(videoSrc) {
    const modal = document.getElementById("videoModal");
    const video = document.getElementById("expandedVideo");
    if(modal && video) {
        modal.style.display = "flex";
        video.src = videoSrc;
        video.playbackRate = 0.65; // Slow down the BIG modal video to 65%
        video.play();
    }
}

function closeVideoModal() {
    const modal = document.getElementById("videoModal");
    const video = document.getElementById("expandedVideo");
    if(modal && video) {
        modal.style.display = "none";
        video.pause();
        video.src = ""; 
    }
}

// Close modals when clicking the dark background
window.onclick = function(event) {
    const imageModal = document.getElementById("imageModal");
    const videoModal = document.getElementById("videoModal");
    if (event.target == imageModal) closeModal();
    if (event.target == videoModal) closeVideoModal();
}

// ==========================================
// 2. GSAP ENTRANCE ANIMATIONS & 3D TILT
// ==========================================
document.addEventListener("DOMContentLoaded", (event) => {
    
    // Automatically slow down all preview videos in the Bento Grid to 65%
    const previewVideos = document.querySelectorAll('.bento-card video');
    previewVideos.forEach(vid => {
        vid.playbackRate = 0.65;
    });

    // Check if GSAP is loaded on this specific page
    if (typeof gsap !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Pop-in Entrance Animations
        const cards = document.querySelectorAll('[data-animate="pop-in"]');
        cards.forEach((card, index) => {
            gsap.fromTo(card, 
                { opacity: 0, y: 50, scale: 0.95 },
                {
                    opacity: 1, 
                    y: 0,
                    scale: 1,
                    duration: 0.8,
                    ease: "power3.out",
                    delay: (index % 4) * 0.1, 
                    scrollTrigger: {
                        trigger: card,
                        start: "top 90%", 
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });

        // 3D Tilt Hover Effect - PERFORMANCE UPGRADE
        // Only run on devices with a fine pointer (mouse/trackpad), ignore touch screens
        if (window.matchMedia("(pointer: fine)").matches) {
            const tiltElements = document.querySelectorAll('.tilt-effect');
            tiltElements.forEach(element => {
                element.addEventListener('mousemove', (e) => {
                    const rect = element.getBoundingClientRect();
                    const x = e.clientX - rect.left; 
                    const y = e.clientY - rect.top;  
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    
                    const rotateX = ((y - centerY) / centerY) * -10;
                    const rotateY = ((x - centerX) / centerX) * 10;

                    gsap.to(element, {
                        rotationX: rotateX,
                        rotationY: rotateY,
                        transformPerspective: 1000,
                        ease: "power1.out",
                        duration: 0.3
                    });
                });

                element.addEventListener('mouseleave', () => {
                    gsap.to(element, {
                        rotationX: 0,
                        rotationY: 0,
                        ease: "power3.out",
                        duration: 0.6
                    });
                });
            });
        }
        
        // Magnetic Button Effect for CTA
        const magneticBtn = document.querySelector('.cta-button');
        if(magneticBtn && typeof gsap !== 'undefined') {
            magneticBtn.addEventListener('mousemove', (e) => {
                const rect = magneticBtn.getBoundingClientRect();
                const h = rect.width / 2;
                const v = rect.height / 2;
                
                const x = e.clientX - rect.left - h;
                const y = e.clientY - rect.top - v;
                
                gsap.to(magneticBtn, {
                    x: x * 0.4,
                    y: y * 0.4,
                    duration: 0.4,
                    ease: 'power3.out'
                });
            });

            magneticBtn.addEventListener('mouseleave', () => {
                gsap.to(magneticBtn, {
                    x: 0,
                    y: 0,
                    duration: 0.7,
                    ease: 'elastic.out(1, 0.3)' 
                });
            });
        }
    }
});

// ==========================================
// 3. Custom Select Dropdown Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const customSelects = document.querySelectorAll('.custom-select-wrapper');

    customSelects.forEach(wrapper => {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const options = wrapper.querySelectorAll('.custom-option');
        const hiddenInput = wrapper.parentElement.querySelector('input[type="hidden"]');

        if(trigger) {
            trigger.addEventListener('click', function() {
                wrapper.classList.toggle('open');
            });
        }

        options.forEach(option => {
            option.addEventListener('click', function() {
                trigger.querySelector('span').textContent = this.textContent;
                if(hiddenInput) hiddenInput.value = this.getAttribute('data-value');
                wrapper.classList.remove('open');
                trigger.querySelector('span').style.color = "var(--text-main)";
            });
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
            }
        });
    });
});
// ==========================================
// LIQUID IRON WEBGL SHADER (THREE.JS)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (typeof THREE !== 'undefined' && document.getElementById('iron-canvas')) {
        const canvas = document.getElementById('iron-canvas');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Create a highly detailed plane for fluid distortion
        const geometry = new THREE.PlaneGeometry(10, 10, 128, 128);
        
        // Custom GLSL Shader Material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uColorMain: { value: new THREE.Color('#070e1a') },
                uColorAccent: { value: new THREE.Color('#00d4ff') }
            },
            vertexShader: `
                uniform float uTime;
                varying vec2 vUv;
                varying float vElevation;
                void main() {
                    vUv = uv;
                    // Create fluid undulation using sine waves
                    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
                    float elevation = sin(modelPosition.x * 2.0 + uTime) * 0.2 
                                    + sin(modelPosition.y * 1.5 + uTime * 0.8) * 0.2;
                    modelPosition.z += elevation;
                    vElevation = elevation;
                    gl_Position = projectionMatrix * viewMatrix * modelPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColorMain;
                uniform vec3 uColorAccent;
                varying float vElevation;
                void main() {
                    // Mix the dark iron and cyan thermal glow based on height
                    float mixStrength = (vElevation + 0.4) * 0.8;
                    vec3 finalColor = mix(uColorMain, uColorAccent, mixStrength);
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            wireframe: false // Change to true if you want a brutalist digital grid look
        });

        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.x = -Math.PI * 0.2; // Tilt it back slightly
        scene.add(plane);
        camera.position.z = 2;

        // Render Loop
        const clock = new THREE.Clock();
        function animate() {
            const elapsedTime = clock.getElapsedTime();
            material.uniforms.uTime.value = elapsedTime * 0.4; // Speed of the fluid
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }
        animate();

        // Handle Resizing
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
});
// ==========================================
// 1. THE MAGNETIC SPOTLIGHT CURSOR
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.querySelector('.custom-cursor');
    const interactables = document.querySelectorAll('a, button, .cta-button, .pricing-card, .custom-select-trigger');

    // If the device has a mouse, run the custom cursor logic
    if (cursor && window.matchMedia("(pointer: fine)").matches) {
        
        // Track the mouse and animate the cursor div
        window.addEventListener('mousemove', (e) => {
            gsap.to(cursor, {
                x: e.clientX,
                y: e.clientY,
                duration: 0.15, // This creates the premium "heavy" trailing effect
                ease: "power2.out"
            });
        });

        // Add the expanding hover effect when touching links or buttons
        interactables.forEach(el => {
            el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
        });
    }
});

// ==========================================
// 2. KINETIC VARIABLE TYPOGRAPHY
// ==========================================
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    const kineticText = document.querySelector('.kinetic-text');
    
    if (kineticText) {
        ScrollTrigger.create({
            trigger: "body",
            start: "top top",
            end: "bottom bottom",
            onUpdate: (self) => {
                // Get scroll velocity
                let velocity = Math.abs(self.getVelocity());
                
                // Map velocity to font weight (800 is idle, 400 is max speed)
                let newWeight = gsap.utils.clamp(400, 800, 800 - (velocity * 0.5));
                
                // Apply the physical weight change to the DOM
                kineticText.style.fontVariationSettings = `"wght" ${newWeight}`;
            }
        });
    }
}

