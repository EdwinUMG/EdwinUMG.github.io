let currentSlide = 0;
const slides = document.querySelector("#carousel");
const totalSlides = slides.children.length;
const indicators = document.querySelectorAll("#indicators span");

function updateIndicators() {
  indicators.forEach((dot, i) => {
    dot.classList.toggle("bg-teal-600", i === currentSlide);
    dot.classList.toggle("bg-gray-400", i !== currentSlide);
  });
}

function moveSlide(step) {
  currentSlide = (currentSlide + step + totalSlides) % totalSlides;
  slides.style.transform = `translateX(-${currentSlide * 100}%)`;
  updateIndicators();
}

function goToSlide(n) {
  currentSlide = n;
  slides.style.transform = `translateX(-${currentSlide * 100}%)`;
  updateIndicators();
}
