// Specific logic for the main landing page

console.log('Main Landing Page script loaded');

// Example: Parallax effect for the hero orbs based on mouse movement
const orbs = document.querySelectorAll('.orb');
document.addEventListener('mousemove', (e) => {
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;

  orbs.forEach((orb, index) => {
    const factor = (index + 1) * 30;
    if (typeof gsap !== 'undefined') {
      gsap.to(orb, {
        x: (x - 0.5) * factor,
        y: (y - 0.5) * factor,
        duration: 1,
        ease: "power2.out"
      });
    }
  });
});
