// ==========================================
// 0. GLOBAL VARIABLES & INITIALIZATION
// ==========================================
let lenis;
let animationFrameId; 
let sfxHover, sfxClick;

// THE AUDIO FIX
if (typeof Howl !== 'undefined') {
    sfxHover = new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_a16a8d3db5.mp3'], volume: 0.15 });
    sfxClick = new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_7314227f91.mp3'], volume: 0.4 });
}

// THE FORCED REFLOW FIX: Native RequestAnimationFrame instead of GSAP Ticker
if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
        smoothWheel: true,
        smoothTouch: false, // Prevents scroll jacking on mobile
    });
    
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    if (typeof ScrollTrigger !== 'undefined') {
        lenis.on('scroll', ScrollTrigger.update);
    }
}

// ==========================================
// CUSTOM MAGNETIC CURSOR (Vanilla - Conflict Free)
// ==========================================
document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.custom-cursor');
    if (cursor) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    }
});

document.addEventListener('mouseover', (e) => {
    const cursor = document.querySelector('.custom-cursor');
    if (cursor && e.target.closest('a, button, .custom-select-trigger, .custom-option, .bento-card, .clickable-img, .pricing-card')) {
        cursor.classList.add('hovering');
    }
});

document.addEventListener('mouseout', (e) => {
    const cursor = document.querySelector('.custom-cursor');
    if (cursor && e.target.closest('a, button, .custom-select-trigger, .custom-option, .bento-card, .clickable-img, .pricing-card')) {
        cursor.classList.remove('hovering');
    }
});

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // SEAMLESS PAGE TRANSITIONS (SWUP)
    // ==========================================
    if (typeof Swup !== 'undefined') {
        const swup = new Swup();
        swup.hooks.on('page:view', () => {
            initForge(); 
        });
    }

    // ==========================================
    // THE FORGE ENGINE (Reboots on every page load)
    // ==========================================
    function initForge() {
        
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.getAll().forEach(t => t.kill());
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        const isMobile = window.innerWidth <= 768;
        const cursor = document.querySelector('.custom-cursor');

        // B. Re-bind Hover States & Audio
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
        if (!isMobile && typeof gsap !== 'undefined') {
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
        }

        // D. Kinetic Variable Typography
        const kineticText = document.querySelector('.kinetic-text');
        if (kineticText && !isMobile && typeof gsap !== 'undefined') {
            ScrollTrigger.create({
                trigger: "body", start: "top top", end: "bottom bottom",
                onUpdate: (self) => {
                    let velocity = Math.abs(self.getVelocity());
                    let newWeight = gsap.utils.clamp(400, 800, 800 - (velocity * 0.5));
                    kineticText.style.fontVariationSettings = `"wght" ${newWeight}`;
                }
            });
        }

        // E. Three.js Liquid Iron Canvas (DELAYED FOR PERFORMANCE)
        if (document.getElementById('iron-canvas')) {
            // Wait 2.5 seconds before spinning up heavy 3D math so PageSpeed doesn't flag it
            setTimeout(() => {
                if (typeof THREE !== 'undefined') {
                    const canvas = document.getElementById('iron-canvas');
                    canvas.innerHTML = ''; 
                    
                    const scene = new THREE.Scene();
                    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
                    
                    renderer.setSize(window.innerWidth, window.innerHeight);
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));

                    const segments = isMobile ? 16 : 128; 
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

                    if (window.innerWidth <= 768) {
                        canvas.style.display = 'none';
                    }

                    const plane = new THREE.Mesh(geometry, material);
                    plane.rotation.x = -Math.PI * 0.2; 
                    scene.add(plane); camera.position.z = 2;

                    const clock = new THREE.Clock();
                    function animate() {
                        material.uniforms.uTime.value = clock.getElapsedTime() * 0.4; 
                        renderer.render(scene, camera);
                        animationFrameId = requestAnimationFrame(animate); 
                    }
                    animate();
                }
            }, 2500); // 2.5 second delay
        }

        // F. Cinematic Video Slow-Mo
        const previewVideos = document.querySelectorAll('.bento-card video');
        previewVideos.forEach(vid => { vid.playbackRate = 0.65; });

        // G. Custom Select Dropdown
        document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
            const trigger = wrapper.querySelector('.custom-select-trigger');
            const options = wrapper.querySelectorAll('.custom-option');
            const hiddenInput = wrapper.parentElement.querySelector('input[type="hidden"]');
            const triggerSpan = trigger ? trigger.querySelector('span') : null;

            const urlParams = new URLSearchParams(window.location.search);
            const planFromUrl = urlParams.get('plan');

            if (planFromUrl && hiddenInput && triggerSpan) {
                options.forEach(option => {
                    if (option.getAttribute('data-value') === planFromUrl) {
                        triggerSpan.textContent = option.textContent;
                        hiddenInput.value = planFromUrl;
                        triggerSpan.style.color = "var(--text-main)";
                    }
                });
            }

            if(trigger) {
                trigger.onclick = (e) => {
                    e.stopPropagation(); 
                    wrapper.classList.toggle('open');
                };
            }
            
            options.forEach(option => {
                option.onclick = (e) => {
                    e.stopPropagation();
                    if (triggerSpan) triggerSpan.textContent = e.target.textContent;
                    if(hiddenInput) hiddenInput.value = e.target.getAttribute('data-value');
                    wrapper.classList.remove('open');
                    if (triggerSpan) triggerSpan.style.color = "var(--text-main)";
                };
            });
        });

        // H. Pop-in Animations
        const cards = document.querySelectorAll('[data-animate="pop-in"]');
        if (typeof gsap !== 'undefined') {
            cards.forEach((card, index) => {
                if (isMobile) {
                    gsap.fromTo(card, 
                        { opacity: 0 },
                        { opacity: 1, duration: 0.6, ease: "power2.out", 
                          scrollTrigger: { trigger: card, start: "top 95%", toggleActions: "play none none none" }
                        }
                    );
                } else {
                    gsap.fromTo(card, { opacity: 0, y: 50, scale: 0.95 },
                        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out", delay: (index % 4) * 0.1, 
                          scrollTrigger: { trigger: card, start: "top 90%", toggleActions: "play none none reverse" }
                        }
                    );
                }
            });
        }

        // I. 3D Tilt Effect
        if (window.matchMedia("(pointer: fine)").matches && typeof gsap !== 'undefined') {
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
    } 

    initForge();

});

