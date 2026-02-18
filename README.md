# TTP Backend API

A comprehensive Node.js/Express.js backend API for The Travel Place (TTP) platform, featuring affiliate management, analytics, wallet functionality, and travel booking integrations.

## 🚀 Features

- **User Authentication & Authorization** - JWT-based auth with role management
- **Affiliate System** - Complete affiliate management with commission tracking
- **Analytics Dashboard** - Real-time analytics and reporting
- **Wallet Management** - Digital wallet with transaction history
- **Travel Integrations** - Amadeus (flights), RateHawk (hotels), Allianz (insurance)
- **QR Code Generation** - Dynamic QR codes for bookings and referrals
- **Payment Processing** - Paystack integration for secure payments
- **Content Management** - Post and category management system
- **Health Monitoring** - Comprehensive health checks and monitoring
- **Security** - Rate limiting, input validation, XSS protection, and more

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis
- **Authentication**: JWT
- **File Upload**: Cloudinary
- **Testing**: Jest with comprehensive test suites
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, express-rate-limit, express-mongo-sanitize

## 📁 Project Structure

```
├── app.js                 # Main application file
├── server.js             # Server entry point
├── package.json          # Dependencies and scripts
├── jest.config.js        # Jest testing configuration
├── docs/                 # API documentation
├── v1/                   # API version 1
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── services/       # Business logic services
│   ├── utils/          # Utility functions
│   └── test/           # Test files
└── .github/            # GitHub workflows
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/opeoladettp/ttp-backend.git
cd ttp-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:
```bash
npm run dev
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=5001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ttp_backend
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Third-party Services
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

PAYSTACK_SECRET_KEY=your_paystack_secret
AMADEUS_API_KEY=your_amadeus_key
AMADEUS_API_SECRET=your_amadeus_secret

# Email & SMS
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=auth.test.js
```

## 📚 API Documentation

The API documentation is available via Swagger UI when the server is running:

- **Local**: http://localhost:5001/api-docs
- **Endpoints**: All API endpoints are prefixed with `/api/v1`

### Key Endpoints

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/users/profile` - Get user profile
- `POST /api/v1/affiliates/register` - Affiliate registration
- `GET /api/v1/analytics/dashboard` - Analytics dashboard
- `POST /api/v1/wallet/deposit` - Wallet deposit
- `GET /api/v1/health` - Health check

## 🔒 Security Features

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation
- **XSS Protection**: Cross-site scripting protection
- **NoSQL Injection**: MongoDB injection prevention
- **CORS**: Configurable CORS policies
- **Helmet**: Security headers

## 🚀 Deployment

The application is production-ready and can be deployed to various platforms:

### Docker Deployment

```bash
# Build Docker image
docker build -t ttp-backend .

# Run container
docker run -p 5001:5001 --env-file .env ttp-backend
```

### Environment-specific Configurations

- **Development**: Full logging, debug mode enabled
- **Production**: Optimized logging, security hardened
- **Testing**: In-memory database, mocked services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in this repository
- Contact the development team

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
  - User authentication and authorization
  - Affiliate management system
  - Analytics and reporting
  - Wallet functionality
  - Travel booking integrations
  - Comprehensive testing suite

---

**Built with ❤️ by The Travel Place Team**