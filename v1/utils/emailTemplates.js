// v1/utils/emailTemplates.js

/**
 * Brand Colors - Matching the modern design
 * NOTE: Kept for reference. All usage in templates uses inline styles, NOT CSS classes.
 */
const BRAND_COLORS = {
  red: '#dc2626',
  redDark: '#b91c1c',
  navy: '#1e3a8a',
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

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED HELPERS
───────────────────────────────────────────────────────────────────────────── */

/**
 * Renders a shared header block (table-based, no flex/grid).
 * @param {string} icon       - Emoji icon for the brand-icon square
 * @param {string} tagline    - Short line under "THE TRAVEL PLACE"
 * @param {string} refLabel   - Badge label (e.g. "BOOKING REFERENCE"), or '' to hide
 * @param {string} refValue   - Badge value (e.g. booking ref number), or '' to hide
 */
const renderHeader = (icon, tagline, refLabel = '', refValue = '') => {
  const badgeCell = (refLabel && refValue) ? `
        <td style="vertical-align:top; text-align:right; padding:0; white-space:nowrap;">
          <table border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="background-color:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:8px; padding:8px 16px; text-align:right;">
                <p style="font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:rgba(255,255,255,0.8); margin:0 0 4px 0; font-family:Arial,Helvetica,sans-serif;">${refLabel}</p>
                <p style="font-size:16px; font-weight:700; color:#ffffff; letter-spacing:1px; margin:0; font-family:Arial,Helvetica,sans-serif;">${refValue}</p>
              </td>
            </tr>
          </table>
        </td>` : `<td style="padding:0;"></td>`;

  return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#dc2626; padding:32px 32px 24px 32px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <tr>
            <td style="vertical-align:top; padding:0;">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle; padding:0 12px 0 0;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background-color:#ffffff; border-radius:8px; width:40px; height:40px; text-align:center; vertical-align:middle; padding:0;">
                          <span style="font-size:22px; line-height:40px;">${icon}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle; padding:0;">
                    <p style="font-size:18px; font-weight:700; color:#ffffff; margin:0 0 2px 0; font-family:Arial,Helvetica,sans-serif;">THE TRAVEL PLACE</p>
                    <p style="font-size:11px; font-weight:400; color:rgba(255,255,255,0.9); margin:0; font-family:Arial,Helvetica,sans-serif;">${tagline}</p>
                  </td>
                </tr>
              </table>
            </td>
            ${badgeCell}
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
};

/**
 * Renders a single info-row inside an info-card table.
 * @param {string} label
 * @param {string} value
 * @param {boolean} isLast  - If true, no bottom border
 * @param {string} valueColor - Optional override for value text color
 */
const renderInfoRow = (label, value, isLast = false, valueColor = '#111827') => {
  const borderStyle = isLast ? 'none' : '1px solid #e5e7eb';
  return `
  <tr>
    <td style="padding:12px 0; border-bottom:${borderStyle}; font-size:13px; color:#4b5563; font-family:Arial,Helvetica,sans-serif; vertical-align:middle;">${label}</td>
    <td style="padding:12px 0; border-bottom:${borderStyle}; font-size:13px; color:${valueColor}; font-weight:600; font-family:Arial,Helvetica,sans-serif; vertical-align:middle; text-align:right;">${value}</td>
  </tr>`;
};

/**
 * Renders an info-card with header icon+title and info rows.
 * @param {string} icon       - Emoji
 * @param {string} title      - Section title (uppercase small)
 * @param {string} rowsHtml   - Pre-rendered <tr> rows HTML
 */
const renderInfoCard = (icon, title, rowsHtml) => {
  return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:24px 0;">
    <tr>
      <td style="background-color:#f5f5f5; border-radius:12px; padding:24px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <tr>
            <td style="padding:0 8px 20px 0; vertical-align:middle; width:24px;">
              <span style="font-size:20px; color:#dc2626;">${icon}</span>
            </td>
            <td style="padding:0 0 20px 0; vertical-align:middle;">
              <p style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin:0; font-family:Arial,Helvetica,sans-serif;">${title}</p>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          ${rowsHtml}
        </table>
      </td>
    </tr>
  </table>`;
};

/**
 * Renders a timeline card with two endpoints and a middle badge.
 * @param {string} icon           - Emoji for header
 * @param {string} title          - Header title
 * @param {string} startTime      - Top time/title text (large)
 * @param {string} startLocation  - Top subtitle
 * @param {string} startDetail    - Top small detail
 * @param {string} middleBadge    - Center badge text (e.g. duration)
 * @param {string} endTime
 * @param {string} endLocation
 * @param {string} endDetail
 */
const renderTimelineCard = (icon, title, startTime, startLocation, startDetail, middleBadge, endTime, endLocation, endDetail) => {
  return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:24px 0;">
    <tr>
      <td style="background-color:#f5f5f5; border-radius:12px; padding:24px;">
        <!-- Header row -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <tr>
            <td style="padding:0 8px 20px 0; vertical-align:middle; width:24px;">
              <span style="font-size:20px; color:#dc2626;">${icon}</span>
            </td>
            <td style="padding:0 0 20px 0; vertical-align:middle;">
              <p style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin:0; font-family:Arial,Helvetica,sans-serif;">${title}</p>
            </td>
          </tr>
        </table>
        <!-- Timeline rows -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <!-- Start point -->
          <tr>
            <td style="vertical-align:top; width:20px; padding:0 12px 0 0; text-align:center;">
              <span style="font-size:14px; color:#dc2626;">&#9679;</span>
            </td>
            <td style="vertical-align:top; padding:0 0 4px 0;">
              <p style="font-size:20px; font-weight:700; color:#111827; margin:0 0 2px 0; font-family:Arial,Helvetica,sans-serif;">${startTime}</p>
              <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 2px 0; font-family:Arial,Helvetica,sans-serif;">${startLocation}</p>
              <p style="font-size:12px; color:#6b7280; margin:0; font-family:Arial,Helvetica,sans-serif;">${startDetail}</p>
            </td>
          </tr>
          <!-- Vertical line spacer -->
          <tr>
            <td style="text-align:center; width:20px; padding:2px 12px 2px 0;">
              <span style="font-size:14px; color:#d1d5db; line-height:1;">&#9474;</span>
            </td>
            <td style="padding:0;"></td>
          </tr>
          <tr>
            <td style="text-align:center; width:20px; padding:2px 12px 2px 0;">
              <span style="font-size:14px; color:#d1d5db; line-height:1;">&#9474;</span>
            </td>
            <td style="padding:4px 0; vertical-align:middle; text-align:center;">
              <p style="font-size:12px; color:#6b7280; margin:0; font-family:Arial,Helvetica,sans-serif;">${middleBadge}</p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center; width:20px; padding:2px 12px 2px 0;">
              <span style="font-size:14px; color:#d1d5db; line-height:1;">&#9474;</span>
            </td>
            <td style="padding:0;"></td>
          </tr>
          <!-- End point -->
          <tr>
            <td style="vertical-align:top; width:20px; padding:0 12px 0 0; text-align:center;">
              <span style="font-size:14px; color:#dc2626;">&#9679;</span>
            </td>
            <td style="vertical-align:top; padding:4px 0 0 0;">
              <p style="font-size:20px; font-weight:700; color:#111827; margin:0 0 2px 0; font-family:Arial,Helvetica,sans-serif;">${endTime}</p>
              <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 2px 0; font-family:Arial,Helvetica,sans-serif;">${endLocation}</p>
              <p style="font-size:12px; color:#6b7280; margin:0; font-family:Arial,Helvetica,sans-serif;">${endDetail}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
};

/**
 * Renders a 3-column action cards row.
 * Each card: { icon, title, desc, linkText, linkUrl }
 */
const renderActionCards = (sectionTitle, cards) => {
  const cardCells = cards.map((c, i) => {
    const isLast = i === cards.length - 1;
    return `
      <td style="width:33%; vertical-align:top; padding:0 ${isLast ? '0' : '8px'} 0 ${i === 0 ? '0' : '8px'};">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <tr>
            <td style="background-color:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:20px 12px; text-align:center; vertical-align:top;">
              <p style="font-size:32px; margin:0 0 10px 0; line-height:1;">${c.icon}</p>
              <p style="font-size:13px; font-weight:600; color:#111827; margin:0 0 6px 0; font-family:Arial,Helvetica,sans-serif;">${c.title}</p>
              <p style="font-size:11px; color:#6b7280; line-height:1.4; margin:0 0 8px 0; font-family:Arial,Helvetica,sans-serif;">${c.desc}</p>
              <a href="${c.linkUrl || '#'}" style="font-size:11px; font-weight:600; color:#dc2626; text-decoration:none; text-transform:uppercase; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">${c.linkText}</a>
            </td>
          </tr>
        </table>
      </td>`;
  }).join('');

  return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:32px 0 8px 0;">
    <tr>
      <td style="padding:0 0 16px 0;">
        <p style="font-size:14px; font-weight:600; color:#111827; margin:0; text-transform:uppercase; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">${sectionTitle}</p>
      </td>
    </tr>
    <tr>
      ${cardCells}
    </tr>
  </table>`;
};

/**
 * Renders an alert/info box with yellow left border effect.
 * @param {string} icon     - Emoji
 * @param {string} title    - Alert title
 * @param {string} bodyHtml - Inner HTML (e.g. <ul> list or <p>)
 */
const renderAlertBox = (icon, title, bodyHtml) => {
  return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:24px 0;">
    <tr>
      <!-- Left colored border cell -->
      <td style="width:4px; background-color:#f59e0b; border-radius:4px 0 0 4px; padding:0;">&nbsp;</td>
      <!-- Alert content -->
      <td style="background-color:#fef3c7; border-radius:0 8px 8px 0; padding:16px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <tr>
            <td style="padding:0 0 8px 0;">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:0 8px 0 0; vertical-align:middle;">
                    <span style="font-size:18px;">${icon}</span>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="font-size:13px; font-weight:600; color:#92400e; margin:0; font-family:Arial,Helvetica,sans-serif;">${title}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="font-size:12px; color:#78350f; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
};

/**
 * Renders the dark payment/info section.
 * @param {string} sectionTitle
 * @param {Array}  items        - [{label, value, valueColor?}]
 * @param {string} totalLabel
 * @param {string} totalValue
 */
const renderDarkSection = (sectionTitle, items, totalLabel, totalValue) => {
  // Pair items into rows of 2
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] || null]);
  }

  const rowsHtml = rows.map(([left, right]) => {
    const rightCell = right ? `
        <td style="width:50%; vertical-align:top; padding:0 0 20px 10px;">
          <p style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px 0; font-family:Arial,Helvetica,sans-serif;">${right.label}</p>
          <p style="font-size:14px; font-weight:600; color:${right.valueColor || '#ffffff'}; margin:0; font-family:Arial,Helvetica,sans-serif;">${right.value}</p>
        </td>` : `<td style="width:50%; padding:0;"></td>`;
    return `
    <tr>
      <td style="width:50%; vertical-align:top; padding:0 10px 20px 0;">
        <p style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px 0; font-family:Arial,Helvetica,sans-serif;">${left.label}</p>
        <p style="font-size:14px; font-weight:600; color:${left.valueColor || '#ffffff'}; margin:0; font-family:Arial,Helvetica,sans-serif;">${left.value}</p>
      </td>
      ${rightCell}
    </tr>`;
  }).join('');

  return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#1f2937; padding:32px;">
        <p style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin:0 0 20px 0; font-family:Arial,Helvetica,sans-serif;">${sectionTitle}</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          ${rowsHtml}
        </table>
        <!-- Total price row -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <tr>
            <td style="border-top:1px solid #374151; padding:20px 0 0 0; vertical-align:middle;">
              <p style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin:0; font-family:Arial,Helvetica,sans-serif;">${totalLabel}</p>
            </td>
            <td style="border-top:1px solid #374151; padding:20px 0 0 0; vertical-align:middle; text-align:right;">
              <p style="font-size:24px; font-weight:700; color:#ffffff; margin:0; font-family:Arial,Helvetica,sans-serif;">${totalValue}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
};

