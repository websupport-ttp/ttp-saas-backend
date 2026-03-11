// v1/utils/emailTemplates.js

/**
 * Brand Colors - Matching the modern design
 */
const BRAND_COLORS = {
  red: '#dc2626',      // Primary red
  redDark: '#b91c1c',  // Darker red
  navy: '#1e3a8a',     // Navy blue
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  black: '#000000',
  green: '#10b981',
  blue: '#3b82f6',
  yellow: '#f59e0b',
  lightRed: '#fee2e2',
  lightGray: '#f5f5f5'
};

/**
 * Base email template with modern, clean styling inspired by the reference design
 */
const getBaseTemplate = (content, title = 'The Travel Place') => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f5f5f5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .material-icons-outlined {
      font-family: 'Material Icons Outlined';
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      display: inline-block;
      line-height: 1;
      text-transform: none;
      letter-spacing: normal;
      word-wrap: normal;
      white-space: nowrap;
      direction: ltr;
      vertical-align: middle;
    }
    .email-wrapper {
      background-color: #f5f5f5;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${BRAND_COLORS.white};
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: ${BRAND_COLORS.red};
      padding: 32px 32px 24px;
      position: relative;
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 40px;
      height: 40px;
      background-color: ${BRAND_COLORS.white};
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-text {
      color: ${BRAND_COLORS.white};
    }
    .brand-name {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.2;
      margin: 0;
    }
    .brand-tagline {
      font-size: 11px;
      font-weight: 400;
      opacity: 0.9;
      margin: 2px 0 0 0;
    }
    .booking-ref-badge {
      background-color: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 8px 16px;
      text-align: right;
    }
    .booking-ref-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(255, 255, 255, 0.8);
      margin: 0 0 4px 0;
    }
    .booking-ref-value {
      font-size: 16px;
      font-weight: 700;
      color: ${BRAND_COLORS.white};
      letter-spacing: 1px;
      margin: 0;
    }
    .content {
      padding: 32px;
      background-color: ${BRAND_COLORS.white};
    }
    .greeting {
      font-size: 24px;
      font-weight: 600;
      color: ${BRAND_COLORS.gray900};
      margin: 0 0 12px 0;
      line-height: 1.3;
    }
    .subtext {
      font-size: 14px;
      color: ${BRAND_COLORS.gray600};
      line-height: 1.6;
      margin: 0 0 32px 0;
    }
    .info-card {
      background-color: ${BRAND_COLORS.lightGray};
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    .info-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
    }
    .info-card-icon {
      width: 24px;
      height: 24px;
      color: ${BRAND_COLORS.red};
    }
    .info-card-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${BRAND_COLORS.gray500};
      margin: 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid ${BRAND_COLORS.gray200};
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-row:first-child {
      padding-top: 0;
    }
    .info-label {
      font-size: 13px;
      color: ${BRAND_COLORS.gray600};
      font-weight: 400;
    }
    .info-value {
      font-size: 13px;
      color: ${BRAND_COLORS.gray900};
      font-weight: 600;
      text-align: right;
    }
    .timeline-card {
      background-color: ${BRAND_COLORS.lightGray};
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      position: relative;
    }
    .timeline-item {
      position: relative;
      padding-left: 32px;
      margin-bottom: 24px;
    }
    .timeline-item:last-child {
      margin-bottom: 0;
    }
    .timeline-dot {
      position: absolute;
      left: 0;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 3px solid ${BRAND_COLORS.red};
      background-color: ${BRAND_COLORS.white};
    }
    .timeline-line {
      position: absolute;
      left: 5px;
      top: 20px;
      bottom: -24px;
      width: 2px;
      background-color: ${BRAND_COLORS.gray300};
    }
    .timeline-time {
      font-size: 20px;
      font-weight: 700;
      color: ${BRAND_COLORS.gray900};
      margin: 0 0 4px 0;
    }
    .timeline-location {
      font-size: 15px;
      font-weight: 600;
      color: ${BRAND_COLORS.gray900};
      margin: 0 0 2px 0;
    }
    .timeline-details {
      font-size: 12px;
      color: ${BRAND_COLORS.gray500};
      margin: 0;
    }
    .duration-badge {
      text-align: center;
      padding: 12px 0;
      margin: 16px 0;
    }
    .duration-text {
      font-size: 12px;
      color: ${BRAND_COLORS.gray500};
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .action-cards {
      display: flex;
      gap: 16px;
      margin: 32px 0;
    }
    .action-card {
      flex: 1;
      background-color: ${BRAND_COLORS.white};
      border: 1px solid ${BRAND_COLORS.gray200};
      border-radius: 12px;
      padding: 20px 16px;
      text-align: center;
      transition: all 0.2s;
    }
    .action-card:hover {
      border-color: ${BRAND_COLORS.red};
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.1);
    }
    .action-icon {
      width: 40px;
      height: 40px;
      margin: 0 auto 12px;
      color: ${BRAND_COLORS.red};
    }
    .action-title {
      font-size: 13px;
      font-weight: 600;
      color: ${BRAND_COLORS.gray900};
      margin: 0 0 8px 0;
    }
    .action-desc {
      font-size: 11px;
      color: ${BRAND_COLORS.gray500};
      line-height: 1.4;
      margin: 0;
    }
    .action-link {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      font-weight: 600;
      color: ${BRAND_COLORS.red};
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dark-section {
      background-color: ${BRAND_COLORS.gray900};
      color: ${BRAND_COLORS.white};
      padding: 32px;
      margin: 32px 0 0 0;
    }
    .dark-section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${BRAND_COLORS.gray400};
      margin: 0 0 20px 0;
    }
    .dark-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }
    .dark-info-item {
      margin: 0;
    }
    .dark-info-label {
      font-size: 11px;
      color: ${BRAND_COLORS.gray400};
      margin: 0 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dark-info-value {
      font-size: 14px;
      color: ${BRAND_COLORS.white};
      font-weight: 600;
      margin: 0;
    }
    .price-section {
      border-top: 1px solid ${BRAND_COLORS.gray800};
      padding-top: 20px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .price-label {
      font-size: 11px;
      color: ${BRAND_COLORS.gray400};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .price-value {
      font-size: 24px;
      font-weight: 700;
      color: ${BRAND_COLORS.white};
    }
    .footer {
      background-color: ${BRAND_COLORS.gray900};
      padding: 32px;
      text-align: center;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .footer-brand-icon {
      width: 24px;
      height: 24px;
      color: ${BRAND_COLORS.red};
    }
    .footer-brand-name {
      font-size: 14px;
      font-weight: 700;
      color: ${BRAND_COLORS.white};
    }
    .footer-text {
      font-size: 12px;
      color: ${BRAND_COLORS.gray400};
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin: 20px 0;
    }
    .footer-link {
      font-size: 12px;
      color: ${BRAND_COLORS.gray400};
      text-decoration: none;
      transition: color 0.2s;
    }
    .footer-link:hover {
      color: ${BRAND_COLORS.white};
    }
    .footer-copyright {
      font-size: 11px;
      color: ${BRAND_COLORS.gray500};
      margin: 20px 0 0 0;
    }
    .alert-box {
      background-color: #fef3c7;
      border-left: 4px solid ${BRAND_COLORS.yellow};
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
    }
    .alert-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #92400e;
      margin: 0 0 8px 0;
    }
    .alert-content {
      font-size: 12px;
      color: #78350f;
      line-height: 1.6;
      margin: 0;
    }
    .alert-list {
      margin: 8px 0 0 0;
      padding-left: 20px;
    }
    .alert-list li {
      margin: 4px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .header {
        padding: 24px 20px;
      }
      .header-content {
        flex-direction: column;
        gap: 16px;
      }
      .booking-ref-badge {
        text-align: left;
      }
      .content {
        padding: 24px 20px;
      }
      .action-cards {
        flex-direction: column;
      }
      .dark-info-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
      .dark-section {
        padding: 24px 20px;
      }
      .footer {
        padding: 24px 20px;
      }
      .footer-links {
        flex-direction: column;
        gap: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      ${content}
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Travel Insurance Confirmation Email - Modern Design
 */
const getTravelInsuranceConfirmationEmail = (data) => {
  const {
    contractNo,
    customerEmail,
    destination,
    coverBegins,
    coverEnds,
    noOfPeople,
    totalAmount,
    paymentReference,
    paymentDate,
    planName
  } = data;

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">shield</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Insurance Confirmed</p>
          </div>
        </div>
        <div class="booking-ref-badge">
          <p class="booking-ref-label">POLICY NUMBER</p>
          <p class="booking-ref-value">${contractNo}</p>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">You're covered for your journey!</h1>
      <p class="subtext">Your travel insurance policy has been successfully activated. Your payment has been confirmed and your coverage is now in effect.</p>

      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">verified_user</span>
          <h3 class="info-card-title">Policy Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Plan Name</span>
          <span class="info-value">${planName || 'Travel Insurance'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Destination</span>
          <span class="info-value">${destination || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Number of Travelers</span>
          <span class="info-value">${noOfPeople || 1} traveler(s)</span>
        </div>
      </div>

      <div class="timeline-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">date_range</span>
          <h3 class="info-card-title">Coverage Period</h3>
        </div>
        
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-line"></div>
          <p class="timeline-time">Coverage Begins</p>
          <p class="timeline-location">${coverBegins || 'N/A'}</p>
          <p class="timeline-details">Policy activation date</p>
        </div>

        <div class="duration-badge">
          <p class="duration-text">
            <span class="material-icons-outlined" style="font-size: 16px;">schedule</span>
            Full Coverage Active
          </p>
        </div>

        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <p class="timeline-time">Coverage Ends</p>
          <p class="timeline-location">${coverEnds || 'N/A'}</p>
          <p class="timeline-details">Policy expiration date</p>
        </div>
      </div>

      <div style="margin: 32px 0;">
        <h3 style="font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900}; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">What to do next</h3>
        <div class="action-cards">
          <div class="action-card">
            <span class="material-icons-outlined action-icon">download</span>
            <p class="action-title">Download Policy</p>
            <p class="action-desc">Get your full policy document</p>
            <a href="#" class="action-link">Download Now</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">description</span>
            <p class="action-title">Coverage Details</p>
            <p class="action-desc">Review what's covered</p>
            <a href="#" class="action-link">View Details</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">support_agent</span>
            <p class="action-title">Emergency Support</p>
            <p class="action-desc">24/7 assistance hotline</p>
            <a href="#" class="action-link">Get Number</a>
          </div>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">info</span>
          Important Information
        </p>
        <ul class="alert-list">
          <li>Keep your policy number (${contractNo}) safe for reference</li>
          <li>Your policy is valid from ${coverBegins || 'your travel start date'}</li>
          <li>For claims or emergencies, contact our 24/7 support line</li>
          <li>Carry a copy of this confirmation when traveling</li>
        </ul>
      </div>
    </div>

    <div class="dark-section">
      <h3 class="dark-section-title">Payment Information</h3>
      <div class="dark-info-grid">
        <div class="dark-info-item">
          <p class="dark-info-label">Payment Reference</p>
          <p class="dark-info-value">${paymentReference}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Payment Date</p>
          <p class="dark-info-value">${paymentDate || new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Email</p>
          <p class="dark-info-value">${customerEmail || 'N/A'}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Payment Status</p>
          <p class="dark-info-value" style="color: ${BRAND_COLORS.green};">Paid</p>
        </div>
      </div>
      <div class="price-section">
        <p class="price-label">Total Paid</p>
        <p class="price-value">₦${totalAmount?.toLocaleString() || '0'}</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">shield</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">This is an automated email for your travel insurance confirmation.<br>Please keep this for your records and carry it when traveling.</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">File a Claim</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Terms of Use</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Travel Insurance Confirmed');
};

/**
 * Hotel Booking Confirmation Email - Modern Design
 */
const getHotelConfirmationEmail = (data) => {
  const {
    bookingReference,
    hotelName,
    location,
    checkIn,
    checkOut,
    nights,
    rooms,
    guests,
    totalAmount,
    guestName,
    guestEmail
  } = data;

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">hotel</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Booking Confirmed</p>
          </div>
        </div>
        <div class="booking-ref-badge">
          <p class="booking-ref-label">BOOKING REFERENCE</p>
          <p class="booking-ref-value">${bookingReference}</p>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">Your stay is confirmed, ${guestName || 'Guest'}!</h1>
      <p class="subtext">We're excited to welcome you. Your reservation details are below.</p>

      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">apartment</span>
          <h3 class="info-card-title">Hotel Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Hotel Name</span>
          <span class="info-value">${hotelName || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location</span>
          <span class="info-value">${location || 'N/A'}</span>
        </div>
      </div>

      <div class="timeline-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">event</span>
          <h3 class="info-card-title">Stay Details</h3>
        </div>
        
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-line"></div>
          <p class="timeline-time">Check-in</p>
          <p class="timeline-location">${checkIn || 'N/A'}</p>
          <p class="timeline-details">After 2:00 PM</p>
        </div>

        <div class="duration-badge">
          <p class="duration-text">
            <span class="material-icons-outlined" style="font-size: 16px;">nights_stay</span>
            ${nights || 1} Night(s)
          </p>
        </div>

        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <p class="timeline-time">Check-out</p>
          <p class="timeline-location">${checkOut || 'N/A'}</p>
          <p class="timeline-details">Before 12:00 PM</p>
        </div>
      </div>

      <div style="margin: 32px 0;">
        <h3 style="font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900}; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">What to do next</h3>
        <div class="action-cards">
          <div class="action-card">
            <span class="material-icons-outlined action-icon">location_on</span>
            <p class="action-title">Directions</p>
            <p class="action-desc">Get directions to the hotel</p>
            <a href="#" class="action-link">View Map</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">room_service</span>
            <p class="action-title">Amenities</p>
            <p class="action-desc">View hotel facilities and services</p>
            <a href="#" class="action-link">View Details</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">phone</span>
            <p class="action-title">Contact Hotel</p>
            <p class="action-desc">Call for special requests</p>
            <a href="#" class="action-link">Get Number</a>
          </div>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">info</span>
          Check-in Information
        </p>
        <ul class="alert-list">
          <li>Standard check-in time: 2:00 PM</li>
          <li>Standard check-out time: 12:00 PM</li>
          <li>Please bring a valid ID and this confirmation</li>
          <li>Early check-in subject to availability</li>
        </ul>
      </div>
    </div>

    <div class="dark-section">
      <h3 class="dark-section-title">Reservation Information</h3>
      <div class="dark-info-grid">
        <div class="dark-info-item">
          <p class="dark-info-label">Guest Name</p>
          <p class="dark-info-value">${guestName || 'Guest'}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Number of Rooms</p>
          <p class="dark-info-value">${rooms || 1} Room(s)</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Number of Guests</p>
          <p class="dark-info-value">${guests || 1} Guest(s)</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Email</p>
          <p class="dark-info-value">${guestEmail || 'N/A'}</p>
        </div>
      </div>
      <div class="price-section">
        <p class="price-label">Total Paid</p>
        <p class="price-value">₦${totalAmount?.toLocaleString() || '0'}</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">hotel</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">This is an automated email for your hotel reservation.<br>Please keep this for your records and present it at check-in.</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Manage Booking</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Terms of Use</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Hotel Booking Confirmed');
};

/**
 * Flight Booking Confirmation Email - Modern Design
 */
const getFlightConfirmationEmail = (data) => {
  const {
    bookingReference,
    pnr,
    airline,
    flightNumber,
    departure,
    arrival,
    departureTime,
    arrivalTime,
    departureDate,
    passengers,
    totalAmount,
    passengerName,
    cabin,
    duration
  } = data;

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">flight</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Booking Confirmed</p>
          </div>
        </div>
        <div class="booking-ref-badge">
          <p class="booking-ref-label">BOOKING REFERENCE</p>
          <p class="booking-ref-value">${pnr || bookingReference}</p>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">Ready for take off, ${passengerName || 'Traveler'}?</h1>
      <p class="subtext">Your flight has been successfully booked. Please find your itinerary details below.</p>

      <div class="timeline-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">calendar_today</span>
          <h3 class="info-card-title">${departureDate || 'Flight Date'}</h3>
        </div>
        
        <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
          <div style="background-color: ${BRAND_COLORS.lightRed}; color: ${BRAND_COLORS.red}; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            ${flightNumber || 'FLIGHT'}
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-line"></div>
          <p class="timeline-time">${departureTime || '08:30'}</p>
          <p class="timeline-location">${departure || 'Departure'}</p>
          <p class="timeline-details">${airline || 'Airline'}</p>
        </div>

        <div class="duration-badge">
          <p class="duration-text">
            <span class="material-icons-outlined" style="font-size: 16px;">schedule</span>
            ${duration || '7h 45m'} (Non-stop)
          </p>
        </div>

        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <p class="timeline-time">${arrivalTime || '20:15'}</p>
          <p class="timeline-location">${arrival || 'Arrival'}</p>
          <p class="timeline-details">${airline || 'Airline'}</p>
        </div>
      </div>

      <div style="margin: 32px 0;">
        <h3 style="font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900}; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">What to do next</h3>
        <div class="action-cards">
          <div class="action-card">
            <span class="material-icons-outlined action-icon">fact_check</span>
            <p class="action-title">Check-in</p>
            <p class="action-desc">Opens 24 hours before your flight departure</p>
            <a href="#" class="action-link">Check-in Now</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">luggage</span>
            <p class="action-title">Baggage</p>
            <p class="action-desc">Review your baggage allowance and fees</p>
            <a href="#" class="action-link">View Details</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">confirmation_number</span>
            <p class="action-title">Boarding Pass</p>
            <p class="action-desc">Get your boarding pass on your phone</p>
            <a href="#" class="action-link">Get Pass</a>
          </div>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">info</span>
          Important Travel Information
        </p>
        <ul class="alert-list">
          <li>Arrive at the airport at least 2-3 hours before departure</li>
          <li>Bring a valid ID/passport and this confirmation</li>
          <li>Check-in online to save time at the airport</li>
          <li>Review baggage allowance before packing</li>
        </ul>
      </div>
    </div>

    <div class="dark-section">
      <h3 class="dark-section-title">Traveler Information</h3>
      <div class="dark-info-grid">
        <div class="dark-info-item">
          <p class="dark-info-label">Passenger Name</p>
          <p class="dark-info-value">${passengerName || 'Traveler'}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Seat Class</p>
          <p class="dark-info-value">${cabin || 'Economy'}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Booking Type</p>
          <p class="dark-info-value">${passengers > 1 ? passengers + ' Passengers' : '1 Adult Traveling'}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Meal Preference</p>
          <p class="dark-info-value">Standard</p>
        </div>
      </div>
      <div class="price-section">
        <p class="price-label">Total Paid</p>
        <p class="price-value">₦${totalAmount?.toLocaleString() || '0'}</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">flight</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">This is an automated email for your flight confirmation.<br>Please keep this for your records and present it at check-in.</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Manage Trip</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Terms of Use</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Flight Booking Confirmed');
};

/**
 * Car Hire Confirmation Email - Modern Design
 */
const getCarHireConfirmationEmail = (data) => {
  const {
    bookingReference,
    carName,
    carBrand,
    carImage,
    pickupLocation,
    returnLocation,
    pickupDate,
    returnDate,
    totalAmount,
    driverName,
    driverEmail,
    transmission,
    capacity,
    pricePerDay
  } = data;

  // Calculate rental duration
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const days = Math.max(1, Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24)));

  // Format dates
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-NG', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-NG', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">directions_car</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Booking Confirmed</p>
          </div>
        </div>
        <div class="booking-ref-badge">
          <p class="booking-ref-label">BOOKING REFERENCE</p>
          <p class="booking-ref-value">${bookingReference}</p>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">Your car is ready, ${driverName || 'Driver'}!</h1>
      <p class="subtext">Your car hire booking has been confirmed. Get ready to hit the road!</p>

      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">directions_car</span>
          <h3 class="info-card-title">Vehicle Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Vehicle</span>
          <span class="info-value">${carBrand || ''} ${carName || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Transmission</span>
          <span class="info-value">${transmission || 'Automatic'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Capacity</span>
          <span class="info-value">${capacity || 5} Passengers</span>
        </div>
        <div class="info-row">
          <span class="info-label">Daily Rate</span>
          <span class="info-value">₦${pricePerDay?.toLocaleString() || '0'}/day</span>
        </div>
      </div>

      <div class="timeline-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">event</span>
          <h3 class="info-card-title">Rental Period</h3>
        </div>
        
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-line"></div>
          <p class="timeline-time">${formatTime(pickup)}</p>
          <p class="timeline-location">${pickupLocation || 'Pickup Location'}</p>
          <p class="timeline-details">${formatDate(pickup)}</p>
        </div>

        <div class="duration-badge">
          <p class="duration-text">
            <span class="material-icons-outlined" style="font-size: 16px;">schedule</span>
            ${days} Day${days > 1 ? 's' : ''} Rental
          </p>
        </div>

        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <p class="timeline-time">${formatTime(returnD)}</p>
          <p class="timeline-location">${returnLocation || 'Return Location'}</p>
          <p class="timeline-details">${formatDate(returnD)}</p>
        </div>
      </div>

      <div style="margin: 32px 0;">
        <h3 style="font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900}; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">What to do next</h3>
        <div class="action-cards">
          <div class="action-card">
            <span class="material-icons-outlined action-icon">badge</span>
            <p class="action-title">Required Documents</p>
            <p class="action-desc">Valid driver's license and ID</p>
            <a href="#" class="action-link">View List</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">location_on</span>
            <p class="action-title">Pickup Location</p>
            <p class="action-desc">Get directions to pickup point</p>
            <a href="#" class="action-link">View Map</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">phone</span>
            <p class="action-title">Contact Us</p>
            <p class="action-desc">Questions about your rental?</p>
            <a href="#" class="action-link">Get Help</a>
          </div>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">info</span>
          Important Pickup Information
        </p>
        <ul class="alert-list">
          <li>Bring your valid driver's license and a government-issued ID</li>
          <li>Arrive at the pickup location at your scheduled time</li>
          <li>Vehicle inspection will be done before handover</li>
          <li>Fuel policy: Return with the same fuel level as pickup</li>
          <li>Keep this booking reference handy: ${bookingReference}</li>
        </ul>
      </div>
    </div>

    <div class="dark-section">
      <h3 class="dark-section-title">Booking Information</h3>
      <div class="dark-info-grid">
        <div class="dark-info-item">
          <p class="dark-info-label">Driver Name</p>
          <p class="dark-info-value">${driverName || 'Driver'}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Email</p>
          <p class="dark-info-value">${driverEmail || 'N/A'}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Rental Duration</p>
          <p class="dark-info-value">${days} Day${days > 1 ? 's' : ''}</p>
        </div>
        <div class="dark-info-item">
          <p class="dark-info-label">Payment Status</p>
          <p class="dark-info-value" style="color: ${BRAND_COLORS.green};">Paid</p>
        </div>
      </div>
      <div class="price-section">
        <p class="price-label">Total Paid</p>
        <p class="price-value">₦${totalAmount?.toLocaleString() || '0'}</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">directions_car</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">This is an automated email for your car hire booking.<br>Please keep this for your records and present it at pickup.</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Manage Booking</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}" class="footer-link">Terms of Use</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Car Hire Booking Confirmed');
};

/**
 * Email Verification OTP Email - Modern Design
 */
const getEmailVerificationOtpEmail = (data) => {
  const { otp, email, expiryMinutes = 10 } = data;

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">verified_user</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Email Verification</p>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">Verify your email address</h1>
      <p class="subtext">To complete your registration, please enter the verification code below:</p>

      <div style="background: linear-gradient(135deg, ${BRAND_COLORS.red} 0%, ${BRAND_COLORS.redDark} 100%); border-radius: 16px; padding: 40px; text-align: center; margin: 32px 0;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255, 255, 255, 0.8); margin: 0 0 16px 0;">Your Verification Code</p>
        <div style="background-color: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 12px; padding: 24px; display: inline-block;">
          <p style="font-size: 48px; font-weight: 700; letter-spacing: 12px; color: ${BRAND_COLORS.white}; margin: 0; font-family: 'Courier New', monospace;">${otp}</p>
        </div>
        <p style="font-size: 13px; color: rgba(255, 255, 255, 0.9); margin: 20px 0 0 0;">This code expires in ${expiryMinutes} minutes</p>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">info</span>
          <h3 class="info-card-title">Security Tips</h3>
        </div>
        <div style="padding: 12px 0;">
          <p style="font-size: 13px; color: ${BRAND_COLORS.gray700}; line-height: 1.6; margin: 0;">
            • Never share this code with anyone<br>
            • The Travel Place will never ask for your verification code<br>
            • If you didn't request this code, please ignore this email<br>
            • This code is only valid for ${expiryMinutes} minutes
          </p>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">help_outline</span>
          Didn't request this?
        </p>
        <p class="alert-content">
          If you didn't try to register with The Travel Place, you can safely ignore this email. Your account security is important to us.
        </p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">verified_user</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">This is an automated security email for account verification.<br>For your security, do not share this code with anyone.</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/help" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/privacy" class="footer-link">Privacy Policy</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Verify Your Email - The Travel Place');
};

/**
 * Welcome Email - Modern Design
 */
const getWelcomeEmail = (data) => {
  const { firstName, email } = data;

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">celebration</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Welcome Aboard!</p>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">Welcome to The Travel Place, ${firstName || 'Traveler'}! 🎉</h1>
      <p class="subtext">Your account has been successfully created. We're excited to help you explore the world!</p>

      <div style="background: linear-gradient(135deg, ${BRAND_COLORS.red} 0%, ${BRAND_COLORS.redDark} 100%); border-radius: 16px; padding: 32px; text-align: center; margin: 32px 0;">
        <span class="material-icons-outlined" style="font-size: 64px; color: ${BRAND_COLORS.white}; margin-bottom: 16px;">luggage</span>
        <p style="font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.white}; margin: 0 0 8px 0;">Your Journey Starts Here</p>
        <p style="font-size: 14px; color: rgba(255, 255, 255, 0.9); margin: 0;">Book flights, hotels, car rentals, and more - all in one place</p>
      </div>

      <div style="margin: 32px 0;">
        <h3 style="font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900}; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">What you can do now</h3>
        <div class="action-cards">
          <div class="action-card">
            <span class="material-icons-outlined action-icon">flight</span>
            <p class="action-title">Book Flights</p>
            <p class="action-desc">Search and compare flights worldwide</p>
            <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/flights" class="action-link">Search Flights</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">hotel</span>
            <p class="action-title">Find Hotels</p>
            <p class="action-desc">Discover great accommodation deals</p>
            <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/hotels" class="action-link">Browse Hotels</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">directions_car</span>
            <p class="action-title">Rent a Car</p>
            <p class="action-desc">Get the best car rental rates</p>
            <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/cars" class="action-link">Rent Now</a>
          </div>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">account_circle</span>
          <h3 class="info-card-title">Your Account Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Email Address</span>
          <span class="info-value">${email || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Account Status</span>
          <span class="info-value" style="color: ${BRAND_COLORS.green};">Active</span>
        </div>
        <div class="info-row">
          <span class="info-label">Member Since</span>
          <span class="info-value">${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">tips_and_updates</span>
          Pro Tips for Your First Booking
        </p>
        <ul class="alert-list">
          <li>Complete your profile for faster checkout</li>
          <li>Enable notifications to get the best travel deals</li>
          <li>Save your favorite destinations for quick access</li>
          <li>Check out our travel guides and tips</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">celebration</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">Thank you for choosing The Travel Place for your travel needs.<br>We're here to make your journey unforgettable!</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/help" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/about" class="footer-link">About Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/blog" class="footer-link">Travel Blog</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Welcome to The Travel Place!');
};

/**
 * Password Reset Email - Modern Design
 */
const getPasswordResetEmail = (data) => {
  const { firstName, resetUrl, expiryMinutes = 30 } = data;

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">lock_reset</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Password Reset</p>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">Reset your password</h1>
      <p class="subtext">Hi ${firstName || 'there'}, we received a request to reset your password. Click the button below to create a new password.</p>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLORS.red} 0%, ${BRAND_COLORS.redDark} 100%); color: ${BRAND_COLORS.white}; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
          Reset Password
        </a>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">schedule</span>
          <h3 class="info-card-title">Link Expiration</h3>
        </div>
        <div style="padding: 12px 0;">
          <p style="font-size: 13px; color: ${BRAND_COLORS.gray700}; line-height: 1.6; margin: 0;">
            This password reset link will expire in <strong>${expiryMinutes} minutes</strong> for security reasons. If you need a new link, you can request another password reset from the login page.
          </p>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">security</span>
          Security Notice
        </p>
        <ul class="alert-list">
          <li>Never share your password with anyone</li>
          <li>Use a strong, unique password</li>
          <li>If you didn't request this reset, please ignore this email</li>
          <li>Your current password will remain active until you set a new one</li>
        </ul>
      </div>

      <div style="background-color: ${BRAND_COLORS.gray100}; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="font-size: 12px; color: ${BRAND_COLORS.gray600}; margin: 0 0 8px 0;">If the button doesn't work, copy and paste this link:</p>
        <p style="font-size: 11px; color: ${BRAND_COLORS.gray500}; word-break: break-all; margin: 0;">${resetUrl}</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">lock_reset</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">This is an automated security email for password reset.<br>If you didn't request this, please contact our support team immediately.</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/help" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/privacy" class="footer-link">Security</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Reset Your Password - The Travel Place');
};

/**
 * Account Verification Success Email - Modern Design
 */
const getAccountVerifiedEmail = (data) => {
  const { firstName, email } = data;

  const content = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">check_circle</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">THE TRAVEL PLACE</p>
            <p class="brand-tagline">Account Verified</p>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">Your account is verified! ✓</h1>
      <p class="subtext">Congratulations ${firstName || 'Traveler'}! Your email has been successfully verified and your account is now fully active.</p>

      <div style="background: linear-gradient(135deg, ${BRAND_COLORS.green} 0%, #059669 100%); border-radius: 16px; padding: 40px; text-align: center; margin: 32px 0;">
        <span class="material-icons-outlined" style="font-size: 80px; color: ${BRAND_COLORS.white}; margin-bottom: 16px;">verified</span>
        <p style="font-size: 20px; font-weight: 600; color: ${BRAND_COLORS.white}; margin: 0 0 8px 0;">Account Successfully Verified</p>
        <p style="font-size: 14px; color: rgba(255, 255, 255, 0.9); margin: 0;">You can now access all features of The Travel Place</p>
      </div>

      <div style="margin: 32px 0;">
        <h3 style="font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.gray900}; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">Start exploring</h3>
        <div class="action-cards">
          <div class="action-card">
            <span class="material-icons-outlined action-icon">dashboard</span>
            <p class="action-title">Your Dashboard</p>
            <p class="action-desc">Manage bookings and preferences</p>
            <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/dashboard" class="action-link">Go to Dashboard</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">explore</span>
            <p class="action-title">Browse Services</p>
            <p class="action-desc">Discover travel options</p>
            <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/services" class="action-link">Explore Now</a>
          </div>
          <div class="action-card">
            <span class="material-icons-outlined action-icon">person</span>
            <p class="action-title">Complete Profile</p>
            <p class="action-desc">Add more details for faster booking</p>
            <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/profile" class="action-link">Update Profile</a>
          </div>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">verified_user</span>
          <h3 class="info-card-title">Verified Account Benefits</h3>
        </div>
        <div style="padding: 12px 0;">
          <p style="font-size: 13px; color: ${BRAND_COLORS.gray700}; line-height: 1.6; margin: 0;">
            ✓ Book flights, hotels, and car rentals<br>
            ✓ Access exclusive deals and offers<br>
            ✓ Manage all your bookings in one place<br>
            ✓ Get personalized travel recommendations<br>
            ✓ 24/7 customer support
          </p>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">check_circle</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">Your account is now fully activated and ready to use.<br>Happy travels!</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/help" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/about" class="footer-link">About Us</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(content, 'Account Verified - The Travel Place');
};

/**
 * Generate email HTML from database template
 * @param {Object} template - Email template from database
 * @param {Object} data - Data to populate template variables
 * @returns {string} - Generated HTML email
 */
const generateEmailFromTemplate = (template, data) => {
  // Replace variables in content
  let content = template.mainContent;
  let greeting = template.greeting;
  let subject = template.subject;
  
  // Replace all {{variable}} placeholders
  const replaceVariables = (text) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] || match;
    });
  };

  content = replaceVariables(content);
  greeting = replaceVariables(greeting);
  subject = replaceVariables(subject);

  const emailContent = `
    <div class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons-outlined" style="color: ${BRAND_COLORS.red}; font-size: 24px;">${template.headerIcon || 'mail'}</span>
          </div>
          <div class="brand-text">
            <p class="brand-name">${template.headerTitle || 'THE TRAVEL PLACE'}</p>
            ${template.headerSubtitle ? `<p class="brand-tagline">${template.headerSubtitle}</p>` : ''}
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <h1 class="greeting">${greeting}</h1>
      <div class="subtext">
        ${content}
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <span class="material-icons-outlined footer-brand-icon">${template.headerIcon || 'mail'}</span>
        <span class="footer-brand-name">THE TRAVEL PLACE</span>
      </div>
      <p class="footer-text">${template.footerText || 'Thank you for choosing The Travel Place.'}</p>
      <div class="footer-links">
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/help" class="footer-link">Help Center</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/contact" class="footer-link">Contact Us</a>
        <a href="${process.env.FRONTEND_URL || 'https://test.ttp.ng'}/about" class="footer-link">About Us</a>
      </div>
      <p class="footer-copyright">© ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
    </div>
  `;

  return getBaseTemplate(emailContent, subject);
};

module.exports = {
  getTravelInsuranceConfirmationEmail,
  getHotelConfirmationEmail,
  getFlightConfirmationEmail,
  getCarHireConfirmationEmail,
  getEmailVerificationOtpEmail,
  getWelcomeEmail,
  getPasswordResetEmail,
  getAccountVerifiedEmail,
  generateEmailFromTemplate,
  BRAND_COLORS
};
