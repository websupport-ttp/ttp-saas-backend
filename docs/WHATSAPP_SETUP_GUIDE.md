# WhatsApp Business API Setup Guide

This guide will help you set up the WhatsApp Business API for your application.

## Prerequisites

1. A Facebook Business Account
2. A WhatsApp Business Account
3. A verified phone number for WhatsApp Business

## Step 1: Create a Meta App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" and then "Create App"
3. Select "Business" as the app type
4. Fill in your app details:
   - App Name: Your application name
   - App Contact Email: Your email
   - Business Account: Select your business account

## Step 2: Add WhatsApp Product

1. In your app dashboard, click "Add Product"
2. Find "WhatsApp" and click "Set Up"
3. This will add WhatsApp to your app

## Step 3: Configure WhatsApp Business API

1. In the WhatsApp section, go to "API Setup"
2. You'll see:
   - **Phone Number ID**: This is your `WHATSAPP_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID**: Note this for reference
   - **Access Token**: This is your `WHATSAPP_ACCESS_TOKEN`

## Step 4: Get Your Access Token

### Temporary Access Token (for testing)

1. In the API Setup page, you'll see a temporary access token
2. This token is valid for 24 hours and is good for testing

### Permanent Access Token (for production)

1. Go to "App Settings" > "Basic"
2. Note your App ID and App Secret
3. Generate a permanent access token using the Graph API:

```bash
curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=client_credentials&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET"
```

## Step 5: Add Phone Number

1. In the WhatsApp API Setup page, click "Add phone number"
2. Follow the verification process
3. Once verified, you'll get a Phone Number ID

## Step 6: Configure Environment Variables

Add these variables to your `.env` file:

```env
# WhatsApp Business API
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_API_VERSION=v18.0
```

## Step 7: Test Your Setup

You can test your setup using the test endpoint in your application:

```bash
curl -X POST http://localhost:8080/api/v1/messages/send-whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "to": "1234567890",
    "body": "Hello from WhatsApp Business API!"
  }'
```

## Important Notes

### Phone Number Format

- Use international format without the `+` sign
- Example: For +1 234 567 8900, use `12345678900`

### Message Templates

- For production, you need approved message templates
- During development, you can send messages to verified numbers without templates
- Templates are required for sending messages to users who haven't messaged you first

### Rate Limits

- Free tier: 1,000 conversations per month
- Each conversation includes a 24-hour window
- Check [WhatsApp Business API pricing](https://developers.facebook.com/docs/whatsapp/pricing) for details

### Webhook Setup (Optional)

For receiving messages and delivery status:

1. In WhatsApp configuration, go to "Webhooks"
2. Set your webhook URL: `https://yourdomain.com/api/v1/webhooks/whatsapp`
3. Subscribe to message events
4. Verify your webhook with the verification token

## Troubleshooting

### Common Issues

1. **Invalid Phone Number ID**

   - Ensure you're using the correct Phone Number ID from the API Setup page
   - Check that the phone number is verified

2. **Access Token Expired**

   - Temporary tokens expire after 24 hours
   - Generate a permanent token for production use

3. **Message Not Delivered**

   - Check if the recipient's number is in the correct format
   - Ensure the recipient has WhatsApp installed
   - For production, check if you have an approved message template

4. **API Rate Limits**
   - Implement proper error handling and retry logic
   - Monitor your usage in the Facebook Business Manager

### Testing Numbers

During development, you can add test numbers in the WhatsApp API Setup:

1. Go to "API Setup"
2. Scroll to "To" field
3. Click "Manage phone number list"
4. Add phone numbers for testing

## Security Best Practices

1. **Never expose your access token** in client-side code
2. **Use environment variables** for all sensitive data
3. **Implement proper authentication** for your API endpoints
4. **Monitor API usage** regularly
5. **Use HTTPS** for all webhook endpoints

## Next Steps

1. Set up message templates for production use
2. Implement webhook handling for two-way communication
3. Add proper error handling and retry logic
4. Monitor usage and costs
5. Consider implementing message queuing for high volume

## Resources

- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [WhatsApp Business API Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
