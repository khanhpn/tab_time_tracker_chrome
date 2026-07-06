const sectionLinks = Array.from(document.querySelectorAll("nav a"));
const sections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter((section) => section !== null);

const setActiveLink = (sectionId) => {
  sectionLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${sectionId}`;
    link.classList.toggle("is-active", isActive);
    link.toggleAttribute("aria-current", isActive);
  });
};

const observer = new IntersectionObserver(
  (entries) => {
    const visibleEntry = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visibleEntry !== undefined) {
      setActiveLink(visibleEntry.target.id);
    }
  },
  {
    rootMargin: "-20% 0px -55%",
    threshold: [0.2, 0.5, 0.8]
  }
);

sections.forEach((section) => {
  observer.observe(section);
});
