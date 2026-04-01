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
