import React, { useState, useEffect } from 'react';
import { useCms } from '../context/CmsContext';

export default function Contact() {
  const { company, t } = useCms();

  // Business identity & contact data dynamic from database company profile or CMS
  const businessEmail = company?.email || t('footer.email', 'admin@omnivirtualsolution.com');
  const businessPhone = company?.phone || t('footer.phone', '+1 315-915-4799');
  const cleanPhone = businessPhone.replace(/[^0-9+]/g, '');
  const businessAddress = company?.full_address || t('footer.address', '1350 Ave of the Americas, Fl 2 -1100 New York, NY 10019');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service_interest: '',
    subject: '',
    message: '',
  });

  const [status, setStatus] = useState({ type: '', message: '', link: '' });
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formLoadTime] = useState(Date.now());

  // Auto-close confirmation modal in 5 seconds
  useEffect(() => {
    if (!confirmation) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setConfirmation(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmation]);

  const openGmailPopup = (url) => {
    const width = 680;
    const height = 740;
    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const innerWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const innerHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = Math.max(0, Math.round(screenLeft + (innerWidth - width) / 2));
    const top = Math.max(0, Math.round(screenTop + (innerHeight - height) / 2));

    const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
    const win = window.open(url, 'OmniGmailCompose', features);
    if (win && win.focus) {
      win.focus();
    }
    return win;
  };

  const serviceOptions = [
    { id: '1', label: 'Publishing Packages' },
    { id: '2', label: 'Editorial Evaluation' },
    { id: '3', label: 'Book Marketing' },
    { id: '4', label: 'Custom Virtual Assistance' },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const buildEmailContent = () => {
    const selectedService = serviceOptions.find((s) => s.id === formData.service_interest)?.label || '';
    const emailSubject =
      formData.subject.trim() ||
      (selectedService
        ? `${selectedService} Inquiry — ${formData.name.trim()}`
        : `Website Inquiry from ${formData.name.trim()}`);

    const lines = [
      `Hi Omni Virtual Solutions Team,`,
      ``,
      `Name: ${formData.name.trim()}`,
      formData.email.trim() ? `Email: ${formData.email.trim()}` : null,
      formData.phone.trim() ? `Phone: ${formData.phone.trim()}` : null,
      selectedService ? `Service of Interest: ${selectedService}` : null,
      ``,
      `Message:`,
      formData.message.trim(),
    ].filter((l) => l !== null);

    return {
      subject: emailSubject,
      body: lines.join('\n'),
    };
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();
    const message = formData.message.trim();

    if (!name || !message) {
      setStatus({
        type: 'danger',
        message: 'Please provide your Name and Message before sending.',
        link: '',
      });
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({
        type: 'danger',
        message: 'Please provide a valid email address.',
        link: '',
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '', link: '' });

    const { subject, body } = buildEmailContent();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      businessEmail
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const response = await fetch('/api/v1/contact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          name: name,
          email: email || 'visitor@direct-mail.com',
          phone: phone,
          subject,
          message,
          service_interest_id: formData.service_interest ? parseInt(formData.service_interest, 10) : null,
          form_load_time: formLoadTime,
          _form_load_time: formLoadTime,
        }),
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        const isFallback = resData.mode === 'popup_fallback';

        if (isFallback) {
          // Daily quota reached on server: launch floating Gmail popup as graceful fallback
          const popup = openGmailPopup(gmailUrl);
          setConfirmation({
            isFallback: true,
            recipient: businessEmail,
            senderName: name,
            senderEmail: email || 'Not specified',
            phone: phone,
            subject,
            message,
            gmailUrl,
            popupBlocked: !popup,
          });
        } else {
          // Standard under-quota delivery: background SMTP dispatch
          setConfirmation({
            isFallback: false,
            recipient: businessEmail,
            senderName: name,
            senderEmail: email || 'Not specified',
            phone: phone,
            subject,
            message,
            gmailUrl,
            popupBlocked: false,
          });
        }

        // Reset form fields
        setFormData({
          name: '',
          email: '',
          phone: '',
          service_interest: '',
          subject: '',
          message: '',
        });

        setStatus({ type: '', message: '', link: '' });
      } else {
        setStatus({
          type: 'danger',
          message: resData?.error?.message || resData?.message || 'Failed to send your message. Please try again.',
          link: '',
        });
      }
    } catch (err) {
      console.error('[contact] Submit error:', err);
      setStatus({
        type: 'danger',
        message: 'Network error. Please check your internet connection or try again.',
        link: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendDefaultMail = () => {
    if (!formData.name.trim() || !formData.message.trim()) {
      setStatus({
        type: 'danger',
        message: 'Please provide your Name and Message before sending.',
        link: '',
      });
      return;
    }

    const { subject, body } = buildEmailContent();
    const mailtoUrl = `mailto:${encodeURIComponent(businessEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;

    setStatus({
      type: 'success',
      message: 'Launching your default email app with your message pre-filled.',
      link: mailtoUrl,
    });
  };

  const handleCopyEmail = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(businessEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <section id="contact" className="contact section contact-redesign">
      <div className="container" data-aos="fade-up" data-aos-delay="100">
        <div className="text-center">
          <div className="contact-pill-badge">
            <span data-block-key="home.contact.badge">{t('home.contact.badge', '✦ GET IN TOUCH')}</span>
          </div>
          <h2 className="contact-section-heading" data-block-key="home.contact.heading">{t('home.contact.heading', 'Contact Our Team')}</h2>
          <div className="contact-heading-divider"></div>
        </div>

        <div className="row gy-4 mt-2">
          {/* Contact Info Column */}
          <div className="col-lg-5" data-aos="fade-right" data-aos-delay="150">
            <div className="contact-info-card">
              <div className="contact-info-icon">
                <i className="bi bi-geo-alt-fill"></i>
              </div>
              <div className="contact-info-content">
                <h4 data-block-key="home.contact.hq_title">{t('home.contact.hq_title', 'Our Headquarters')}</h4>
                <p data-block-key="footer.address">
                  {businessAddress}
                </p>
              </div>
            </div>

            <div className="contact-info-card">
              <div className="contact-info-icon">
                <i className="bi bi-envelope-fill"></i>
              </div>
              <div className="contact-info-content">
                <h4 data-block-key="home.contact.email_title">{t('home.contact.email_title', 'Email Inquiries')}</h4>
                <p className="contact-card-text">
                  <a
                    href={`mailto:${businessEmail}`}
                    style={{ color: '#eba22d', textDecoration: 'none', fontWeight: 600 }}
                    data-block-key="footer.email"
                  >
                    {businessEmail}
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="btn btn-sm btn-link p-0 ms-2 text-muted"
                    title="Copy Email"
                    style={{ fontSize: '13px', textDecoration: 'none' }}
                  >
                    <i className={copied ? 'bi bi-check-lg text-success' : 'bi bi-clipboard'}></i>
                    <span className="ms-1" style={{ fontSize: '11px' }}>
                      {copied ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </p>
              </div>
            </div>

            <div className="contact-info-card">
              <div className="contact-info-icon">
                <i className="bi bi-telephone-fill"></i>
              </div>
              <div className="contact-info-content">
                <h4 data-block-key="home.contact.phone_title">{t('home.contact.phone_title', 'Phone Support')}</h4>
                <p className="contact-card-text">
                  <a
                    href={`tel:${cleanPhone}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                    data-block-key="footer.phone"
                  >
                    {businessPhone}
                  </a>
                </p>
              </div>
            </div>

            <div className="contact-info-card">
              <div className="contact-info-icon">
                <i className="bi bi-clock-fill"></i>
              </div>
              <div className="contact-info-content">
                <h4 data-block-key="home.contact.hours_title">{t('home.contact.hours_title', 'Operating Hours')}</h4>
                <p data-block-key="home.contact.hours_text">
                  {t('home.contact.hours_text', 'Monday – Friday: 9:00 AM – 6:00 PM EST\n24/7 Virtual Specialist Operations')
                    .split('\n')
                    .map((line, idx) => (
                      <React.Fragment key={idx}>
                        {line}
                        {idx < 1 && <br />}
                      </React.Fragment>
                    ))}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Form Column */}
          <div className="col-lg-7" data-aos="fade-left" data-aos-delay="200">
            <div className="contact-form-card">
              <form onSubmit={handleSubmit} noValidate>
                <div className="row gy-3">
                  <div className="col-md-6">
                    <label className="form-label">
                      <span data-block-key="home.contact.lbl_name">{t('home.contact.lbl_name', 'Your Name')}</span> <span className="text-warning">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      <span data-block-key="home.contact.lbl_email">{t('home.contact.lbl_email', 'Your Email')}</span> <span className="text-warning">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      placeholder="john@example.com (optional)"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      <span data-block-key="home.contact.lbl_phone">{t('home.contact.lbl_phone', 'Phone Number')}</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      className="form-control"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      <span data-block-key="home.contact.lbl_service">{t('home.contact.lbl_service', 'Service of Interest')}</span>
                    </label>
                    <select
                      name="service_interest"
                      className="form-select"
                      value={formData.service_interest}
                      onChange={handleChange}
                    >
                      <option value="">Select a Service (Optional)</option>
                      {serviceOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">
                      <span data-block-key="home.contact.lbl_subject">{t('home.contact.lbl_subject', 'Subject')}</span>
                    </label>
                    <input
                      type="text"
                      name="subject"
                      className="form-control"
                      placeholder="Project Inquiry / Consultation"
                      value={formData.subject}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">
                      <span data-block-key="home.contact.lbl_message">{t('home.contact.lbl_message', 'Message')}</span> <span className="text-warning">*</span>
                    </label>
                    <textarea
                      name="message"
                      className="form-control"
                      rows="4"
                      placeholder="Tell us about your project or workforce needs..."
                      value={formData.message}
                      onChange={handleChange}
                      required
                    ></textarea>
                  </div>

                  {status.message && (
                    <div className="col-12">
                      <div className={`alert alert-${status.type}`} role="alert">
                        <div>{status.message}</div>
                        {status.link && (
                          <div className="mt-2" style={{ fontSize: '13px' }}>
                            <a
                              href={status.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-underline fw-bold"
                              style={{ color: 'inherit' }}
                            >
                              Click here if Gmail didn't open automatically &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="col-12 mt-2">
                    <button type="submit" className="contact-btn-submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          <span>Sending Message...</span>
                        </>
                      ) : (
                        <>
                          <span data-block-key="home.contact.submit_label">{t('home.contact.submit_label', 'Send Message')}</span>
                          <i className="bi bi-arrow-right ms-1"></i>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ── FLOATING GMAIL POPUP CONFIRMATION MODAL ── */}
      {confirmation && (
        <div
          className="confirmation-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10500,
            background: 'rgba(5, 7, 15, 0.82)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmation(null);
          }}
        >
          <div
            className="confirmation-modal-card"
            style={{
              background: '#0d111a',
              border: '1px solid rgba(235, 162, 45, 0.35)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(235, 162, 45, 0.15)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Auto-close Progress Bar */}
            <div
              style={{
                height: '3px',
                background: 'linear-gradient(90deg, #22c55e 0%, #eba22d 100%)',
                width: `${(countdown / 5) * 100}%`,
                transition: 'width 1s linear',
              }}
            />

            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: confirmation.isFallback
                  ? 'linear-gradient(180deg, rgba(235, 162, 45, 0.08) 0%, transparent 100%)'
                  : 'linear-gradient(180deg, rgba(34, 197, 94, 0.08) 0%, transparent 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: confirmation.isFallback ? 'rgba(235, 162, 45, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    border: `1px solid ${confirmation.isFallback ? 'rgba(235, 162, 45, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                    color: confirmation.isFallback ? '#eba22d' : '#22c55e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    boxShadow: confirmation.isFallback
                      ? '0 0 15px rgba(235, 162, 45, 0.25)'
                      : '0 0 15px rgba(34, 197, 94, 0.25)',
                  }}
                >
                  <i className={`bi ${confirmation.isFallback ? 'bi-info-circle-fill' : 'bi-check-circle-fill'}`}></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>
                    {confirmation.isFallback ? 'Daily Quota Limit — Direct Fallback' : 'Message Sent Successfully'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                    Auto-closing in <span style={{ color: '#eba22d', fontWeight: 700 }}>{countdown}s</span>...
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '24px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <div
                style={{
                  background: confirmation.isFallback ? 'rgba(235, 162, 45, 0.12)' : 'rgba(34, 197, 94, 0.1)',
                  border: `1px solid ${confirmation.isFallback ? 'rgba(235, 162, 45, 0.3)' : 'rgba(34, 197, 94, 0.25)'}`,
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontSize: '13.5px',
                  color: confirmation.isFallback ? '#fef08a' : '#86efac',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <i
                    className={`bi ${confirmation.isFallback ? 'bi-info-circle-fill text-warning' : 'bi-check-circle-fill text-success'}`}
                    style={{ marginTop: '2px' }}
                  ></i>
                  <div>
                    {confirmation.isFallback ? (
                      <>
                        Daily automated email quota reached. A <strong>floating Gmail compose window</strong> has been opened with your inquiry pre-filled so you can send directly.
                      </>
                    ) : (
                      <>
                        Your message has been received! Our team has been notified and will get back to you within 1-2 business days.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Details */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  fontSize: '13px',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Delivering to:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <code
                      style={{
                        background: 'rgba(235, 162, 45, 0.15)',
                        color: '#eba22d',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {confirmation.recipient}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      title="Copy email"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copied ? '#22c55e' : '#a0aec0',
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'}`}></i>
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>From:</span>
                  <span style={{ color: '#f1f5f9' }}>
                    {confirmation.senderName} ({confirmation.senderEmail})
                  </span>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Subject:</span>
                  <span style={{ color: '#f1f5f9', fontWeight: 500, textAlign: 'right' }}>
                    {confirmation.subject}
                  </span>
                </div>

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                    Message Content:
                  </div>
                  <div
                    style={{
                      maxHeight: '100px',
                      overflowY: 'auto',
                      background: 'rgba(0, 0, 0, 0.35)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      fontSize: '12.5px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                    }}
                  >
                    {confirmation.message}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: confirmation.isFallback ? 'space-between' : 'flex-end',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              {confirmation.isFallback ? (
                <>
                  <button
                    type="button"
                    onClick={() => openGmailPopup(confirmation.gmailUrl)}
                    className="btn btn-sm"
                    style={{
                      background: '#eba22d',
                      color: '#0d1117',
                      fontWeight: 700,
                      borderRadius: '8px',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="bi bi-box-arrow-up-right"></i>
                    Re-open Gmail Popup
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSendDefaultMail}
                      className="btn btn-sm btn-outline-secondary"
                      style={{
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        color: '#cbd5e1',
                      }}
                    >
                      <i className="bi bi-envelope me-1"></i> Mail App
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmation(null)}
                      className="btn btn-sm btn-secondary"
                      style={{
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        color: '#fff',
                        padding: '6px 14px',
                      }}
                    >
                      Close ({countdown}s)
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmation(null)}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #eba22d 0%, #c87a1d 100%)',
                    color: '#0d1117',
                    fontWeight: 700,
                    borderRadius: '8px',
                    padding: '8px 22px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Done ({countdown}s)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
