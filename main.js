// ==========================================
// 0. INITIALIZE LENIS SMOOTH SCROLL & GSAP
// ==========================================
let lenis;

if (typeof Lenis !== 'undefined' && typeof gsap !== 'undefined') {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
        smoothWheel: true,
        smoothTouch: false, // CRITICAL FIX: Lets native mobile touch scroll take over for zero lag
        touchMultiplier: 2,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time)=>{
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0, 0);
    
    // KINETIC SCROLL VELOCITY (Card Skew)
    let proxy = { skew: 0 },
        skewSetter = gsap.quickSetter(".pricing-card, .hero h1", "skewY", "deg"),
        clamp = gsap.utils.clamp(-15, 15);

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
}

document.addEventListener("DOMContentLoaded", () => {
    
    const isMobile = window.innerWidth <= 768; // Device detection variable

    // ==========================================
    // 1. THE MAGNETIC SPOTLIGHT CURSOR
    // ==========================================
    const cursor = document.querySelector('.custom-cursor');
    const interactables = document.querySelectorAll('a, button, .cta-button, .pricing-card, .custom-select-trigger');

    if (cursor && window.matchMedia("(pointer: fine)").matches) {
        window.addEventListener('mousemove', (e) => {
            gsap.to(cursor, {
                x: e.clientX,
                y: e.clientY,
                duration: 0.15,
                ease: "power2.out"
            });
        });

        interactables.forEach(el => {
            el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
        });
    }

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
                    let velocity = Math.abs(self.getVelocity());
                    let newWeight = gsap.utils.clamp(400, 800, 800 - (velocity * 0.5));
                    kineticText.style.fontVariationSettings = `"wght" ${newWeight}`;
                }
            });
        }
    }

    // ==========================================
    // 3. LIQUID IRON WEBGL SHADER (THREE.JS)
    // ==========================================
    if (typeof THREE !== 'undefined' && document.getElementById('iron-canvas')) {
        const canvas = document.getElementById('iron-canvas');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // PERFORMANCE FIX: Cap pixel ratio on mobile to prevent GPU thermal throttling
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));

        // PERFORMANCE FIX: Drop geometry segments drastically on phones (16k polys down to 1k)
        const segments = isMobile ? 32 : 128; 
        const geometry = new THREE.PlaneGeometry(10, 10, segments, segments);
        
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
                    float mixStrength = (vElevation + 0.4) * 0.8;
                    vec3 finalColor = mix(uColorMain, uColorAccent, mixStrength);
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            wireframe: false 
        });

        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.x = -Math.PI * 0.2; 
        scene.add(plane);
        camera.position.z = 2;

        const clock = new THREE.Clock();
        function animate() {
            const elapsedTime = clock.getElapsedTime();
            material.uniforms.uTime.value = elapsedTime * 0.4; 
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // ==========================================
    // 4. Custom Select Dropdown Logic
    // ==========================================
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

    // ==========================================
    // 5. GSAP ENTRANCE ANIMATIONS & 3D TILT
    // ==========================================
    if (typeof gsap !== 'undefined') {
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
    }
});

// ==========================================
// 6. MODAL LOGIC (Images & Videos)
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
        video.playbackRate = 0.65; 
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

