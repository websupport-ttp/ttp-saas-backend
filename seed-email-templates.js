// seed-email-templates.js
require('dotenv').config();
const mongoose = require('mongoose');
const EmailTemplate = require('./v1/models/emailTemplateModel');

const templates = [
  {
    name: 'flight_confirmation',
    displayName: 'Flight Booking Confirmation',
    description: 'Sent when a flight booking is confirmed',
    subject: 'Flight Booking Confirmed - {{bookingReference}}',
    category: 'booking',
    headerIcon: 'flight',
    headerSubtitle: 'Booking Confirmed',
    greeting: 'Ready for take off, {{passengerName}}?',
    mainContent: `
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
        Your flight has been successfully booked. Please find your itinerary details below.
      </p>
      
      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">flight</span>
          <h3 class="info-card-title">Flight Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Booking Reference</span>
          <span class="info-value">{{bookingReference}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Flight Number</span>
          <span class="info-value">{{flightNumber}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Departure</span>
          <span class="info-value">{{departure}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Arrival</span>
          <span class="info-value">{{arrival}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date</span>
          <span class="info-value">{{departureDate}}</span>
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
    `,
    footerText: 'This is an automated email for your flight confirmation. Please keep this for your records.',
    variables: [
      { name: 'passengerName', description: 'Passenger name', example: 'John Doe' },
      { name: 'bookingReference', description: 'Booking reference number', example: 'ABC123' },
      { name: 'flightNumber', description: 'Flight number', example: 'BA123' },
      { name: 'departure', description: 'Departure airport', example: 'Lagos (LOS)' },
      { name: 'arrival', description: 'Arrival airport', example: 'London (LHR)' },
      { name: 'departureDate', description: 'Departure date', example: 'March 15, 2026' },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'hotel_confirmation',
    displayName: 'Hotel Booking Confirmation',
    description: 'Sent when a hotel booking is confirmed',
    subject: 'Hotel Booking Confirmed - {{bookingReference}}',
    category: 'booking',
    headerIcon: 'hotel',
    headerSubtitle: 'Booking Confirmed',
    greeting: 'Your stay is confirmed, {{guestName}}!',
    mainContent: `
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
        We're excited to welcome you. Your reservation details are below.
      </p>
      
      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">apartment</span>
          <h3 class="info-card-title">Hotel Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Hotel Name</span>
          <span class="info-value">{{hotelName}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location</span>
          <span class="info-value">{{location}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Check-in</span>
          <span class="info-value">{{checkIn}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Check-out</span>
          <span class="info-value">{{checkOut}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Nights</span>
          <span class="info-value">{{nights}}</span>
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
    `,
    footerText: 'This is an automated email for your hotel reservation. Please keep this for your records.',
    variables: [
      { name: 'guestName', description: 'Guest name', example: 'John Doe' },
      { name: 'bookingReference', description: 'Booking reference', example: 'HTL123' },
      { name: 'hotelName', description: 'Hotel name', example: 'Grand Hotel' },
      { name: 'location', description: 'Hotel location', example: 'Lagos, Nigeria' },
      { name: 'checkIn', description: 'Check-in date', example: 'March 15, 2026' },
      { name: 'checkOut', description: 'Check-out date', example: 'March 18, 2026' },
      { name: 'nights', description: 'Number of nights', example: '3' },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'car_hire_confirmation',
    displayName: 'Car Hire Confirmation',
    description: 'Sent when a car hire booking is confirmed',
    subject: 'Car Hire Confirmed - {{bookingReference}}',
    category: 'booking',
    headerIcon: 'directions_car',
    headerSubtitle: 'Booking Confirmed',
    greeting: 'Your car is ready, {{driverName}}!',
    mainContent: `
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
        Your car hire booking has been confirmed. Get ready to hit the road!
      </p>
      
      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">directions_car</span>
          <h3 class="info-card-title">Vehicle Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Vehicle</span>
          <span class="info-value">{{carName}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pickup Location</span>
          <span class="info-value">{{pickupLocation}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pickup Date</span>
          <span class="info-value">{{pickupDate}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Return Date</span>
          <span class="info-value">{{returnDate}}</span>
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
        </ul>
      </div>
    `,
    footerText: 'This is an automated email for your car hire booking. Please keep this for your records.',
    variables: [
      { name: 'driverName', description: 'Driver name', example: 'John Doe' },
      { name: 'bookingReference', description: 'Booking reference', example: 'CAR123' },
      { name: 'carName', description: 'Car name', example: 'Toyota Camry' },
      { name: 'pickupLocation', description: 'Pickup location', example: 'Lagos Airport' },
      { name: 'pickupDate', description: 'Pickup date', example: 'March 15, 2026' },
      { name: 'returnDate', description: 'Return date', example: 'March 18, 2026' },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'insurance_confirmation',
    displayName: 'Travel Insurance Confirmation',
    description: 'Sent when travel insurance is purchased',
    subject: 'Travel Insurance Policy Confirmed - {{contractNo}}',
    category: 'booking',
    headerIcon: 'shield',
    headerSubtitle: 'Insurance Confirmed',
    greeting: 'You\'re covered for your journey!',
    mainContent: `
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
        Your travel insurance policy has been successfully activated. Your payment has been confirmed and your coverage is now in effect.
      </p>
      
      <div class="info-card">
        <div class="info-card-header">
          <span class="material-icons-outlined info-card-icon">verified_user</span>
          <h3 class="info-card-title">Policy Details</h3>
        </div>
        <div class="info-row">
          <span class="info-label">Policy Number</span>
          <span class="info-value">{{contractNo}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Destination</span>
          <span class="info-value">{{destination}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Coverage Begins</span>
          <span class="info-value">{{coverBegins}}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Coverage Ends</span>
          <span class="info-value">{{coverEnds}}</span>
        </div>
      </div>

      <div class="alert-box">
        <p class="alert-title">
          <span class="material-icons-outlined" style="font-size: 18px;">info</span>
          Important Information
        </p>
        <ul class="alert-list">
          <li>Keep your policy number ({{contractNo}}) safe for reference</li>
          <li>Your policy is valid from {{coverBegins}}</li>
          <li>For claims or emergencies, contact our 24/7 support line</li>
          <li>Carry a copy of this confirmation when traveling</li>
        </ul>
      </div>
    `,
    footerText: 'This is an automated email for your travel insurance confirmation.',
    variables: [
      { name: 'contractNo', description: 'Policy number', example: 'INS123456' },
      { name: 'destination', description: 'Travel destination', example: 'United Kingdom' },
      { name: 'coverBegins', description: 'Coverage start date', example: 'March 15, 2026' },
      { name: 'coverEnds', description: 'Coverage end date', example: 'March 25, 2026' },
    ],
    isSystem: true,
    isActive: true,
  },
];

const seedEmailTemplates = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing templates (optional - comment out if you want to keep existing)
    // await EmailTemplate.deleteMany({});
    // console.log('Cleared existing email templates');

    // Insert templates (update if exists, insert if new)
    for (const template of templates) {
      await EmailTemplate.findOneAndUpdate(
        { name: template.name },
        template,
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded template: ${template.displayName}`);
    }

    console.log('\n✅ Email templates seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding email templates:', error);
    process.exit(1);
  }
};

seedEmailTemplates();
