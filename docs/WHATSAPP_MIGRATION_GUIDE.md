# WhatsApp Migration Guide: From Twilio to WhatsApp Business API

This guide explains the changes made to migrate from Twilio's WhatsApp service to the official WhatsApp Business API while retaining Twilio for SMS.

## What Changed

### 1. Service Separation
- **Before**: Single `smsService.js` handled both SMS and WhatsApp via Twilio
- **After**: 
  - `smsService.js` - Handles SMS only via Twilio
  - `whatsappService.js` - Handles WhatsApp via WhatsApp Business API

### 2. Environment Variables

#### Removed Variables
```env
TWILIO_WHATSAPP_NUMBER=whatsapp:+2348189273082
```

#### Added Variables
```env
# WhatsApp Business API
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_API_VERSION=v18.0
```

### 3. Code Changes

#### Import Changes
```javascript
// Before
const { sendSMS, sendWhatsAppMessage } = require('../utils/smsService');

// After
const { sendSMS } = require('../utils/smsService');
const { sendWhatsAppMessage } = require('../utils/whatsappService');
```

#### Files Modified
- `backend/v1/utils/smsService.js` - Removed WhatsApp functionality
- `backend/v1/controllers/messageController.js` - Updated imports
- `backend/v1/controllers/productController.js` - Updated imports
- `backend/tests/mocks.js` - Updated test mocks
- `backend/v1/test/content.test.js` - Updated test mocks

## New Features

### 1. Enhanced WhatsApp Service
The new `whatsappService.js` provides:

- **Text Messages**: Basic text messaging
- **Template Messages**: For approved business templates
- **Media Messages**: Send images, documents, audio, video
- **Configuration Validation**: Verify setup before sending

### 2. Better Error Handling
- Detailed error logging with API response data
- Proper error propagation
- Configuration validation

### 3. Advanced Messaging Options

#### Template Messages
```javascript
const { whatsappService } = require('../utils/whatsappService');

await whatsappService.sendTemplateMessage(
  '1234567890',
  'booking_confirmation',
  'en_US',
  ['John Doe', 'FL123', '2024-01-15']
);
```

#### Media Messages
```javascript
await whatsappService.sendMediaMessage(
  '1234567890',
  'image',
  'https://example.com/ticket.jpg',
  'Your flight ticket'
);
```

## Migration Steps

### 1. Update Environment Variables
1. Remove `TWILIO_WHATSAPP_NUMBER` from your `.env` file
2. Add the new WhatsApp Business API variables
3. Get your credentials from Facebook Developer Console

### 2. Install Dependencies
```bash
npm install axios
```

### 3. Update Your Code
The migration is backward compatible. Your existing `sendWhatsAppMessage(to, body)` calls will continue to work without changes.

### 4. Test the Migration
```javascript
// Test SMS (should still work)
const { sendSMS } = require('./v1/utils/smsService');
await sendSMS('+1234567890', 'Test SMS message');

// Test WhatsApp (new service)
const { sendWhatsAppMessage } = require('./v1/utils/whatsappService');
await sendWhatsAppMessage('1234567890', 'Test WhatsApp message');
```

## Benefits of Migration

### 1. Cost Savings
- WhatsApp Business API is often more cost-effective than Twilio's WhatsApp service
- Free tier includes 1,000 conversations per month

### 2. Better Features
- Native WhatsApp features like templates, media, and interactive messages
- Better delivery rates and user experience
- Access to WhatsApp Business features

### 3. Direct Integration
- Direct connection to WhatsApp without third-party intermediary
- Better control over message delivery and status
- Access to advanced WhatsApp Business features

## Rollback Plan

If you need to rollback to Twilio for WhatsApp:

1. **Restore the old smsService.js**:
```javascript
// Add back to smsService.js
const sendWhatsAppMessage = async (to, body) => {
  try {
    await twilioClient.messages.create({
      body,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`,
    });
    logger.info(`WhatsApp message sent to ${to}: ${body}`);
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${to}: ${error.message}`);
  }
};

module.exports = { sendSMS, sendWhatsAppMessage };
```

2. **Restore environment variable**:
```env
TWILIO_WHATSAPP_NUMBER=whatsapp:+2348189273082
```

3. **Update imports back to**:
```javascript
const { sendSMS, sendWhatsAppMessage } = require('../utils/smsService');
```

## Testing Checklist

- [ ] SMS messages still work via Twilio
- [ ] WhatsApp messages work via new API
- [ ] Environment variables are properly set
- [ ] All tests pass
- [ ] Error handling works correctly
- [ ] Logging is functioning
- [ ] API endpoints respond correctly

## Support

If you encounter issues:

1. Check the [WhatsApp Setup Guide](./WHATSAPP_SETUP_GUIDE.md)
2. Verify your environment variables
3. Check the application logs for detailed error messages
4. Test with the validation functions:

```javascript
const { validateTwilioConfiguration } = require('./v1/utils/smsService');
const { whatsappService } = require('./v1/utils/whatsappService');

console.log('Twilio Config:', validateTwilioConfiguration());
console.log('WhatsApp Config:', whatsappService.validateConfiguration());
```