window.onclick = function(event) {
    const imageModal = document.getElementById("imageModal");
    const videoModal = document.getElementById("videoModal");
    if (event.target == imageModal) closeModal();
    if (event.target == videoModal) closeVideoModal();
}
document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. THE CINEMATIC PRELOADER
    // ==========================================
    const preloader = document.querySelector('.preloader');
    const counterElement = document.querySelector('.counter');
    
    // Only run preloader if it exists on the page
    if (preloader && counterElement) {
        let count = { val: 0 };
        gsap.to(count, {
            val: 100,
            duration: 1.8,
            ease: "power2.inOut",
            onUpdate: () => {
                counterElement.innerText = Math.round(count.val).toString().padStart(3, '0');
            },
            onComplete: () => {
                // Split and slide out
                gsap.to(preloader, {
                    yPercent: -100,
                    duration: 1,
                    ease: "power4.inOut",
                    onComplete: () => {
                        preloader.style.display = "none";
                        initForge(); // Start the engine once loaded
                    }
                });
            }
        });
    } else {
        initForge(); // Fallback if no preloader
    }

    // ==========================================
    // 2. SONIC ARCHITECTURE (MICRO-AUDIO)
    // ==========================================
    // Using high-end, subtle UI sounds. Replace URLs with your own MP3s if desired.
    let sfxHover, sfxClick;
    if (typeof Howl !== 'undefined') {
        sfxHover = new Howl({ src: ['https://actions.google.com/sounds/v1/ui/pop_up_short.ogg'], volume: 0.1 });
        sfxClick = new Howl({ src: ['https://actions.google.com/sounds/v1/ui/button_click.ogg'], volume: 0.4 });
    }

    // ==========================================
    // 3. GLOBAL SMOOTH SCROLL (LENIS)
    // ==========================================
    let lenis;
    if (typeof Lenis !== 'undefined' && typeof gsap !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
            smoothWheel: true,
            smoothTouch: false,
        });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time)=>{ lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0, 0);
    }

    // ==========================================
    // 4. SEAMLESS PAGE TRANSITIONS (SWUP)
    // ==========================================
    if (typeof Swup !== 'undefined') {
        const swup = new Swup();
        // Every time a new page loads, we MUST reboot the forge logic
        swup.hooks.on('page:view', () => {
            initForge();
        });
    }

    // ==========================================
    // 5. THE FORGE ENGINE (Runs on every page load)
    // ==========================================
    function initForge() {
        // A. Kill old triggers to prevent memory leaks from page transitions
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.getAll().forEach(t => t.kill());
        }

        const isMobile = window.innerWidth <= 768;

        // B. Magnetic Cursor & Audio Injection
        const cursor = document.querySelector('.custom-cursor');
        const interactables = document.querySelectorAll('a, button, .cta-button, .pricing-card, .custom-select-trigger, details summary');

        if (cursor && window.matchMedia("(pointer: fine)").matches) {
            window.addEventListener('mousemove', (e) => {
                gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.15, ease: "power2.out" });
            });

            interactables.forEach(el => {
                el.addEventListener('mouseenter', () => {
                    cursor.classList.add('hovering');
                    if(sfxHover) sfxHover.play(); // Play hover sound
                });
                el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
                el.addEventListener('click', () => {
                    if(sfxClick) sfxClick.play(); // Play click sound
                });
            });
        }

        // C. Kinetic Scroll Velocity (Card Skew)
        let proxy = { skew: 0 },
            skewSetter = gsap.quickSetter(".pricing-card, .hero h1", "skewY", "deg"),
            clamp = gsap.utils.clamp(-15, 15);

        ScrollTrigger.create({
            onUpdate: (self) => {
                let skew = clamp(self.getVelocity() / -100);
                if (Math.abs(skew) > Math.abs(proxy.skew)) {
                    proxy.skew = skew;
                    gsap.to(proxy, { skew: 0, duration: 0.8, ease: "power3", overwrite: true, onUpdate: () => skewSetter(proxy.skew) });
                }
            }
        });

        // D. Kinetic Variable Typography
        const kineticText = document.querySelector('.kinetic-text');
        if (kineticText) {
            ScrollTrigger.create({
                trigger: "body", start: "top top", end: "bottom bottom",
                onUpdate: (self) => {
                    let velocity = Math.abs(self.getVelocity());
                    let newWeight = gsap.utils.clamp(400, 800, 800 - (velocity * 0.5));
                    kineticText.style.fontVariationSettings = `"wght" ${newWeight}`;
                }
            });
        }

        // E. Three.js Liquid Iron Canvas
        if (typeof THREE !== 'undefined' && document.getElementById('iron-canvas')) {
            const canvas = document.getElementById('iron-canvas');
            // Prevent multiple canvases if Swup duplicates it
            canvas.innerHTML = ''; 
            
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
            
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));

            const segments = isMobile ? 32 : 128; 
            const geometry = new THREE.PlaneGeometry(10, 10, segments, segments);
            
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0.0 },
                    uColorMain: { value: new THREE.Color('#070e1a') },
                    uColorAccent: { value: new THREE.Color('#00d4ff') }
                },
                vertexShader: `
                    uniform float uTime; varying vec2 vUv; varying float vElevation;
                    void main() {
                        vUv = uv; vec4 modelPosition = modelMatrix * vec4(position, 1.0);
                        float elevation = sin(modelPosition.x * 2.0 + uTime) * 0.2 + sin(modelPosition.y * 1.5 + uTime * 0.8) * 0.2;
                        modelPosition.z += elevation; vElevation = elevation;
                        gl_Position = projectionMatrix * viewMatrix * modelPosition;
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColorMain; uniform vec3 uColorAccent; varying float vElevation;
                    void main() {
                        float mixStrength = (vElevation + 0.4) * 0.8;
                        vec3 finalColor = mix(uColorMain, uColorAccent, mixStrength);
                        gl_FragColor = vec4(finalColor, 1.0);
                    }
                `,
            });

            const plane = new THREE.Mesh(geometry, material);
            plane.rotation.x = -Math.PI * 0.2; 
            scene.add(plane); camera.position.z = 2;

            const clock = new THREE.Clock();
            function animate() {
                material.uniforms.uTime.value = clock.getElapsedTime() * 0.4; 
                renderer.render(scene, camera);
                requestAnimationFrame(animate);
            }
            animate();
        }

        // F. Custom Select Dropdown
        document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
            const trigger = wrapper.querySelector('.custom-select-trigger');
            const options = wrapper.querySelectorAll('.custom-option');
            const hiddenInput = wrapper.parentElement.querySelector('input[type="hidden"]');

            if(trigger) trigger.addEventListener('click', () => wrapper.classList.toggle('open'));
            options.forEach(option => {
                option.addEventListener('click', function() {
                    trigger.querySelector('span').textContent = this.textContent;
                    if(hiddenInput) hiddenInput.value = this.getAttribute('data-value');
                    wrapper.classList.remove('open');
                    trigger.querySelector('span').style.color = "var(--text-main)";
                });
            });
            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target)) wrapper.classList.remove('open');
            });
        });

        // G. Pop-in Animations & Tilt
        const cards = document.querySelectorAll('[data-animate="pop-in"]');
        cards.forEach((card, index) => {
            gsap.fromTo(card, { opacity: 0, y: 50, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out", delay: (index % 4) * 0.1, 
                  scrollTrigger: { trigger: card, start: "top 90%", toggleActions: "play none none reverse" }
                }
            );
        });

        if (window.matchMedia("(pointer: fine)").matches) {
            document.querySelectorAll('.tilt-effect').forEach(element => {
                element.addEventListener('mousemove', (e) => {
                    const rect = element.getBoundingClientRect();
                    const x = e.clientX - rect.left; const y = e.clientY - rect.top;  
                    const centerX = rect.width / 2; const centerY = rect.height / 2;
                    gsap.to(element, {
                        rotationX: ((y - centerY) / centerY) * -10,
                        rotationY: ((x - centerX) / centerX) * 10,
                        transformPerspective: 1000, ease: "power1.out", duration: 0.3
                    });
                });
                element.addEventListener('mouseleave', () => {
                    gsap.to(element, { rotationX: 0, rotationY: 0, ease: "power3.out", duration: 0.6 });
                });
            });
        }
    } // End initForge()

});
