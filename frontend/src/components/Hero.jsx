import React, { useEffect, useRef } from 'react';
import { useCms } from '../context/CmsContext';

export default function Hero() {
  const { t, books } = useCms();
  const swiperRef = useRef(null);
  const swiperInstanceRef = useRef(null);

  // Default book list matching index.html
  const defaultBooks = [
    { id: 1, title: 'Atomic Habits - James Clear', img: '/assets/img/books/book1.png' },
    { id: 2, title: 'The Psychology of Money - Morgan Housel', img: '/assets/img/books/book2.png' },
    { id: 3, title: 'Deep Work - Cal Newport', img: '/assets/img/books/book3.png' },
    { id: 4, title: 'The Lean Startup - Eric Ries', img: '/assets/img/books/book4.png' },
    { id: 5, title: 'Principles - Ray Dalio', img: '/assets/img/books/book5.png' },
    { id: 6, title: 'Rich Dad Poor Dad - Robert Kiyosaki', img: '/assets/img/books/book6.png' },
    { id: 7, title: 'Start with Why - Simon Sinek', img: '/assets/img/books/book7.png' },
    { id: 8, title: 'Shoe Dog - Phil Knight', img: '/assets/img/books/book8.png' },
    { id: 9, title: 'Zero to One - Peter Thiel', img: '/assets/img/books/book9.png' },
    { id: 10, title: 'Good to Great - Jim Collins', img: '/assets/img/books/book10.png' },
    { id: 11, title: 'Thinking, Fast and Slow - Daniel Kahneman', img: '/assets/img/books/book11.png' },
    { id: 12, title: 'The 7 Habits of Highly Effective People - Stephen R. Covey', img: '/assets/img/books/book12.png' },
    { id: 13, title: 'Rework - Jason Fried & David Heinemeier Hansson', img: '/assets/img/books/book13.png' },
  ];

  // Repeat for seamless 3D coverflow loop across wide viewports
  const displayBooks = [
    ...defaultBooks,
    ...defaultBooks,
    ...defaultBooks,
  ];

  useEffect(() => {
    let timer = setTimeout(() => {
      if (swiperRef.current && window.Swiper) {
        if (swiperInstanceRef.current) {
          swiperInstanceRef.current.destroy(true, true);
        }
        swiperInstanceRef.current = new window.Swiper(swiperRef.current, {
          loop: true,
          loopAdditionalSlides: 8,
          initialSlide: 13,
          speed: 750,
          autoplay: {
            delay: 2000,
            disableOnInteraction: false,
            pauseOnMouseEnter: false,
          },
          slidesPerView: 'auto',
          centeredSlides: true,
          effect: 'coverflow',
          coverflowEffect: {
            rotate: 0,
            stretch: -14,
            depth: 110,
            modifier: 1.15,
            slideShadows: false,
          },
        });
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (swiperInstanceRef.current) {
        swiperInstanceRef.current.destroy(true, true);
        swiperInstanceRef.current = null;
      }
    };
  }, []);

  const getBookImg = (id, fallback) => {
    const key = `home.hero.book${id}.image`;
    const val = t(key, fallback);
    if (!val) return fallback;
    return val.startsWith('http') || val.startsWith('/') ? val : '/' + val;
  };

  return (
    <section id="hero" className="hero section hero-redesign">
      <div className="hero-inner-container">
        <div className="hero-content">
          <h1 className="hero-main-title" data-block-key="home.hero.title">
            {t('home.hero.title', 'Empowering Individuals\nand Businesses').includes('\n')
              ? t('home.hero.title', 'Empowering Individuals\nand Businesses')
                  .split('\n')
                  .map((line, idx) => (
                    <React.Fragment key={idx}>
                      {line}
                      {idx === 0 && <br />}
                    </React.Fragment>
                  ))
              : t('home.hero.title', 'Empowering Individuals and Businesses')}
          </h1>
          <p className="hero-main-subtitle" data-block-key="home.hero.subtitle">
            {t(
              'home.hero.subtitle',
              'Balancing employee autonomy with expert oversight — providing qualified virtual specialists to power your sustainability and industry superiority.'
            )}
          </p>
        </div>

        <div className="hero-showcase-wrapper">
          <div className="hero-watermark-text" aria-hidden="true" data-block-key="home.hero.watermark">
            {t('home.hero.watermark', 'OMNI VIRTUAL SOLUTIONS')}
          </div>

          <div className="hero-books-swiper-container">
            <div className="swiper hero-books-swiper" ref={swiperRef}>
              <div className="swiper-wrapper align-items-center">
                {displayBooks.map((book, index) => {
                  const bookImg = getBookImg(book.id, book.img);
                  return (
                    <div className="swiper-slide" key={`${book.id}-${index}`}>
                      <div className="book-card-wrap">
                        <img
                          src={bookImg}
                          alt={book.title}
                          className="book-cover-img"
                          data-block-key={`home.hero.book${book.id}.image`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
