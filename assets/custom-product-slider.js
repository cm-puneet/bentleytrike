   // document.addEventListener("DOMContentLoaded", function () {
//  window.variants = null;
var currentIndex = 1;
//var variantCount =  window.variants.length;;
   var screenWidth = screen.width;
  
  function initSlider() {
  
    const prevButton = document.querySelector('.slider-prev');
    const nextButton = document.querySelector('.slider-next');
    const slider = document.querySelector('.product-variant-slider');
    const originalItems = Array.from(document.querySelectorAll('.variant-item'));
// remove duplicate element ////
    
    if (!slider || !originalItems.length) return;

    const itemWidth = originalItems[0].offsetWidth + 10;
    
    // Clear existing clones if any
    slider.querySelectorAll('.clone').forEach(clone => clone.remove());

    // Clone first and last items
    const firstClone = originalItems[0].cloneNode(true);
    const lastClone = originalItems[originalItems.length - 1].cloneNode(true);

    firstClone.classList.add('clone');
    lastClone.classList.add('clone');

    slider.insertBefore(lastClone, originalItems[0]);
   // slider.appendChild(firstClone);

    const allItems = Array.from(slider.querySelectorAll('.variant-item'));

    // Set initial transform
    slider.style.transform = `translateX(${-itemWidth * currentIndex}px)`;
    slider.style.transition = 'transform 0.3s ease';

    function updateSliderPosition() {
      slider.style.transition = 'transform 0.3s ease';
      slider.style.transform = `translateX(${-itemWidth * currentIndex}px)`;
    }

    function updateButtonStates() {
      const realItemsCount = allItems.length - 2;
      const remainingItems = realItemsCount - currentIndex;
      if(screenWidth < 740){
        nextButton.disabled = remainingItems <= 3;
       }else if(screenWidth >= 740 && screenWidth <1024){
         // alert(screenWidth);
         nextButton.disabled = remainingItems <=8
       }
      else{
        nextButton.disabled = remainingItems <= 5
      }
      //;
      prevButton.disabled = currentIndex <= 1;
      
      const prevButtonEl = document.getElementById('slider-prev');
      const nextButtonEl = document.getElementById('slider-next');

     
    }

    nextButton.addEventListener('click', () => {
      if (currentIndex >= allItems.length - 1) return;
      currentIndex++;
      updateSliderPosition();
      updateButtonStates();
    });

    prevButton.addEventListener('click', () => {
      if (currentIndex <= 0) return;
      currentIndex--;
      updateSliderPosition();
      updateButtonStates();
    });

    slider.addEventListener('transitionend', () => {
      if (allItems[currentIndex].classList.contains('clone')) {
        slider.style.transition = 'none';

        if (currentIndex === allItems.length - 1) currentIndex = 1;
        else if (currentIndex === 0) currentIndex = allItems.length ;

        slider.style.transform = `translateX(${-itemWidth * currentIndex}px)`;
        void slider.offsetWidth;
        slider.style.transition = 'transform 0.3s ease';
      }
    });

    // Handle variant item click (ignore clones)
    slider.querySelectorAll('.variant-item:not(.clone)').forEach(item => {
      item.addEventListener('click', function () {
        const variantId = this.getAttribute('data-variant-id');
        const selectedVariant = window.variants.find(v => v.id == variantId);

        if (selectedVariant) {
          updateVariantSelection(selectedVariant);
        }
      });
    });

    function updateVariantSelection(variant) {
      const selectElement = document.querySelector('select[name="id"]');
      if (selectElement) {
        selectElement.value = variant.id;
        selectElement.dispatchEvent(new Event('change'));

        // Update URL without reload
        const newUrl = `${window.location.pathname}?variant=${variant.id}`;
        history.pushState({ path: newUrl }, '', newUrl);

        // Reinit slider after slight delay (let Shopify DOM changes settle)
        setTimeout(initSliderCustome, 200);
      }
    }

    updateButtonStates();
  }


  // Initial setup
  initSlider();
//});
   

// Detect URL changes caused by history push/replace
window.addEventListener('popstate', () => {
  setTimeout(() => initSlider(), 100); // slight delay for DOM re-render
});
