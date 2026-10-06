const fs = require('fs');
const path = require('path');

const registryPath = path.resolve('Omni/admin/services-content-registry.js');
let content = fs.readFileSync(registryPath, 'utf8');

const CATEGORY_HTMLS = {
  'formats': `<div class="category-formats-overview">
  <div class="editorial-note-callout p-3 mb-4 rounded-3" style="background: #faf6f0; border: 1px solid rgba(173, 125, 66, 0.3); border-left: 5px solid #ad7d42;">
    <div class="fw-bold mb-1 editable-field" style="color: #2b2219; font-size: 0.98rem;" data-block-key="service.formats.industry_note_title">
      Industry-Standard Print &amp; Digital Formats
    </div>
    <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.92rem; line-height: 1.68;" data-block-key="service.formats.industry_note">
      All manuscripts submitted to Omni are formatted as trade paperbacks and printed on high-quality, acid-free, book-grade opaque paper stock. Standard with our publishing packages, with options for hardcover cloth bindings and professional audiobook production.
    </p>
  </div>
  <div class="d-flex flex-column gap-3 mb-4">
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('formats', 'audiobook-publishing')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.formats.electronic_title">
          <i class="bi bi-tablet me-2" style="color: #ad7d42;"></i>Electronic Format
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.formats.electronic_desc">
        With the increasing number of readers who prefer a digital format, it’s important that your book is accessible to these tech-savvy booklovers too. With our Digital Formatting and Distribution service, your book will be available for sale as an e-book.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('formats', 'audiobook-publishing')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.formats.audiobook_title">
          <i class="bi bi-headphones me-2" style="color: #ad7d42;"></i>AudioBook Publishing
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.formats.audiobook_desc">
        Over the years, the demand for audiobooks has significantly increased because readers are now able to easily download books and listen to them while they are on the move. Through audiobooks, stories are shared in a convenient way. Let your words unfold in your readers’ imagination through Omni audiobook publishing. Lift your story from its pages and let your readers listen to it.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('formats', 'print-formats')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.formats.print_title">
          <i class="bi bi-book me-2" style="color: #ad7d42;"></i>Print Formats
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.formats.print_desc">
        All manuscripts submitted to Omni are formatted as trade paperbacks and printed on high-quality, acid-free, book-grade opaque paper stock.
      </p>
    </div>
  </div>
</div>`,

  'design-services': `<div class="category-design-overview">
  <div class="editorial-note-callout p-3 mb-4 rounded-3" style="background: #faf6f0; border: 1px solid rgba(173, 125, 66, 0.3); border-left: 5px solid #ad7d42;">
    <div class="fw-bold mb-1 editable-field" style="color: #2b2219; font-size: 0.98rem;" data-block-key="service.design-services.impressions_title">
      First Impressions That Sell
    </div>
    <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.92rem; line-height: 1.68;" data-block-key="service.design-services.impressions_note">
      The cover is the first opportunity you have to connect with potential readers. That's why at Omni we make sure that your cover and interior layout meet the professional standards for commercially successful books.
    </p>
  </div>
  <div class="d-flex flex-column gap-3 mb-4">
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('design-services', 'interior-page-layout')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.design-services.layout_title">
          <i class="bi bi-layout-text-window-reverse me-2" style="color: #ad7d42;"></i>Interior Page Layout
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.design-services.layout_desc">
        Careful planning and execution of the layout of your book is very important. Readers need to be able to easily follow the text of your book. Our professionals will help you create the best layout for your book.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('design-services', 'cover-design')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.design-services.cover_title">
          <i class="bi bi-image me-2" style="color: #ad7d42;"></i>Cover Design
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.design-services.cover_desc">
        The cover is the first opportunity you have to connect with potential readers. That's why at Omni we make sure that your cover will meet the professional standards for commercially successful books. After all, when a book is sitting on the shelf, potential readers don't look to see how a book is published. They only know whether the cover image draws their attention or the back cover copy makes them to want to read more. These elements make a great cover, and that is why we pay attention to these details when we are publishing your book.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('design-services', 'cover-design')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.design-services.stock_title">
          <i class="bi bi-images me-2" style="color: #ad7d42;"></i>Stock Images
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.design-services.stock_desc">
        All books published via the Omni standard publishing packages receive custom-designed covers, produced in full color. Within the realm of this custom-designed cover, you have the option to choose two images, free of charge, from the millions found through Getty Images.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('design-services', 'black-and-white-illustrations')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.design-services.bw_illustrations_title">
          <i class="bi bi-brush me-2" style="color: #ad7d42;"></i>Interior Black-and-White Illustrations
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.design-services.bw_illustrations_desc">
        Elevate your book to the next creative level with custom artwork produced in our in-house art studio. The Omni team of seasoned studio artists will work with you to produce striking black-and-white illustrations that add visual interest to your book’s content.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('design-services', 'color-illustrations')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.design-services.color_illustrations_title">
          <i class="bi bi-palette me-2" style="color: #ad7d42;"></i>Interior Color Illustrations
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.design-services.color_illustrations_desc">
        One of Omni's talented studio artists will use your descriptions and feedback to create custom color illustrations that reflect your book’s unique style.
      </p>
    </div>
  </div>
</div>`,

  'production': `<div class="category-production-overview">
  <div class="editorial-note-callout p-3 mb-4 rounded-3" style="background: #faf6f0; border: 1px solid rgba(173, 125, 66, 0.3); border-left: 5px solid #ad7d42;">
    <div class="fw-bold mb-1 editable-field" style="color: #2b2219; font-size: 0.98rem;" data-block-key="service.production.workflow_title">
      Seamless Publishing Workflow
    </div>
    <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.92rem; line-height: 1.68;" data-block-key="service.production.workflow_note">
      Preparing your manuscript for submission and publishing is a whole lot easier when we do it for you. Omni handles everything from raw document conversion to post-layout revisions and catalog resubmissions.
    </p>
  </div>
  <div class="d-flex flex-column gap-3 mb-4">
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('production', 'pre-manuscript-services')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.production.pre_manuscript_title">
          <i class="bi bi-file-earmark-text me-2" style="color: #ad7d42;"></i>Pre-Manuscript Services
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.production.pre_manuscript_desc">
        Preparing your manuscript for submission and for publishing is a whole lot easier when we do it for you. Omni can convert your typewritten manuscript, or previously published book, to a word-processed format.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('production', 'post-page-layout-services')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.production.post_page_title">
          <i class="bi bi-pencil-square me-2" style="color: #ad7d42;"></i>Post-Page Layout Services
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.production.post_page_desc">
        Omni allows you to make changes to your book after the manuscript has been laid out by our designers. Charges will be applied.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('production', 'resubmission')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.production.resubmission_title">
          <i class="bi bi-arrow-repeat me-2" style="color: #ad7d42;"></i>Resubmission
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.production.resubmission_desc">
        Once your book has gone live and is for sale, you can still correct errors or other issues that might have been missed. Resubmission services are available for a fee.
      </p>
    </div>
  </div>
</div>`,

  'marketing-services': `<div class="category-marketing-overview">
  <blockquote class="editorial-testimonial-quote" style="margin: 0 0 24px; padding: 16px 20px; border-left: 4px solid #ad7d42; background: rgba(173, 125, 66, 0.05); border-radius: 0 8px 8px 0; font-style: italic; color: #444;">
    <p class="mb-2 editable-field" style="font-size: 0.95rem; line-height: 1.6;" data-block-key="service.marketing-services.quote">
      "Once my book was released, I had to think about marketing and publicity. I received tremendous guidance from my marketing consultant and publicist! They made my life easy and worry-free. Thank you Omni for helping independent authors publish and market their books with confidence!"
    </p>
    <footer class="editorial-quote-author editable-field" style="font-style: normal; font-weight: 600; color: #666; font-size: 0.88rem;" data-block-key="service.marketing-services.quote_author">
      —Carisia Switala, author of Eternity's Secret
    </footer>
  </blockquote>
  <div class="mb-4">
    <p class="mb-0 editable-field" style="color: #44403c; font-size: 0.98rem; line-height: 1.75;" data-block-key="service.marketing-services.intro_p1">
      If you want your book to sell, you’ll want to do more than just hope for the best. Our selection of promotional products and services allows authors to build a dynamic platform from which they can effectively promote and sell their books. Create your marketing plan and materials with our simple step-by-step tools.
    </p>
  </div>
  <div class="d-flex flex-column gap-3 mb-4">
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('marketing-services', 'video-book-trailer')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.marketing-services.videos_title">
          <i class="bi bi-camera-video me-2" style="color: #ad7d42;"></i>Author and Book Videos
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.marketing-services.videos_desc">
        Give a mass audience a look inside your story. With your professional book video or author interview, you can captivate your audience visually while your story unfolds before their eyes.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('marketing-services', 'publicity-services')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.marketing-services.publicity_title">
          <i class="bi bi-megaphone me-2" style="color: #ad7d42;"></i>Publicity Services
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.marketing-services.publicity_desc">
        Get your book noticed from a unique platform created by our publicity and media services.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('marketing-services', 'book-reviews')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.marketing-services.reviews_title">
          <i class="bi bi-star-half me-2" style="color: #ad7d42;"></i>Book Reviews
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.marketing-services.reviews_desc">
        A book review is an excellent way to generate interest for your title. Book readers, buyers, and retailers rely on the opinion of experts when considering which titles are worth purchasing and reading. Omni offers four distinct review services to help you elevate your book’s credibility and raise its marketing potential.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('marketing-services', 'book-signings-and-galleries')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.marketing-services.signings_title">
          <i class="bi bi-calendar-event me-2" style="color: #ad7d42;"></i>Book Signings and Galleries
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.marketing-services.signings_desc">
        A book exhibition or book signing event can be a terrific way to create buzz around your book. As an exhibitor at many of the largest trade shows and book events, we've put our books in the hands of booklovers and industry insiders through Omni book exhibition services.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('marketing-services', 'hollywood-book-to-screen')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.marketing-services.hollywood_title">
          <i class="bi bi-film me-2" style="color: #ad7d42;"></i>Hollywood Book-to-Screen
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.marketing-services.hollywood_desc">
        Have you ever considered for even a moment that your book could be adapted into a movie or television series? If the answer is yes, then Omni can make your book available to agents, producers, directors, writers and actors through multiple new services available to our authors.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('marketing-services', 'internet-marketing')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.marketing-services.internet_title">
          <i class="bi bi-globe me-2" style="color: #ad7d42;"></i>Internet Marketing
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.marketing-services.internet_desc">
        Having your own website, internet search, or preview tools are effective and economical ways to promote your book, enhance your image as an author, and communicate with prospective readers around the world.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('marketing-services', 'radio-services')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.marketing-services.radio_title">
          <i class="bi bi-broadcast me-2" style="color: #ad7d42;"></i>Radio Services
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.marketing-services.radio_desc">
        Have you ever considered how a radio interview might affect your book’s marketing plan? If the answer is yes, then Omni can make your voice available on the airwaves to help you reach new audiences and further your cause.
      </p>
    </div>
  </div>
</div>`,

  'bookselling': `<div class="category-bookselling-overview">
  <div class="editorial-note-callout p-3 mb-4 rounded-3" style="background: #faf6f0; border: 1px solid rgba(173, 125, 66, 0.3); border-left: 5px solid #ad7d42;">
    <div class="fw-bold mb-1 editable-field" style="color: #2b2219; font-size: 0.98rem;" data-block-key="service.bookselling.distribution_title">
      Worldwide Retail Distribution &amp; Legal Protection
    </div>
    <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.92rem; line-height: 1.68;" data-block-key="service.bookselling.distribution_note">
      Once your book is published, we make it available for order online with retail outlets worldwide. Our bookselling promotional services provide you the opportunity to actively promote and protect your book.
    </p>
  </div>
  <div class="d-flex flex-column gap-3 mb-4">
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('bookselling', 'bookstore-essentials')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.bookselling.essentials_title">
          <i class="bi bi-shop me-2" style="color: #ad7d42;"></i>Bookstore Essentials
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.bookselling.essentials_desc">
        Through Omni Bookstore Essentials, your book receives professional bookselling services that make your book even more attractive to bookstores. By making your book returnable or adding preview services to your book, bookstores and other book buyers receive additional incentives to stock or purchase your book.
      </p>
    </div>
    <div class="p-3 rounded-3 border" style="background: #ffffff; border-color: #ebd9c4;" onclick="selectSubcategoryById('bookselling', 'registration')">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="fw-bold m-0 editable-field" style="color: #2b2219; font-size: 1.08rem;" data-block-key="service.bookselling.registration_title">
          <i class="bi bi-shield-check me-2" style="color: #ad7d42;"></i>Registration
        </h5>
        <span class="publishing-package-arrow-badge"><i class="bi bi-arrow-right-short"></i></span>
      </div>
      <p class="mb-0 editable-field" style="color: #57534e; font-size: 0.93rem; line-height: 1.7;" data-block-key="service.bookselling.registration_desc">
        As you make your work available to the public, you want to make sure you have the appropriate protection. There are two ways we can help you with that. The first is registering your copyright with the U.S. Copyright Office. Second, a Library of Congress Control Number makes your book more accessible to librarians and book vendors.
      </p>
    </div>
  </div>
</div>`
};