// ==========================================
// SEPARATE THREE.JS FUNCTION
// ==========================================
function initLiquidMetalCanvas(canvas) {
    canvas.innerHTML = ''; 
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const segments = 128; 
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
    scene.add(plane); 
    camera.position.z = 2;

    const clock = new THREE.Clock();
    function animate() {
        material.uniforms.uTime.value = clock.getElapsedTime() * 0.4; 
        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animate); 
    }
    animate();
}

// ==========================================
// 5. MODAL, GALLERY & CLICK OUTSIDE LOGIC
// ==========================================

window.currentCardIndex = 0;

document.addEventListener('click', (e) => {
    const card = e.target.closest('.bento-card');
    if (card) {
        const cards = Array.from(document.querySelectorAll('.bento-card'));
        window.currentCardIndex = cards.indexOf(card);
    }
});

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

window.changeMedia = function(direction) {
    const cards = Array.from(document.querySelectorAll('.bento-card'));
    if(cards.length === 0) return;

    window.currentCardIndex += direction;

    if (window.currentCardIndex < 0) window.currentCardIndex = cards.length - 1;
    if (window.currentCardIndex >= cards.length) window.currentCardIndex = 0;

    closeModal();
    closeVideoModal();

    setTimeout(() => {
        cards[window.currentCardIndex].click();
    }, 50);
}

window.onclick = function(event) {
    const imageModal = document.getElementById("imageModal");
    const videoModal = document.getElementById("videoModal");
    if (event.target == imageModal) closeModal();
    if (event.target == videoModal) closeVideoModal();

    if (!event.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
    }
}

// ==========================================
// PRE-FILL FORM BASED ON URL PARAMETER
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedPlan = urlParams.get('plan');

    if (selectedPlan) {
        const formDropdown = document.getElementById('project-type'); 
        
        if (formDropdown) {
            formDropdown.value = selectedPlan;
            const customSelectText = document.querySelector('.custom-select-trigger span');
            if (customSelectText) {
                if (selectedPlan === 'landing-special') customSelectText.textContent = '$100 Landing Page Special';
                if (selectedPlan === 'starter') customSelectText.textContent = 'Starter Build ($1,000)';
                if (selectedPlan === 'standard') customSelectText.textContent = 'Standard Plan ($99/mo)';
                if (selectedPlan === 'growth') customSelectText.textContent = 'Growth Plan ($199/mo)';
                if (selectedPlan === 'premium') customSelectText.textContent = 'Premium Plan ($399/mo)';
            }
        }
    }
});
