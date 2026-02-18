const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/the_travel_place');

// Import the Ledger model
const Ledger = require('./v1/models/ledgerModel');

const checkTransaction = async () => {
  try {
    const reference = 'TTP-FL-1765985468651';
    
    console.log('Checking transaction:', reference);
    
    const ledgerEntry = await Ledger.findOne({ transactionReference: reference });
    
    if (ledgerEntry) {
      console.log('Transaction found!');
      console.log('Status:', ledgerEntry.status);
      console.log('Amount:', ledgerEntry.totalAmountPaid);
      console.log('Guest Email:', ledgerEntry.guestEmail);
      console.log('Product Details:', JSON.stringify(ledgerEntry.productDetails, null, 2));
    } else {
      console.log('Transaction not found in database');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

checkTransaction();