// Replace window.CATEGORY_CUSTOM_CALLOUTS
const calloutPattern = /window\.CATEGORY_CUSTOM_CALLOUTS\s*=\s*\{[\s\S]*?\};/;
const newCallouts = `window.CATEGORY_CUSTOM_CALLOUTS = {
    'editorial-services': '<div class="editorial-note-callout p-3 mb-4 rounded-3" style="background: #faf6f0; border: 1px solid rgba(173, 125, 66, 0.3); border-left: 5px solid #ad7d42;"><div class="fw-bold mb-1 editable-field" style="color: #2b2219; font-size: 0.98rem;" data-block-key="service.editorial-services.chicago_note_title">Chicago Manual of Style & Microsoft Word Tracking</div><p class="mb-0 editable-field" style="color: #57534e; font-size: 0.92rem; line-height: 1.68;" data-block-key="service.editorial-services.chicago_note">In order to take advantage of our Editorial Services, you must have access to Microsoft Word. Our editing appears as tracked changes in your manuscript, which must be read in Word. Omni evaluators, editors, and copywriters follow the most current edition of the Chicago Manual of Style, the premier style guide used by traditional book publishers.</p></div>',
    'formats': ${JSON.stringify(CATEGORY_HTMLS['formats'])},
    'design-services': ${JSON.stringify(CATEGORY_HTMLS['design-services'])},
    'production': ${JSON.stringify(CATEGORY_HTMLS['production'])},
    'marketing-services': ${JSON.stringify(CATEGORY_HTMLS['marketing-services'])},
    'bookselling': ${JSON.stringify(CATEGORY_HTMLS['bookselling'])}
  };`;

content = content.replace(calloutPattern, newCallouts);

fs.writeFileSync(registryPath, content, 'utf8');
console.log('Successfully updated CATEGORY_CUSTOM_CALLOUTS in services-content-registry.js');