/**
 * Renders the footer.
 * @param {string} icon        - Emoji
 * @param {string} bodyText    - Footer description text (may contain <br>)
 * @param {Array}  links       - [{label, url}]
 */
const renderFooter = (icon, bodyText, links) => {
  const linkCells = links.map(l =>
    `<td style="padding:0 12px;"><a href="${l.url}" style="font-size:12px; color:#9ca3af; text-decoration:none; font-family:Arial,Helvetica,sans-serif;">${l.label}</a></td>`
  ).join('');

  return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#1f2937; padding:32px; text-align:center;">
        <!-- Brand row -->
        <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin:0 auto 16px auto;">
          <tr>
            <td style="padding:0 8px 0 0; vertical-align:middle;">
              <span style="font-size:20px; color:#dc2626;">${icon}</span>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:14px; font-weight:700; color:#ffffff; font-family:Arial,Helvetica,sans-serif;">THE TRAVEL PLACE</span>
            </td>
          </tr>
        </table>
        <p style="font-size:12px; color:#9ca3af; line-height:1.6; margin:0 0 20px 0; font-family:Arial,Helvetica,sans-serif;">${bodyText}</p>
        <!-- Links row -->
        <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin:0 auto 20px auto;">
          <tr>
            ${linkCells}
          </tr>
        </table>
        <p style="font-size:11px; color:#6b7280; margin:0; font-family:Arial,Helvetica,sans-serif;">&#169; ${new Date().getFullYear()} The Travel Place. All rights reserved.</p>
      </td>
    </tr>
  </table>`;
};

/* ─────────────────────────────────────────────────────────────────────────────
   BASE TEMPLATE
───────────────────────────────────────────────────────────────────────────── */

/**
 * Wraps content in a full, email-client-safe HTML document.
 * Uses table layout for centering. No flex, no grid.
 */
const getBaseTemplate = (content, title = 'The Travel Place') => {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    body { margin:0 !important; padding:0 !important; width:100% !important; background-color:#f5f5f5; }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial,Helvetica,sans-serif;">
  <!-- Outer wrapper table -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:#f5f5f5;">
    <tr>
      <td style="padding:40px 20px;" align="center">
        <!-- Email container (max 600px) -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" role="presentation" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:16px; overflow:hidden;">
          <tr>
            <td style="padding:0;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/* ─────────────────────────────────────────────────────────────────────────────
   TRAVEL INSURANCE CONFIRMATION
───────────────────────────────────────────────────────────────────────────── */

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

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const content = `
  ${renderHeader('🛡', 'Insurance Confirmed', 'POLICY NUMBER', contractNo)}

  <!-- Main content area -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">You're covered for your journey!</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 24px 0; font-family:Arial,Helvetica,sans-serif;">Your travel insurance policy has been successfully activated. Your payment has been confirmed and your coverage is now in effect.</p>

        ${renderInfoCard('🛡', 'Policy Details', `
          ${renderInfoRow('Plan Name', planName || 'Travel Insurance')}
          ${renderInfoRow('Destination', destination || 'N/A')}
          ${renderInfoRow('Number of Travelers', (noOfPeople || 1) + ' traveler(s)', true)}
        `)}

        ${renderTimelineCard(
          '📅', 'Coverage Period',
          'Coverage Begins', coverBegins || 'N/A', 'Policy activation date',
          '&#9201; Full Coverage Active',
          'Coverage Ends', coverEnds || 'N/A', 'Policy expiration date'
        )}

        ${renderActionCards('What to do next', [
          { icon: '⬇', title: 'Download Policy', desc: 'Get your full policy document', linkText: 'Download Now', linkUrl: '#' },
          { icon: '📄', title: 'Coverage Details', desc: "Review what's covered", linkText: 'View Details', linkUrl: '#' },
          { icon: '🎧', title: 'Emergency Support', desc: '24/7 assistance hotline', linkText: 'Get Number', linkUrl: '#' }
        ])}

        ${renderAlertBox('ℹ', 'Important Information', `
          <ul style="margin:0; padding:0 0 0 18px;">
            <li style="margin:4px 0;">Keep your policy number (${contractNo}) safe for reference</li>
            <li style="margin:4px 0;">Your policy is valid from ${coverBegins || 'your travel start date'}</li>
            <li style="margin:4px 0;">For claims or emergencies, contact our 24/7 support line</li>
            <li style="margin:4px 0;">Carry a copy of this confirmation when traveling</li>
          </ul>
        `)}
      </td>
    </tr>
  </table>

  ${renderDarkSection('Payment Information', [
    { label: 'Payment Reference', value: paymentReference },
    { label: 'Payment Date', value: paymentDate || new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) },
    { label: 'Email', value: customerEmail || 'N/A' },
    { label: 'Payment Status', value: 'Paid', valueColor: '#10b981' }
  ], 'Total Paid', '&#8358;' + (totalAmount?.toLocaleString() || '0'))}

  ${renderFooter('🛡', 'This is an automated email for your travel insurance confirmation.<br>Please keep this for your records and carry it when traveling.', [
    { label: 'Help Center', url: feUrl },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'File a Claim', url: feUrl },
    { label: 'Terms of Use', url: feUrl }
  ])}`;

  return getBaseTemplate(content, 'Travel Insurance Confirmed');
};

/* ─────────────────────────────────────────────────────────────────────────────
   HOTEL CONFIRMATION
───────────────────────────────────────────────────────────────────────────── */

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

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const content = `
  ${renderHeader('🏨', 'Booking Confirmed', 'BOOKING REFERENCE', bookingReference)}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">Your stay is confirmed, ${guestName || 'Guest'}!</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 24px 0; font-family:Arial,Helvetica,sans-serif;">We're excited to welcome you. Your reservation details are below.</p>

        ${renderInfoCard('🏢', 'Hotel Details', `
          ${renderInfoRow('Hotel Name', hotelName || 'N/A')}
          ${renderInfoRow('Location', location || 'N/A', true)}
        `)}

        ${renderTimelineCard(
          '📅', 'Stay Details',
          'Check-in', checkIn || 'N/A', 'After 2:00 PM',
          '🌙 ' + (nights || 1) + ' Night(s)',
          'Check-out', checkOut || 'N/A', 'Before 12:00 PM'
        )}

        ${renderActionCards('What to do next', [
          { icon: '📍', title: 'Directions', desc: 'Get directions to the hotel', linkText: 'View Map', linkUrl: '#' },
          { icon: '🛎', title: 'Amenities', desc: 'View hotel facilities and services', linkText: 'View Details', linkUrl: '#' },
          { icon: '📞', title: 'Contact Hotel', desc: 'Call for special requests', linkText: 'Get Number', linkUrl: '#' }
        ])}

        ${renderAlertBox('ℹ', 'Check-in Information', `
          <ul style="margin:0; padding:0 0 0 18px;">
            <li style="margin:4px 0;">Standard check-in time: 2:00 PM</li>
            <li style="margin:4px 0;">Standard check-out time: 12:00 PM</li>
            <li style="margin:4px 0;">Please bring a valid ID and this confirmation</li>
            <li style="margin:4px 0;">Early check-in subject to availability</li>
          </ul>
        `)}
      </td>
    </tr>
  </table>

  ${renderDarkSection('Reservation Information', [
    { label: 'Guest Name', value: guestName || 'Guest' },
    { label: 'Number of Rooms', value: (rooms || 1) + ' Room(s)' },
    { label: 'Number of Guests', value: (guests || 1) + ' Guest(s)' },
    { label: 'Email', value: guestEmail || 'N/A' }
  ], 'Total Paid', '&#8358;' + (totalAmount?.toLocaleString() || '0'))}

  ${renderFooter('🏨', 'This is an automated email for your hotel reservation.<br>Please keep this for your records and present it at check-in.', [
    { label: 'Help Center', url: feUrl },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'Manage Booking', url: feUrl },
    { label: 'Terms of Use', url: feUrl }
  ])}`;

  return getBaseTemplate(content, 'Hotel Booking Confirmed');
};

/* ─────────────────────────────────────────────────────────────────────────────
   FLIGHT CONFIRMATION
───────────────────────────────────────────────────────────────────────────── */

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

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const content = `
  ${renderHeader('✈', 'Booking Confirmed', 'BOOKING REFERENCE', pnr || bookingReference)}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">Ready for take off, ${passengerName || 'Traveler'}?</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 24px 0; font-family:Arial,Helvetica,sans-serif;">Your flight has been successfully booked. Please find your itinerary details below.</p>

        <!-- Flight date + flight number badge -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:0 0 4px 0;">
          <tr>
            <td style="padding:0;">
              <p style="font-size:13px; color:#6b7280; margin:0; font-family:Arial,Helvetica,sans-serif;">&#128197; ${departureDate || 'Flight Date'}</p>
            </td>
            <td style="text-align:right; padding:0;">
              <span style="background-color:#fee2e2; color:#dc2626; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; font-family:Arial,Helvetica,sans-serif;">${flightNumber || 'FLIGHT'}</span>
            </td>
          </tr>
        </table>

        ${renderTimelineCard(
          '✈', 'Flight Itinerary',
          departureTime || '08:30', departure || 'Departure', airline || 'Airline',
          '&#9201; ' + (duration || '7h 45m') + ' (Non-stop)',
          arrivalTime || '20:15', arrival || 'Arrival', airline || 'Airline'
        )}

        ${renderActionCards('What to do next', [
          { icon: '✔', title: 'Check-in', desc: 'Opens 24 hours before your flight departure', linkText: 'Check-in Now', linkUrl: '#' },
          { icon: '🧳', title: 'Baggage', desc: 'Review your baggage allowance and fees', linkText: 'View Details', linkUrl: '#' },
          { icon: '🎫', title: 'Boarding Pass', desc: 'Get your boarding pass on your phone', linkText: 'Get Pass', linkUrl: '#' }
        ])}

        ${renderAlertBox('ℹ', 'Important Travel Information', `
          <ul style="margin:0; padding:0 0 0 18px;">
            <li style="margin:4px 0;">Arrive at the airport at least 2&ndash;3 hours before departure</li>
            <li style="margin:4px 0;">Bring a valid ID/passport and this confirmation</li>
            <li style="margin:4px 0;">Check-in online to save time at the airport</li>
            <li style="margin:4px 0;">Review baggage allowance before packing</li>
          </ul>
        `)}
      </td>
    </tr>
  </table>

  ${renderDarkSection('Traveler Information', [
    { label: 'Passenger Name', value: passengerName || 'Traveler' },
    { label: 'Seat Class', value: cabin || 'Economy' },
    { label: 'Booking Type', value: passengers > 1 ? passengers + ' Passengers' : '1 Adult Traveling' },
    { label: 'Meal Preference', value: 'Standard' }
  ], 'Total Paid', '&#8358;' + (totalAmount?.toLocaleString() || '0'))}

  ${renderFooter('✈', 'This is an automated email for your flight confirmation.<br>Please keep this for your records and present it at check-in.', [
    { label: 'Help Center', url: feUrl },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'Manage Trip', url: feUrl },
    { label: 'Terms of Use', url: feUrl }
  ])}`;

  return getBaseTemplate(content, 'Flight Booking Confirmed');
};

/* ─────────────────────────────────────────────────────────────────────────────
   CAR HIRE CONFIRMATION
───────────────────────────────────────────────────────────────────────────── */

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

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  // Calculate rental duration
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const days = Math.max(1, Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24)));

  const formatDate = (date) => new Date(date).toLocaleDateString('en-NG', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
  const formatTime = (date) => new Date(date).toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const content = `
  ${renderHeader('🚗', 'Booking Confirmed', 'BOOKING REFERENCE', bookingReference)}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">Your car is ready, ${driverName || 'Driver'}!</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 24px 0; font-family:Arial,Helvetica,sans-serif;">Your car hire booking has been confirmed. Get ready to hit the road!</p>

        ${renderInfoCard('🚗', 'Vehicle Details', `
          ${renderInfoRow('Vehicle', (carBrand || '') + ' ' + (carName || 'N/A'))}
          ${renderInfoRow('Transmission', transmission || 'Automatic')}
          ${renderInfoRow('Capacity', (capacity || 5) + ' Passengers')}
          ${renderInfoRow('Daily Rate', '&#8358;' + (pricePerDay?.toLocaleString() || '0') + '/day', true)}
        `)}

        ${renderTimelineCard(
          '📅', 'Rental Period',
          formatTime(pickup), pickupLocation || 'Pickup Location', formatDate(pickup),
          '&#9201; ' + days + ' Day' + (days > 1 ? 's' : '') + ' Rental',
          formatTime(returnD), returnLocation || 'Return Location', formatDate(returnD)
        )}

        ${renderActionCards('What to do next', [
          { icon: '🪪', title: 'Required Documents', desc: "Valid driver's license and ID", linkText: 'View List', linkUrl: '#' },
          { icon: '📍', title: 'Pickup Location', desc: 'Get directions to pickup point', linkText: 'View Map', linkUrl: '#' },
          { icon: '📞', title: 'Contact Us', desc: 'Questions about your rental?', linkText: 'Get Help', linkUrl: '#' }
        ])}

        ${renderAlertBox('ℹ', 'Important Pickup Information', `
          <ul style="margin:0; padding:0 0 0 18px;">
            <li style="margin:4px 0;">Bring your valid driver's license and a government-issued ID</li>
            <li style="margin:4px 0;">Arrive at the pickup location at your scheduled time</li>
            <li style="margin:4px 0;">Vehicle inspection will be done before handover</li>
            <li style="margin:4px 0;">Fuel policy: Return with the same fuel level as pickup</li>
            <li style="margin:4px 0;">Keep this booking reference handy: ${bookingReference}</li>
          </ul>
        `)}
      </td>
    </tr>
  </table>

  ${renderDarkSection('Booking Information', [
    { label: 'Driver Name', value: driverName || 'Driver' },
    { label: 'Email', value: driverEmail || 'N/A' },
    { label: 'Rental Duration', value: days + ' Day' + (days > 1 ? 's' : '') },
    { label: 'Payment Status', value: 'Paid', valueColor: '#10b981' }
  ], 'Total Paid', '&#8358;' + (totalAmount?.toLocaleString() || '0'))}

  ${renderFooter('🚗', 'This is an automated email for your car hire booking.<br>Please keep this for your records and present it at pickup.', [
    { label: 'Help Center', url: feUrl },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'Manage Booking', url: feUrl },
    { label: 'Terms of Use', url: feUrl }
  ])}`;

  return getBaseTemplate(content, 'Car Hire Booking Confirmed');
};

/* ─────────────────────────────────────────────────────────────────────────────
   EMAIL VERIFICATION OTP
───────────────────────────────────────────────────────────────────────────── */

const getEmailVerificationOtpEmail = (data) => {
  const { otp, email, expiryMinutes = 10 } = data;

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const content = `
  ${renderHeader('✅', 'Email Verification')}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">Verify your email address</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 32px 0; font-family:Arial,Helvetica,sans-serif;">To complete your registration, please enter the verification code below:</p>

        <!-- OTP Code Box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:0 0 32px 0;">
          <tr>
            <td style="background-color:#dc2626; border-radius:16px; padding:40px; text-align:center;">
              <p style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,0.8); margin:0 0 16px 0; font-family:Arial,Helvetica,sans-serif;">Your Verification Code</p>
              <!-- OTP digit box -->
              <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin:0 auto;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.3); border-radius:12px; padding:20px 32px; text-align:center;">
                    <p style="font-size:48px; font-weight:700; letter-spacing:12px; color:#ffffff; margin:0; font-family:'Courier New',Courier,monospace;">${otp}</p>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; color:rgba(255,255,255,0.9); margin:20px 0 0 0; font-family:Arial,Helvetica,sans-serif;">This code expires in ${expiryMinutes} minutes</p>
            </td>
          </tr>
        </table>

        ${renderInfoCard('🔒', 'Security Tips', `
          <tr>
            <td colspan="2" style="padding:12px 0;">
              <p style="font-size:13px; color:#374151; line-height:1.7; margin:0; font-family:Arial,Helvetica,sans-serif;">
                &#8226;&nbsp; Never share this code with anyone<br>
                &#8226;&nbsp; The Travel Place will never ask for your verification code<br>
                &#8226;&nbsp; If you didn't request this code, please ignore this email<br>
                &#8226;&nbsp; This code is only valid for ${expiryMinutes} minutes
              </p>
            </td>
          </tr>
        `)}

        ${renderAlertBox('❓', "Didn't request this?", `
          <p style="margin:0; font-family:Arial,Helvetica,sans-serif;">If you didn't try to register with The Travel Place, you can safely ignore this email. Your account security is important to us.</p>
        `)}
      </td>
    </tr>
  </table>

  ${renderFooter('✅', 'This is an automated security email for account verification.<br>For your security, do not share this code with anyone.', [
    { label: 'Help Center', url: feUrl + '/help' },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'Privacy Policy', url: feUrl + '/privacy' }
  ])}`;

  return getBaseTemplate(content, 'Verify Your Email - The Travel Place');
};

/* ─────────────────────────────────────────────────────────────────────────────
   WELCOME EMAIL
───────────────────────────────────────────────────────────────────────────── */

const getWelcomeEmail = (data) => {
  const { firstName, email } = data;

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const content = `
  ${renderHeader('🎉', 'Welcome Aboard!')}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">Welcome to The Travel Place, ${firstName || 'Traveler'}! &#127881;</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 32px 0; font-family:Arial,Helvetica,sans-serif;">Your account has been successfully created. We're excited to help you explore the world!</p>

        <!-- Hero banner -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:0 0 32px 0;">
          <tr>
            <td style="background-color:#dc2626; border-radius:16px; padding:32px; text-align:center;">
              <p style="font-size:56px; margin:0 0 16px 0; line-height:1;">🧳</p>
              <p style="font-size:18px; font-weight:600; color:#ffffff; margin:0 0 8px 0; font-family:Arial,Helvetica,sans-serif;">Your Journey Starts Here</p>
              <p style="font-size:14px; color:rgba(255,255,255,0.9); margin:0; font-family:Arial,Helvetica,sans-serif;">Book flights, hotels, car rentals, and more &mdash; all in one place</p>
            </td>
          </tr>
        </table>

        ${renderActionCards('What you can do now', [
          { icon: '✈', title: 'Book Flights', desc: 'Search and compare flights worldwide', linkText: 'Search Flights', linkUrl: feUrl + '/flights' },
          { icon: '🏨', title: 'Find Hotels', desc: 'Discover great accommodation deals', linkText: 'Browse Hotels', linkUrl: feUrl + '/hotels' },
          { icon: '🚗', title: 'Rent a Car', desc: 'Get the best car rental rates', linkText: 'Rent Now', linkUrl: feUrl + '/cars' }
        ])}

        ${renderInfoCard('👤', 'Your Account Details', `
          ${renderInfoRow('Email Address', email || 'N/A')}
          ${renderInfoRow('Account Status', '<span style="color:#10b981;">Active</span>')}
          ${renderInfoRow('Member Since', new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }), true)}
        `)}

        ${renderAlertBox('💡', 'Pro Tips for Your First Booking', `
          <ul style="margin:0; padding:0 0 0 18px;">
            <li style="margin:4px 0;">Complete your profile for faster checkout</li>
            <li style="margin:4px 0;">Enable notifications to get the best travel deals</li>
            <li style="margin:4px 0;">Save your favorite destinations for quick access</li>
            <li style="margin:4px 0;">Check out our travel guides and tips</li>
          </ul>
        `)}
      </td>
    </tr>
  </table>

  ${renderFooter('🎉', "Thank you for choosing The Travel Place for your travel needs.<br>We're here to make your journey unforgettable!", [
    { label: 'Help Center', url: feUrl + '/help' },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'About Us', url: feUrl + '/about' },
    { label: 'Travel Blog', url: feUrl + '/blog' }
  ])}`;

  return getBaseTemplate(content, 'Welcome to The Travel Place!');
};

/* ─────────────────────────────────────────────────────────────────────────────
   PASSWORD RESET EMAIL
───────────────────────────────────────────────────────────────────────────── */

const getPasswordResetEmail = (data) => {
  const { firstName, resetUrl, expiryMinutes = 30 } = data;

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const content = `
  ${renderHeader('🔒', 'Password Reset')}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">Reset your password</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 40px 0; font-family:Arial,Helvetica,sans-serif;">Hi ${firstName || 'there'}, we received a request to reset your password. Click the button below to create a new password.</p>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:0 0 40px 0;">
          <tr>
            <td style="text-align:center; padding:0;">
              <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#dc2626; border-radius:12px; text-align:center; padding:0;">
                    <a href="${resetUrl}" style="display:block; padding:16px 48px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; font-family:Arial,Helvetica,sans-serif; border-radius:12px;">Reset Password</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${renderInfoCard('⏱', 'Link Expiration', `
          <tr>
            <td colspan="2" style="padding:12px 0;">
              <p style="font-size:13px; color:#374151; line-height:1.6; margin:0; font-family:Arial,Helvetica,sans-serif;">
                This password reset link will expire in <strong>${expiryMinutes} minutes</strong> for security reasons. If you need a new link, you can request another password reset from the login page.
              </p>
            </td>
          </tr>
        `)}

        ${renderAlertBox('🔒', 'Security Notice', `
          <ul style="margin:0; padding:0 0 0 18px;">
            <li style="margin:4px 0;">Never share your password with anyone</li>
            <li style="margin:4px 0;">Use a strong, unique password</li>
            <li style="margin:4px 0;">If you didn't request this reset, please ignore this email</li>
            <li style="margin:4px 0;">Your current password will remain active until you set a new one</li>
          </ul>
        `)}

        <!-- Fallback link box -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:24px 0 0 0;">
          <tr>
            <td style="background-color:#f3f4f6; border-radius:12px; padding:20px; text-align:center;">
              <p style="font-size:12px; color:#4b5563; margin:0 0 8px 0; font-family:Arial,Helvetica,sans-serif;">If the button doesn't work, copy and paste this link:</p>
              <p style="font-size:11px; color:#6b7280; word-break:break-all; margin:0; font-family:Arial,Helvetica,sans-serif;">${resetUrl}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  ${renderFooter('🔒', "This is an automated security email for password reset.<br>If you didn't request this, please contact our support team immediately.", [
    { label: 'Help Center', url: feUrl + '/help' },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'Security', url: feUrl + '/privacy' }
  ])}`;

  return getBaseTemplate(content, 'Reset Your Password - The Travel Place');
};

/* ─────────────────────────────────────────────────────────────────────────────
   ACCOUNT VERIFIED EMAIL
───────────────────────────────────────────────────────────────────────────── */

const getAccountVerifiedEmail = (data) => {
  const { firstName, email } = data;

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const content = `
  ${renderHeader('✅', 'Account Verified')}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">Your account is verified! &#10003;</h1>
        <p style="font-size:14px; color:#4b5563; line-height:1.6; margin:0 0 32px 0; font-family:Arial,Helvetica,sans-serif;">Congratulations ${firstName || 'Traveler'}! Your email has been successfully verified and your account is now fully active.</p>

        <!-- Green verification banner -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:0 0 32px 0;">
          <tr>
            <td style="background-color:#10b981; border-radius:16px; padding:40px; text-align:center;">
              <p style="font-size:64px; margin:0 0 16px 0; line-height:1;">&#9989;</p>
              <p style="font-size:20px; font-weight:600; color:#ffffff; margin:0 0 8px 0; font-family:Arial,Helvetica,sans-serif;">Account Successfully Verified</p>
              <p style="font-size:14px; color:rgba(255,255,255,0.9); margin:0; font-family:Arial,Helvetica,sans-serif;">You can now access all features of The Travel Place</p>
            </td>
          </tr>
        </table>

        ${renderActionCards('Start exploring', [
          { icon: '📊', title: 'Your Dashboard', desc: 'Manage bookings and preferences', linkText: 'Go to Dashboard', linkUrl: feUrl + '/dashboard' },
          { icon: '🧭', title: 'Browse Services', desc: 'Discover travel options', linkText: 'Explore Now', linkUrl: feUrl + '/services' },
          { icon: '👤', title: 'Complete Profile', desc: 'Add more details for faster booking', linkText: 'Update Profile', linkUrl: feUrl + '/profile' }
        ])}

        ${renderInfoCard('✅', 'Verified Account Benefits', `
          <tr>
            <td colspan="2" style="padding:12px 0;">
              <p style="font-size:13px; color:#374151; line-height:1.7; margin:0; font-family:Arial,Helvetica,sans-serif;">
                &#10003;&nbsp; Book flights, hotels, and car rentals<br>
                &#10003;&nbsp; Access exclusive deals and offers<br>
                &#10003;&nbsp; Manage all your bookings in one place<br>
                &#10003;&nbsp; Get personalized travel recommendations<br>
                &#10003;&nbsp; 24/7 customer support
              </p>
            </td>
          </tr>
        `)}
      </td>
    </tr>
  </table>

  ${renderFooter('✅', 'Your account is now fully activated and ready to use.<br>Happy travels!', [
    { label: 'Help Center', url: feUrl + '/help' },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'About Us', url: feUrl + '/about' }
  ])}`;

  return getBaseTemplate(content, 'Account Verified - The Travel Place');
};

/* ─────────────────────────────────────────────────────────────────────────────
   GENERATE EMAIL FROM DATABASE TEMPLATE
───────────────────────────────────────────────────────────────────────────── */

/**
 * Generate email HTML from database template.
 * @param {Object} template - Email template from database
 * @param {Object} data     - Data to populate template variables
 * @returns {string}        - Generated HTML email
 */
const generateEmailFromTemplate = (template, data) => {
  let content = template.mainContent;
  let greeting = template.greeting;
  let subject = template.subject;

  // Icon map for database-driven templates (icon name → emoji)
  const iconMap = {
    flight: '✈',
    hotel: '🏨',
    directions_car: '🚗',
    shield: '🛡',
    verified_user: '🛡',
    verified: '✅',
    check_circle: '✅',
    calendar_today: '📅',
    date_range: '📅',
    event: '📅',
    schedule: '⏱',
    location_on: '📍',
    phone: '📞',
    download: '⬇',
    description: '📄',
    support_agent: '🎧',
    info: 'ℹ',
    info_outline: 'ℹ',
    luggage: '🧳',
    fact_check: '✔',
    confirmation_number: '🎫',
    badge: '🪪',
    room_service: '🛎',
    nights_stay: '🌙',
    lock_reset: '🔒',
    security: '🔒',
    celebration: '🎉',
    dashboard: '📊',
    explore: '🧭',
    person: '👤',
    account_circle: '👤',
    tips_and_updates: '💡',
    help_outline: '❓',
    apartment: '🏢',
    mail: '✉'
  };

  const headerIcon = iconMap[template.headerIcon] || iconMap['mail'];

  // Replace all {{variable}} placeholders
  const replaceVariables = (text) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return data[variable] !== undefined ? data[variable] : match;
    });
  };

  content = replaceVariables(content);
  greeting = replaceVariables(greeting);
  subject = replaceVariables(subject);

  const feUrl = process.env.FRONTEND_URL || 'https://test.ttp.ng';

  const emailContent = `
  ${renderHeader(headerIcon, template.headerSubtitle || '')}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td style="background-color:#ffffff; padding:32px;">
        <h1 style="font-size:24px; font-weight:600; color:#111827; margin:0 0 12px 0; line-height:1.3; font-family:Arial,Helvetica,sans-serif;">${greeting}</h1>
        <div style="font-size:14px; color:#4b5563; line-height:1.6; font-family:Arial,Helvetica,sans-serif;">
          ${content}
        </div>
      </td>
    </tr>
  </table>

  ${renderFooter(headerIcon, template.footerText || 'Thank you for choosing The Travel Place.', [
    { label: 'Help Center', url: feUrl + '/help' },
    { label: 'Contact Us', url: feUrl + '/contact' },
    { label: 'About Us', url: feUrl + '/about' }
  ])}`;

  return getBaseTemplate(emailContent, subject);
};

/* ─────────────────────────────────────────────────────────────────────────────
   EXPORTS
───────────────────────────────────────────────────────────────────────────── */

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
