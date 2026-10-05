import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCms } from '../context/CmsContext';

export default function ServicesSection() {
  const { t } = useCms();
  const navigate = useNavigate();

  const isLiveEditorEnvironment = () => {
    return Boolean(
      (window.parent && window.parent !== window) ||
      new URLSearchParams(window.location.search).get('edit') === '1' ||
      new URLSearchParams(window.location.search).get('admin') === '1' ||
      document.body.classList.contains('is-admin-session') ||
      document.body.classList.contains('mode-edit') ||
      document.documentElement.classList.contains('in-iframe') ||
      (window.__omniIsEditor === true)
    );
  };

  const handleCardClick = (targetPath, e) => {
    // Only clickable on homepage, disabled in Live In-Place Website Editor
    if (isLiveEditorEnvironment()) {
      return;
    }

    // If user clicked directly on the Learn More link or another button/link, let it handle naturally
    if (e.target.closest('a') || e.target.closest('button')) {
      return;
    }

    // Do not navigate if user is highlighting text
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    navigate(targetPath);
  };

  return (
    <section id="services" className="services section services-redesign">
      <div className="container" data-aos="fade-up">
        <div className="services-header text-center">
          <div className="services-pill-badge">
            <span data-block-key="home.services.badge">
              {t('home.services.badge', '✦ WHAT WE OFFER')}
            </span>
          </div>
          <h2 className="services-section-heading" data-block-key="home.services.heading">
            {t('home.services.heading', 'Our Services')}
          </h2>
          <div className="services-heading-divider"></div>
        </div>
      </div>

      <div className="container">
        <div className="row gy-4 justify-content-center">
          {/* Service Item 1: Marketing Services */}
          <div className="col-lg-6 col-md-6" data-aos="fade-up" data-aos-delay="100">
            <div
              className="service-card-luxury"
              role="link"
              tabIndex={0}
              aria-label="Marketing Services - Learn More"
              onClick={(e) => handleCardClick('/services?open=marketing-dropdown', e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCardClick('/services?open=marketing-dropdown', e);
                }
              }}
            >
              <div className="service-card-top">
                <div className="service-icon-box">
                  <i className="bi bi-megaphone-fill"></i>
                </div>
                <div className="service-card-tag" data-block-key="service.services.tag_1">
                  {t('service.services.tag_1', 'Specialized Strategy')}
                </div>
              </div>

              <h3 className="service-card-title" data-block-key="service.services.h_1" tabIndex={0}>
                {t('service.services.h_1', 'Marketing Services')}
              </h3>

              <p className="service-card-desc" data-block-key="service.services.p_1">
                {t('service.services.p_1', 'One of the key features that makes an Omni book distinct from other self-published books is our professional editorial evaluation.')}
              </p>

              <div className="service-feature-pills">
                <span className="service-pill" data-block-key="service.services.span_2">
                  <i className="bi bi-check2"></i> {t('service.services.span_2', 'Editorial Evaluation')}
                </span>
                <span className="service-pill" data-block-key="service.services.span_3">
                  <i className="bi bi-check2"></i> {t('service.services.span_3', 'Strategic Visibility')}
                </span>
                <span className="service-pill" data-block-key="service.services.span_4">
                  <i className="bi bi-check2"></i> {t('service.services.span_4', 'Target Reach')}
                </span>
              </div>

              <Link to="/services?open=marketing-dropdown" className="service-card-footer text-decoration-none">
                <span className="service-link-text" data-block-key="service.services.link_1">
                  {t('service.services.link_1', 'Learn More')}
                </span>
                <i className="bi bi-arrow-right service-link-arrow"></i>
              </Link>
            </div>
          </div>

          {/* Service Item 2: Publishing Packages */}
          <div className="col-lg-6 col-md-6" data-aos="fade-up" data-aos-delay="200">
            <div
              className="service-card-luxury"
              role="link"
              tabIndex={0}
              aria-label="Publishing Packages - Learn More"
              onClick={(e) => handleCardClick('/services?open=eval-services', e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCardClick('/services?open=eval-services', e);
                }
              }}
            >
              <div className="service-card-top">
                <div className="service-icon-box">
                  <i className="bi bi-book-half"></i>
                </div>
                <div className="service-card-tag" data-block-key="service.services.tag_2">
                  {t('service.services.tag_2', 'End-to-End Support')}
                </div>
              </div>

              <h3 className="service-card-title" data-block-key="service.services.h_2" tabIndex={0}>
                {t('service.services.h_2', 'Publishing Packages')}
              </h3>

              <p className="service-card-desc" data-block-key="service.services.p_6">
                {t('service.services.p_6', "Our packages are designed to offer authors the support and tools they need to maximize their book's potential. Each package guarantees one-on-one author support for every step of the self-publishing journey.")}
              </p>

              <div className="service-feature-pills">
                <span className="service-pill" data-block-key="service.services.span_7">
                  <i className="bi bi-check2"></i> {t('service.services.span_7', '1-on-1 Author Guidance')}
                </span>
                <span className="service-pill" data-block-key="service.services.span_8">
                  <i className="bi bi-check2"></i> {t('service.services.span_8', 'Complete Tool Suite')}
                </span>
                <span className="service-pill" data-block-key="service.services.span_9">
                  <i className="bi bi-check2"></i> {t('service.services.span_9', 'Maximize Potential')}
                </span>
              </div>

              <Link to="/services?open=eval-services" className="service-card-footer text-decoration-none">
                <span className="service-link-text" data-block-key="service.services.link_2">
                  {t('service.services.link_2', 'Learn More')}
                </span>
                <i className="bi bi-arrow-right service-link-arrow"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
