// ==========================================
// 0. GLOBAL VARIABLES & INITIALIZATION
// ==========================================
let lenis;
let animationFrameId; // To kill the Three.js loop on page change
let sfxHover, sfxClick;

// Initialize Audio
if (typeof Howl !== 'undefined') {
    sfxHover = new Howl({ src: ['https://actions.google.com/sounds/v1/ui/pop_up_short.ogg'], volume: 0.1 });
    sfxClick = new Howl({ src: ['https://actions.google.com/sounds/v1/ui/button_click.ogg'], volume: 0.4 });
}

// Initialize Lenis Smooth Scroll
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

document.addEventListener("DOMContentLoaded", () => {
    const isMobile = window.innerWidth <= 768;

    // ==========================================
    // 1. THE CINEMATIC PRELOADER (Runs Once)
    // ==========================================
    const preloader = document.querySelector('.preloader');
    const counterElement = document.querySelector('.counter');
    
    if (preloader && counterElement) {
        let count = { val: 0 };
        gsap.to(count, {
            val: 100,
            duration: 1.8,
            ease: "power2.inOut",
            onUpdate: () => counterElement.innerText = Math.round(count.val).toString().padStart(3, '0'),
            onComplete: () => {
                gsap.to(preloader, {
                    yPercent: -100, duration: 1, ease: "power4.inOut",
                    onComplete: () => {
                        preloader.style.display = "none";
                        initForge(); // Start the engine
                    }
                });
            }
        });
    } else {
        initForge();
    }

    // ==========================================
    // 2. GLOBAL CURSOR TRACKING (Runs Once)
    // ==========================================
    const cursor = document.querySelector('.custom-cursor');
    if (cursor && window.matchMedia("(pointer: fine)").matches) {
        window.addEventListener('mousemove', (e) => {
            gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.15, ease: "power2.out" });
        });
    }

    // ==========================================
    // 3. SEAMLESS PAGE TRANSITIONS (SWUP)
    // ==========================================
    if (typeof Swup !== 'undefined') {
        const swup = new Swup();
        swup.hooks.on('page:view', () => {
            initForge(); // Reboot localized logic on new page
        });
    }

    // ==========================================
    // 4. THE FORGE ENGINE (Reboots on every page load)
    // ==========================================
    function initForge() {
        
        // A. Memory Leak Prevention
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.getAll().forEach(t => t.kill());
        if (animationFrameId) cancelAnimationFrame(animationFrameId); // Kill ghost WebGL loops

        // B. Re-bind Hover States & Audio to the new DOM elements
        const interactables = document.querySelectorAll('a, button, .cta-button, .pricing-card, .custom-select-trigger, details summary, .bento-card');
        if (cursor && window.matchMedia("(pointer: fine)").matches) {
            interactables.forEach(el => {
                el.addEventListener('mouseenter', () => {
                    cursor.classList.add('hovering');
                    if(sfxHover) sfxHover.play();
                });
                el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
                el.addEventListener('click', () => {
                    if(sfxClick) sfxClick.play();
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
                animationFrameId = requestAnimationFrame(animate); // Save ID so we can kill it later
            }
            animate();
        }

        // F. Cinematic Video Slow-Mo (RESTORED)
        const previewVideos = document.querySelectorAll('.bento-card video');
        previewVideos.forEach(vid => { vid.playbackRate = 0.65; });

        // G. Custom Select Dropdown
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
            // Ensure clicking outside closes it
            setTimeout(() => {
                document.addEventListener('click', (e) => {
                    if (!wrapper.contains(e.target)) wrapper.classList.remove('open');
                });
            }, 100); // Slight delay prevents immediate closing
        });

        // H. Pop-in Animations & Tilt
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

// ==========================================
// 5. MODAL LOGIC (Images & Videos)
// ==========================================
// Must be assigned to window so inline HTML onclick="" can find them
window.openModal = function(src) {
    const modal = document.getElementById("imageModal");
    if(modal) { modal.style.display = "flex"; document.getElementById("expandedImg").src = src; }
}

window.closeModal = function() {
    const modal = document.getElementById("imageModal");
    if(modal) modal.style.display = "none";
}

window.openVideoModal = function(videoSrc) {
    const modal = document.getElementById("videoModal");
    const video = document.getElementById("expandedVideo");
    if(modal && video) {
        modal.style.display = "flex"; video.src = videoSrc; video.playbackRate = 0.65; video.play();
    }
}

window.closeVideoModal = function() {
    const modal = document.getElementById("videoModal");
    const video = document.getElementById("expandedVideo");
    if(modal && video) {
        modal.style.display = "none"; video.pause(); video.src = ""; 
    }
}

window.onclick = function(event) {
    const imageModal = document.getElementById("imageModal");
    const videoModal = document.getElementById("videoModal");
    if (event.target == imageModal) closeModal();
    if (event.target == videoModal) closeVideoModal();
}
