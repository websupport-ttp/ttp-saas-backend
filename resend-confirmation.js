const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/the_travel_place');

// Import required services
const Ledger = require('./v1/models/ledgerModel');
const { sendEmail } = require('./v1/utils/emailService');

const resendConfirmation = async () => {
  try {
    const reference = 'TTP-FL-1765985468651';
    
    console.log('Fetching transaction:', reference);
    
    const ledgerEntry = await Ledger.findOne({ transactionReference: reference });
    
    if (!ledgerEntry) {
      console.log('Transaction not found');
      return;
    }
    
    console.log('Transaction found, preparing email...');
    
    // Extract data from ledger entry
    const {
      guestEmail,
      totalAmountPaid,
      currency,
      productDetails
    } = ledgerEntry;
    
    const bookingReference = productDetails.amadeusBookingRef;
    const flightDetails = productDetails.flightDetails;
    const passengerDetails = productDetails.passengerDetails;
    const bookingStatus = productDetails.bookingStatus;
    
    // Prepare email content
    const firstPassenger = Array.isArray(passengerDetails) ? passengerDetails[0] : passengerDetails;
    const passengerName = firstPassenger?.firstName && firstPassenger?.lastName 
      ? `${firstPassenger.firstName} ${firstPassenger.lastName}`
      : 'Valued Customer';
    
    const emailSubject = `Flight Booking Confirmation - ${bookingReference}`;
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #E21E24;">Flight Booking Confirmation</h2>
        <p>Dear ${passengerName},</p>
        <p>Your flight booking has been confirmed!</p>
        
        <h3 style="color: #27273F;">Booking Details:</h3>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 8px 0;"><strong>Booking Reference:</strong> ${bookingReference}</li>
          <li style="margin: 8px 0;"><strong>Payment Reference:</strong> ${reference}</li>
          <li style="margin: 8px 0;"><strong>Flight Route:</strong> ${flightDetails.itineraries[0].segments[0].departure.iataCode} → ${flightDetails.itineraries[0].segments[flightDetails.itineraries[0].segments.length - 1].arrival.iataCode}</li>
          <li style="margin: 8px 0;"><strong>Departure Date:</strong> ${new Date(flightDetails.itineraries[0].segments[0].departure.at).toLocaleDateString()}</li>
          <li style="margin: 8px 0;"><strong>Passengers:</strong> ${passengerDetails.map(p => `${p.firstName} ${p.lastName}`).join(', ')}</li>
          <li style="margin: 8px 0;"><strong>Total Amount:</strong> ₦${totalAmountPaid.toLocaleString()}</li>
          <li style="margin: 8px 0;"><strong>Status:</strong> ${bookingStatus}</li>
        </ul>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="color: #27273F; margin-top: 0;">Flight Details:</h4>
          <p><strong>Outbound Flight:</strong></p>
          <ul>
            <li>From: ${flightDetails.itineraries[0].segments[0].departure.iataCode}</li>
            <li>To: ${flightDetails.itineraries[0].segments[flightDetails.itineraries[0].segments.length - 1].arrival.iataCode}</li>
            <li>Date: ${new Date(flightDetails.itineraries[0].segments[0].departure.at).toLocaleDateString()}</li>
            <li>Time: ${new Date(flightDetails.itineraries[0].segments[0].departure.at).toLocaleTimeString()}</li>
          </ul>
          ${flightDetails.itineraries[1] ? `
          <p><strong>Return Flight:</strong></p>
          <ul>
            <li>From: ${flightDetails.itineraries[1].segments[0].departure.iataCode}</li>
            <li>To: ${flightDetails.itineraries[1].segments[flightDetails.itineraries[1].segments.length - 1].arrival.iataCode}</li>
            <li>Date: ${new Date(flightDetails.itineraries[1].segments[0].departure.at).toLocaleDateString()}</li>
            <li>Time: ${new Date(flightDetails.itineraries[1].segments[0].departure.at).toLocaleTimeString()}</li>
          </ul>
          ` : ''}
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin-top: 0;">Important Information:</h4>
          <ul style="color: #856404;">
            <li>This booking requires manual processing by our team</li>
            <li>You will receive your e-tickets within 24 hours</li>
            <li>Please arrive at the airport at least 2 hours before domestic flights and 3 hours before international flights</li>
            <li>Ensure your passport is valid for at least 6 months from travel date</li>
            <li>Keep this confirmation email for your records</li>
          </ul>
        </div>
        
        <p>Thank you for choosing The Travel Place!</p>
        <p>For any inquiries, please contact our support team with your booking reference: <strong>${bookingReference}</strong></p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This is an automated email. Please do not reply to this email address.
        </p>
      </div>
    `;

    // Send email
    console.log('Sending confirmation email to:', guestEmail);
    
    await sendEmail({
      to: guestEmail,
      subject: emailSubject,
      html: emailContent
    });
    
    console.log('✅ Flight booking confirmation email sent successfully!');
    
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

resendConfirmation();